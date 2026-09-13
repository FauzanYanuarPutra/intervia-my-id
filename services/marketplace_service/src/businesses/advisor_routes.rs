use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    advisor::{build_advisor_summary, AdvisorMetrics},
    identity_client::{IdentityClient, IdentityClientError},
    repository::{BusinessRepository, RepositoryError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/businesses/{business_id}/advisor/summary",
        get(get_advisor_summary),
    )
}

async fn get_advisor_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let organization_id = match advisor_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let sales = sqlx::query_as::<_, (i64, i64, i64)>(
        r#"
        SELECT
          COALESCE(SUM(final_amount),0)::BIGINT,
          COUNT(*)::BIGINT,
          COUNT(*) FILTER (WHERE cost_complete=FALSE)::BIGINT
        FROM business_sales
        WHERE business_id=$1 AND organization_id=$2
          AND status='completed'
          AND occurred_on >= CURRENT_DATE - 29
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&state.db)
    .await;

    let due_14d = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(amount),0)::BIGINT
        FROM business_recurring_obligations
        WHERE business_id=$1 AND organization_id=$2 AND active=TRUE
          AND next_due_on <= CURRENT_DATE + 14
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&state.db)
    .await;

    let low_stock = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM business_ingredients
        WHERE business_id=$1 AND organization_id=$2 AND status='active'
          AND stock_quantity <= minimum_stock
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&state.db)
    .await;

    let yield_evidence = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM business_material_yield_observations
        WHERE business_id=$1 AND organization_id=$2
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&state.db)
    .await;

    match (sales, due_14d, low_stock, yield_evidence) {
        (Ok((sales_30d_amount, sales_30d_count, incomplete_cost_sales_30d)), Ok(due_14d_amount), Ok(low_stock_count), Ok(yield_evidence_count)) => {
            let summary = build_advisor_summary(AdvisorMetrics {
                sales_30d_amount,
                sales_30d_count,
                incomplete_cost_sales_30d,
                due_14d_amount,
                low_stock_count,
                yield_evidence_count,
            });
            (StatusCode::OK, Json(json!({ "data": { "advisor": summary } }))).into_response()
        }
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_advisor_storage_unavailable",
        ),
    }
}

async fn advisor_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
) -> Result<Uuid, Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;

    let identity = IdentityClient::new(
        state.http_client.clone(),
        state.identity_service_url.clone(),
    );
    let organizations = identity
        .list_organizations(authorization)
        .await
        .map_err(identity_error_response)?;
    let repository = BusinessRepository::new(state.db.clone());

    for organization in organizations {
        let business = repository
            .get_for_organization(business_id, organization.id)
            .await
            .map_err(repository_error_response)?;
        if business.is_none() {
            continue;
        }
        if !organization.can_use_business_advisor() {
            return Err(api_error(
                StatusCode::FORBIDDEN,
                "business_advisor_access_denied",
            ));
        }
        return Ok(organization.id);
    }

    Err(api_error(StatusCode::NOT_FOUND, "business_not_found"))
}

fn identity_error_response(error: IdentityClientError) -> Response {
    match error {
        IdentityClientError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_advisor_access_denied")
        }
        IdentityClientError::Unavailable | IdentityClientError::InvalidResponse => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
    }
}

fn repository_error_response(_error: RepositoryError) -> Response {
    api_error(
        StatusCode::SERVICE_UNAVAILABLE,
        "business_advisor_storage_unavailable",
    )
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}
