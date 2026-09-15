use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    finance_core::{
        CorrectFinanceEntryRequest, CreateFinanceCoreEntryRequest, FinanceCoreError,
        FinanceCoreRepository, MoveAllocationRequest,
    },
    identity_client::IdentityClient,
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/finance-core/summary",
            get(summary),
        )
        .route(
            "/v1/businesses/{business_id}/finance-core/entries",
            get(history).post(create_entry),
        )
        .route(
            "/v1/businesses/{business_id}/finance-core/entries/{entry_id}/correct",
            post(correct_entry),
        )
        .route(
            "/v1/businesses/{business_id}/finance-core/allocations",
            get(allocation_balances),
        )
        .route(
            "/v1/businesses/{business_id}/finance-core/allocations/move",
            post(move_allocation),
        )
}

#[derive(Debug, Clone, Serialize, FromRow)]
struct FinanceHistoryRow {
    id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    entry_type: String,
    account_key: String,
    amount: i64,
    occurred_on: NaiveDate,
    note: String,
    channel_key: Option<String>,
    source_type: Option<String>,
    source_id: Option<Uuid>,
    created_by_user_id: Uuid,
    effect_multiplier: i16,
    reversal_of_entry_id: Option<Uuid>,
    corrects_entry_id: Option<Uuid>,
    correction_reason: Option<String>,
    allocation_bucket: Option<String>,
    corrected: bool,
    replacement_entry_id: Option<Uuid>,
    corrected_by_user_id: Option<Uuid>,
    corrected_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

async fn summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match FinanceCoreRepository::new(state.db.clone())
        .summary(business_id, organization_id)
        .await
    {
        Ok(summary) => (StatusCode::OK, Json(json!({"data": {"summary": summary}}))).into_response(),
        Err(error) => finance_error_response(error),
    }
}

async fn history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let items = sqlx::query_as::<_, FinanceHistoryRow>(
        r#"
        SELECT entry.id,entry.business_id,entry.organization_id,entry.entry_type,entry.account_key,
               entry.amount,entry.occurred_on,entry.note,entry.channel_key,entry.source_type,entry.source_id,
               entry.created_by_user_id,entry.effect_multiplier,entry.reversal_of_entry_id,
               entry.corrects_entry_id,entry.correction_reason,entry.allocation_bucket,
               (correction.id IS NOT NULL) AS corrected,
               correction.replacement_entry_id,
               correction.actor_user_id AS corrected_by_user_id,
               correction.created_at AS corrected_at,
               entry.created_at,entry.updated_at
        FROM business_finance_entries entry
        LEFT JOIN business_finance_entry_corrections correction ON correction.original_entry_id=entry.id
        WHERE entry.business_id=$1 AND entry.organization_id=$2
        ORDER BY entry.occurred_on DESC,entry.created_at DESC,entry.id DESC
        LIMIT 250
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&state.db)
    .await;
    match items {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data": {"count": items.len(), "items": items}})),
        )
            .into_response(),
        Err(_) => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "finance_core_storage_unavailable",
        ),
    }
}

async fn create_entry(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateFinanceCoreEntryRequest>,
) -> Response {
    let (actor_id, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    match FinanceCoreRepository::new(state.db.clone())
        .create_manual_entry(actor_id, business_id, organization_id, key, payload)
        .await
    {
        Ok(outcome) => (
            if outcome.replayed { StatusCode::OK } else { StatusCode::CREATED },
            Json(json!({"data": outcome})),
        )
            .into_response(),
        Err(error) => finance_error_response(error),
    }
}

async fn correct_entry(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, entry_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CorrectFinanceEntryRequest>,
) -> Response {
    let (actor_id, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    match FinanceCoreRepository::new(state.db.clone())
        .correct_entry(
            actor_id,
            business_id,
            organization_id,
            entry_id,
            key,
            payload,
        )
        .await
    {
        Ok(outcome) => (StatusCode::OK, Json(json!({"data": outcome}))).into_response(),
        Err(error) => finance_error_response(error),
    }
}

async fn allocation_balances(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match FinanceCoreRepository::new(state.db.clone())
        .allocation_balances(business_id, organization_id)
        .await
    {
        Ok(items) => (StatusCode::OK, Json(json!({"data": {"items": items}}))).into_response(),
        Err(error) => finance_error_response(error),
    }
}

async fn move_allocation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<MoveAllocationRequest>,
) -> Response {
    let (actor_id, organization_id) = match finance_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    match FinanceCoreRepository::new(state.db.clone())
        .move_allocation(
            actor_id,
            business_id,
            organization_id,
            key,
            payload,
        )
        .await
    {
        Ok(outcome) => (StatusCode::OK, Json(json!({"data": outcome}))).into_response(),
        Err(error) => finance_error_response(error),
    }
}

async fn finance_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
) -> Result<(Uuid, Uuid), Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let service = BusinessService::new(
        BusinessRepository::new(state.db.clone()),
        ProductRepository::new(state.db.clone()),
        IdentityClient::new(
            state.http_client.clone(),
            state.identity_service_url.clone(),
        ),
    );
    let organization = service
        .organization_for_business(authorization, business_id)
        .await
        .map_err(service_error_response)?;
    if !organization.can_view_finance_controls() {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "business_finance_access_denied",
        ));
    }
    Ok((actor_id, organization.id))
}

fn idempotency_key(headers: &HeaderMap) -> Result<Uuid, Response> {
    let value = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| api_error(StatusCode::BAD_REQUEST, "missing_idempotency_key"))?;
    Uuid::parse_str(value)
        .map_err(|_| api_error(StatusCode::BAD_REQUEST, "invalid_idempotency_key"))
}

fn finance_error_response(error: FinanceCoreError) -> Response {
    match error {
        FinanceCoreError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        FinanceCoreError::NotFound => api_error(StatusCode::NOT_FOUND, "finance_entry_not_found"),
        FinanceCoreError::Conflict => api_error(StatusCode::CONFLICT, "finance_command_conflict"),
        FinanceCoreError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "finance_core_storage_unavailable",
        ),
    }
}

fn service_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => api_error(StatusCode::FORBIDDEN, "business_access_denied"),
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        _ => api_error(StatusCode::SERVICE_UNAVAILABLE, "business_context_unavailable"),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error": code}))).into_response()
}
