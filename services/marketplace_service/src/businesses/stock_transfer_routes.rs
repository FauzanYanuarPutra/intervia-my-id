use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::stock_transfer::{
    CreateStockTransferRequest, StockTransferError, StockTransferRepository,
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/businesses/{business_id}/inventory/transfers",
        get(list_transfers).post(create_transfer),
    )
}

#[derive(Debug, Deserialize)]
struct TransferListQuery {
    #[serde(default = "default_limit")]
    limit: i64,
}

const fn default_limit() -> i64 {
    200
}

async fn list_transfers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Query(query): Query<TransferListQuery>,
) -> Response {
    let actor_id = match actor(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let repository = StockTransferRepository::new(state.db.clone());
    let organization_id = match repository.organization_for_business(business_id).await {
        Ok(value) => value,
        Err(error) => return transfer_error_response(error),
    };
    match repository
        .list(actor_id, business_id, organization_id, query.limit)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => transfer_error_response(error),
    }
}

async fn create_transfer(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateStockTransferRequest>,
) -> Response {
    let actor_id = match actor(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    let repository = StockTransferRepository::new(state.db.clone());
    let organization_id = match repository.organization_for_business(business_id).await {
        Ok(value) => value,
        Err(error) => return transfer_error_response(error),
    };
    match repository
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
            Json(json!({"data":outcome})),
        )
            .into_response(),
        Err(error) => transfer_error_response(error),
    }
}

fn actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, Response> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))
}

fn parse_idempotency_key(headers: &HeaderMap) -> Result<Uuid, &'static str> {
    let value = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn transfer_error_response(error: StockTransferError) -> Response {
    match error {
        StockTransferError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        StockTransferError::Forbidden => api_error(
            StatusCode::FORBIDDEN,
            "business_inventory_permission_denied",
        ),
        StockTransferError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "stock_transfer_resource_not_found")
        }
        StockTransferError::InsufficientStock => {
            api_error(StatusCode::CONFLICT, "inventory_insufficient_stock")
        }
        StockTransferError::Conflict => {
            api_error(StatusCode::CONFLICT, "stock_transfer_conflict")
        }
        StockTransferError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "stock_transfer_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error":code}))).into_response()
}
