use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    identity_client::{IdentityClient, IdentityClientError},
    repository::{BusinessRepository, RepositoryError},
    reset::{DataResetRepository, ResetError, ResetRequest, ResetScope},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/data-reset/preview",
            post(preview),
        )
        .route("/v1/businesses/{business_id}/data-reset/apply", post(apply))
}

async fn preview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(request): Json<ResetRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, &request.scopes).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    match DataResetRepository::new(state.db.clone())
        .preview(business_id, access.organization_id, &request.scopes)
        .await
    {
        Ok(value) => (StatusCode::OK, Json(json!({"data":value}))).into_response(),
        Err(error) => reset_error_response(error),
    }
}

async fn apply(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(request): Json<ResetRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, &request.scopes).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let idempotency_key = match headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
    {
        Some(value) => match Uuid::parse_str(value) {
            Ok(uuid) => uuid,
            Err(_) => return api_error(StatusCode::BAD_REQUEST, "invalid_idempotency_key"),
        },
        None => return api_error(StatusCode::BAD_REQUEST, "missing_idempotency_key"),
    };

    match DataResetRepository::new(state.db.clone())
        .apply(
            access.actor_id,
            business_id,
            access.organization_id,
            idempotency_key,
            request,
        )
        .await
    {
        Ok(value) => (StatusCode::OK, Json(json!({"data":value}))).into_response(),
        Err(error) => reset_error_response(error),
    }
}

struct ResetAccessContext {
    actor_id: Uuid,
    organization_id: Uuid,
}

async fn access_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
    scopes: &[ResetScope],
) -> Result<ResetAccessContext, Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
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

    let mut selected = None;
    for organization in organizations {
        match repository
            .get_for_organization(business_id, organization.id)
            .await
        {
            Ok(Some(_)) => {
                selected = Some(organization);
                break;
            }
            Ok(None) => {}
            Err(error) => return Err(repository_error_response(error)),
        }
    }

    let organization =
        selected.ok_or_else(|| api_error(StatusCode::NOT_FOUND, "business_not_found"))?;

    for scope in scopes
        .iter()
        .copied()
        .collect::<std::collections::HashSet<_>>()
    {
        let allowed = match scope {
            ResetScope::FinanceActivity | ResetScope::OwnerCapital => {
                organization.can_reset_finance_data()
            }
            ResetScope::SalesTransactions => organization.can_reset_sales_data(),
            ResetScope::Inventory => organization.can_reset_inventory_data(),
            ResetScope::Products => organization.can_reset_catalog_data(),
        };
        if !allowed {
            return Err(api_error(
                StatusCode::FORBIDDEN,
                "business_data_reset_permission_denied",
            ));
        }
    }

    let unique_scope_count = scopes
        .iter()
        .collect::<std::collections::HashSet<_>>()
        .len();
    if unique_scope_count >= 5 && !organization.can_start_fresh() {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "business_start_fresh_permission_denied",
        ));
    }

    Ok(ResetAccessContext {
        actor_id,
        organization_id: organization.id,
    })
}

fn identity_error_response(error: IdentityClientError) -> Response {
    match error {
        IdentityClientError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "identity_access_denied")
        }
        IdentityClientError::Unavailable | IdentityClientError::InvalidResponse => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
    }
}

fn repository_error_response(_error: RepositoryError) -> Response {
    api_error(
        StatusCode::SERVICE_UNAVAILABLE,
        "business_storage_unavailable",
    )
}

fn reset_error_response(error: ResetError) -> Response {
    match error {
        ResetError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        ResetError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        ResetError::Conflict(code) => api_error(StatusCode::CONFLICT, code),
        ResetError::Sales(_) => api_error(StatusCode::CONFLICT, "business_data_reset_sales_failed"),
        ResetError::Finance(_) => {
            api_error(StatusCode::CONFLICT, "business_data_reset_finance_failed")
        }
        ResetError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_data_reset_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error":code}))).into_response()
}
