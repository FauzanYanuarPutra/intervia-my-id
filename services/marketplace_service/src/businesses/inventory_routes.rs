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

use super::inventory::{InventoryError, InventoryMutationRequest, InventoryRepository};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/branches/{location_id}/inventory",
            get(list_inventory),
        )
        .route(
            "/v1/businesses/{business_id}/branches/{location_id}/inventory/mutations",
            axum::routing::post(mutate_inventory),
        )
}

async fn list_inventory(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, location_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let actor_id = match inventory_actor(&state, &headers) {
        Ok(actor_id) => actor_id,
        Err(response) => return response,
    };
    let repository = InventoryRepository::new(state.db.clone());
    let organization_id = match repository.organization_for_business(business_id).await {
        Ok(organization_id) => organization_id,
        Err(error) => return inventory_error_response(error),
    };

    match repository
        .list_balances(actor_id, business_id, organization_id, location_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => inventory_error_response(error),
    }
}

async fn mutate_inventory(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, location_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<InventoryMutationRequest>,
) -> Response {
    let actor_id = match inventory_actor(&state, &headers) {
        Ok(actor_id) => actor_id,
        Err(response) => return response,
    };
    let idempotency_key = match parse_inventory_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(key) => key,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };

    let repository = InventoryRepository::new(state.db.clone());
    let organization_id = match repository.organization_for_business(business_id).await {
        Ok(organization_id) => organization_id,
        Err(error) => return inventory_error_response(error),
    };

    match repository
        .mutate(
            actor_id,
            business_id,
            organization_id,
            location_id,
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
            Json(json!({
                "data": {
                    "command": outcome.command,
                    "movement": outcome.movement,
                    "replayed": outcome.replayed
                }
            })),
        )
            .into_response(),
        Err(error) => inventory_error_response(error),
    }
}

fn inventory_actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, Response> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;

    user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))
}

pub(crate) fn parse_inventory_idempotency_key(value: Option<&str>) -> Result<Uuid, &'static str> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

pub(crate) fn inventory_error_response(error: InventoryError) -> Response {
    match error {
        InventoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        InventoryError::Forbidden => api_error(
            StatusCode::FORBIDDEN,
            "business_inventory_permission_denied",
        ),
        InventoryError::NotFound => api_error(
            StatusCode::NOT_FOUND,
            "business_inventory_resource_not_found",
        ),
        InventoryError::InsufficientStock => {
            api_error(StatusCode::CONFLICT, "inventory_insufficient_stock")
        }
        InventoryError::IdempotencyConflict => {
            api_error(StatusCode::CONFLICT, "idempotency_conflict")
        }
        InventoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_inventory_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}
