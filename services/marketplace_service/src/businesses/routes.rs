use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    domain::{BusinessProfileUpdateRequest, ProvisionBusinessRequest, ReconcileBusinessRequest},
    identity_client::IdentityClient,
    products::{CreateBusinessProductRequest, ProductRepository},
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/businesses/mine", get(list_mine))
        .route("/v1/businesses/provision", post(provision))
        .route("/v1/businesses/reconcile", post(reconcile))
        .route(
            "/v1/businesses/{business_id}",
            get(get_business).patch(update_business),
        )
        .route(
            "/v1/businesses/{business_id}/products",
            post(create_product),
        )
}

async fn list_mine(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let (_, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    let service = service(&state);
    match service.list_mine(&authorization).await {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn get_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state).get(&authorization, business_id).await {
        Ok(aggregate) => (
            StatusCode::OK,
            Json(json!({ "data": { "business": aggregate } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn update_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<BusinessProfileUpdateRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .update_profile(actor_id, &authorization, business_id, payload)
        .await
    {
        Ok(aggregate) => (
            StatusCode::OK,
            Json(json!({ "data": { "business": aggregate } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn create_product(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateBusinessProductRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .create_product(actor_id, &authorization, business_id, payload)
        .await
    {
        Ok(product) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "product": product } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn provision(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ProvisionBusinessRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(key) => key,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match service(&state)
        .provision(actor_id, &authorization, idempotency_key, payload)
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({
                "data": {
                    "business": outcome.aggregate,
                    "replayed": outcome.replayed
                }
            })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn reconcile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ReconcileBusinessRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(key) => key,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match service(&state)
        .reconcile(actor_id, &authorization, idempotency_key, payload)
        .await
    {
        Ok(outcome) => (
            StatusCode::OK,
            Json(json!({
                "data": {
                    "business": outcome.aggregate,
                    "replayed": outcome.replayed
                }
            })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
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

fn error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::Validation(error) => api_error(StatusCode::BAD_REQUEST, error.code()),
        BusinessServiceError::ProductValidation(error) => {
            api_error(StatusCode::BAD_REQUEST, error.code())
        }
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        BusinessServiceError::IdempotencyConflict => {
            api_error(StatusCode::CONFLICT, "idempotency_conflict")
        }
        BusinessServiceError::VersionConflict => {
            api_error(StatusCode::CONFLICT, "business_version_conflict")
        }
        BusinessServiceError::OrganizationSelectionRequired => {
            api_error(StatusCode::CONFLICT, "organization_selection_required")
        }
        BusinessServiceError::ReconciliationSelectionRequired => {
            api_error(StatusCode::CONFLICT, "reconciliation_selection_required")
        }
        BusinessServiceError::IdentityUnavailable => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
        BusinessServiceError::Storage => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "provisioning_retryable")
        }
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idempotency_key_is_required_and_must_be_a_uuid() {
        assert_eq!(parse_idempotency_key(None), Err("missing_idempotency_key"));
        assert_eq!(
            parse_idempotency_key(Some("not-a-uuid")),
            Err("invalid_idempotency_key")
        );
        assert!(parse_idempotency_key(Some("3d69acb2-aed8-4c48-b62d-30034e0440eb")).is_ok());
    }

    #[test]
    fn optimistic_concurrency_conflicts_use_http_conflict() {
        let response = error_response(BusinessServiceError::VersionConflict);

        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn product_validation_errors_use_stable_bad_request_responses() {
        let response = error_response(BusinessServiceError::ProductValidation(
            super::super::products::ProductValidationError::InvalidName,
        ));

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
