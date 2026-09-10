use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    identity_client::{IdentityClient, IdentityClientError},
    repository::{BusinessRepository, RepositoryError},
    sales::{CreateSaleRequest, SaleAggregate, SaleRepository, SaleRepositoryError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/businesses/{business_id}/sales",
        get(list_sales).post(create_sale),
    )
}

async fn list_sales(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let access = match sales_access_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match SaleRepository::new(state.db.clone())
        .list(business_id, access.organization_id, 200)
        .await
    {
        Ok(items) => {
            let items = if access.can_view_costs {
                items
            } else {
                items.into_iter().map(redact_sale_costs).collect()
            };
            (
                StatusCode::OK,
                Json(json!({ "data": { "count": items.len(), "items": items } })),
            )
                .into_response()
        }
        Err(error) => sale_error_response(error),
    }
}

async fn create_sale(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateSaleRequest>,
) -> Response {
    let access = match sales_access_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };

    match SaleRepository::new(state.db.clone())
        .create(
            access.actor_id,
            business_id,
            access.organization_id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => {
            let sale = if access.can_view_costs {
                outcome.sale
            } else {
                redact_sale_costs(outcome.sale)
            };
            (
                if outcome.replayed {
                    StatusCode::OK
                } else {
                    StatusCode::CREATED
                },
                Json(json!({ "data": { "sale": sale, "replayed": outcome.replayed } })),
            )
                .into_response()
        }
        Err(error) => sale_error_response(error),
    }
}

#[derive(Debug, Clone, Copy)]
struct SalesAccessContext {
    actor_id: Uuid,
    organization_id: Uuid,
    can_view_costs: bool,
}

async fn sales_access_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
) -> Result<SalesAccessContext, Response> {
    let (actor_id, authorization) =
        actor_and_authorization(state, headers).map_err(actor_auth_error_response)?;
    let identity = IdentityClient::new(
        state.http_client.clone(),
        state.identity_service_url.clone(),
    );
    let organizations = identity
        .list_organizations(&authorization)
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
        if !organization.can_record_sales() {
            return Err(api_error(
                StatusCode::FORBIDDEN,
                "business_sales_access_denied",
            ));
        }
        return Ok(SalesAccessContext {
            actor_id,
            organization_id: organization.id,
            can_view_costs: organization.can_view_sale_costs(),
        });
    }

    Err(api_error(StatusCode::NOT_FOUND, "business_not_found"))
}

fn redact_sale_costs(mut sale: SaleAggregate) -> SaleAggregate {
    sale.sale.cogs_amount = None;
    for line in &mut sale.lines {
        line.unit_cogs_amount = None;
        line.line_cogs_amount = None;
        line.cost_snapshot = Value::Null;
    }
    sale
}

fn actor_and_authorization(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(Uuid, String), ActorAuthError> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or(ActorAuthError::Missing)?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret).ok_or(ActorAuthError::Invalid)?;
    Ok((actor_id, authorization.to_owned()))
}

#[derive(Debug, Clone, Copy)]
enum ActorAuthError {
    Missing,
    Invalid,
}

fn actor_auth_error_response(_error: ActorAuthError) -> Response {
    api_error(StatusCode::UNAUTHORIZED, "auth_required")
}

fn identity_error_response(error: IdentityClientError) -> Response {
    match error {
        IdentityClientError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_sales_access_denied")
        }
        IdentityClientError::Unavailable | IdentityClientError::InvalidResponse => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
    }
}

fn repository_error_response(_error: RepositoryError) -> Response {
    api_error(
        StatusCode::SERVICE_UNAVAILABLE,
        "business_sale_storage_unavailable",
    )
}

fn parse_idempotency_key(value: Option<&str>) -> Result<Uuid, &'static str> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn sale_error_response(error: SaleRepositoryError) -> Response {
    match error {
        SaleRepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        SaleRepositoryError::IncompleteCosting => {
            api_error(StatusCode::CONFLICT, "sale_costing_incomplete")
        }
        SaleRepositoryError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_sale_resource_not_found")
        }
        SaleRepositoryError::IdempotencyConflict => {
            api_error(StatusCode::CONFLICT, "idempotency_conflict")
        }
        SaleRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_sale_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveDate, Utc};
    use rust_decimal::Decimal;

    #[test]
    fn sale_idempotency_key_is_required_and_must_be_uuid() {
        assert_eq!(parse_idempotency_key(None), Err("missing_idempotency_key"));
        assert_eq!(
            parse_idempotency_key(Some("not-a-uuid")),
            Err("invalid_idempotency_key")
        );
        assert!(parse_idempotency_key(Some("3d69acb2-aed8-4c48-b62d-30034e0440eb")).is_ok());
    }

    #[test]
    fn sale_repository_errors_map_to_stable_status_codes() {
        assert_eq!(
            sale_error_response(SaleRepositoryError::IncompleteCosting).status(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            sale_error_response(SaleRepositoryError::InsufficientStock).status(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            sale_error_response(SaleRepositoryError::Validation("invalid_sale_lines")).status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            sale_error_response(SaleRepositoryError::NotFound).status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            sale_error_response(SaleRepositoryError::Database).status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[test]
    fn cashier_response_redacts_cogs_and_recipe_snapshot() {
        let now = Utc::now();
        let aggregate = SaleAggregate {
            sale: super::super::sales::SaleRecord {
                id: Uuid::new_v4(),
                business_id: Uuid::new_v4(),
                organization_id: Uuid::new_v4(),
                occurred_on: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
                channel_key: None,
                account_key: "cash".to_owned(),
                status: "completed".to_owned(),
                gross_amount: 10_000,
                discount_amount: 0,
                final_amount: 10_000,
                cogs_amount: Some(4_000),
                cost_complete: true,
                created_by_user_id: Uuid::new_v4(),
                created_at: now,
                updated_at: now,
            },
            lines: vec![super::super::sales::SaleLineRecord {
                id: Uuid::new_v4(),
                sale_id: Uuid::new_v4(),
                product_id: Uuid::new_v4(),
                product_name: "Produk".to_owned(),
                quantity: Decimal::ONE,
                unit_price_amount: 10_000,
                discount_amount: 0,
                final_revenue_amount: 10_000,
                unit_cogs_amount: Some(4_000),
                line_cogs_amount: Some(4_000),
                cost_snapshot: json!({"recipe_name":"rahasia"}),
                created_at: now,
                updated_at: now,
            }],
        };

        let redacted = redact_sale_costs(aggregate);
        assert_eq!(redacted.sale.cogs_amount, None);
        assert_eq!(redacted.lines[0].unit_cogs_amount, None);
        assert_eq!(redacted.lines[0].line_cogs_amount, None);
        assert_eq!(redacted.lines[0].cost_snapshot, Value::Null);
        assert!(redacted.sale.cost_complete);
    }
}
