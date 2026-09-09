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
    identity_client::IdentityClient,
    products::ProductRepository,
    repository::BusinessRepository,
    sales::{CreateSaleRequest, SaleRepository, SaleRepositoryError},
    service::{BusinessService, BusinessServiceError},
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
    let (_, organization_id) = match management_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match SaleRepository::new(state.db.clone())
        .list(business_id, organization_id, 200)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => sale_error_response(error),
    }
}

async fn create_sale(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateSaleRequest>,
) -> Response {
    let (actor_id, organization_id) = match management_context(&state, &headers, business_id).await
    {
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
            actor_id,
            business_id,
            organization_id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({ "data": { "sale": outcome.sale, "replayed": outcome.replayed } })),
        )
            .into_response(),
        Err(error) => sale_error_response(error),
    }
}

async fn management_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
) -> Result<(Uuid, Uuid), Response> {
    let (actor_id, authorization) =
        actor_and_authorization(state, headers).map_err(actor_auth_error_response)?;
    let organization_id = service(state)
        .management_organization_for_business(&authorization, business_id)
        .await
        .map_err(business_error_response)?;
    Ok((actor_id, organization_id))
}

fn service(state: &AppState) -> BusinessService {
    BusinessService::new(
        BusinessRepository::new(state.db.clone()),
        ProductRepository::new(state.db.clone()),
        IdentityClient::new(
            state.http_client.clone(),
            state.identity_service_url.clone(),
        ),
    )
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

fn business_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        BusinessServiceError::IdentityUnavailable => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_access_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
