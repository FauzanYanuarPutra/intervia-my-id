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

use super::{
    identity_client::IdentityClient,
    period_control::{
        CloseDayRequest, ClosePeriodRequest, PeriodControlError, PeriodControlRepository,
        ReopenDayRequest, ReopenPeriodRequest,
    },
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/period-controls/periods",
            get(list_periods).post(close_period),
        )
        .route(
            "/v1/businesses/{business_id}/period-controls/periods/{period_id}/reopen",
            post(reopen_period),
        )
        .route(
            "/v1/businesses/{business_id}/period-controls/days",
            get(list_days).post(close_day),
        )
        .route(
            "/v1/businesses/{business_id}/period-controls/days/{day_id}/reopen",
            post(reopen_day),
        )
}

#[derive(Debug, Deserialize)]
struct DayListQuery {
    #[serde(default = "default_limit")]
    limit: i64,
}

const fn default_limit() -> i64 {
    200
}

async fn list_periods(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match PeriodControlRepository::new(state.db.clone())
        .list_periods(business_id, organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => period_error_response(error),
    }
}

async fn close_period(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<ClosePeriodRequest>,
) -> Response {
    let (actor_id, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match PeriodControlRepository::new(state.db.clone())
        .close_period(actor_id, business_id, organization_id, key, payload)
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
        Err(error) => period_error_response(error),
    }
}

async fn reopen_period(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, period_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReopenPeriodRequest>,
) -> Response {
    let (actor_id, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match PeriodControlRepository::new(state.db.clone())
        .reopen_period(
            actor_id,
            business_id,
            organization_id,
            period_id,
            key,
            payload,
        )
        .await
    {
        Ok(outcome) => (StatusCode::OK, Json(json!({"data":outcome}))).into_response(),
        Err(error) => period_error_response(error),
    }
}

async fn list_days(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Query(query): Query<DayListQuery>,
) -> Response {
    let (_, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match PeriodControlRepository::new(state.db.clone())
        .list_days(business_id, organization_id, query.limit)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => period_error_response(error),
    }
}

async fn close_day(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CloseDayRequest>,
) -> Response {
    let (actor_id, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match PeriodControlRepository::new(state.db.clone())
        .close_day(actor_id, business_id, organization_id, key, payload)
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
        Err(error) => period_error_response(error),
    }
}

async fn reopen_day(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, day_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReopenDayRequest>,
) -> Response {
    let (actor_id, organization_id) = match control_context(&state, &headers, business_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match PeriodControlRepository::new(state.db.clone())
        .reopen_day(
            actor_id,
            business_id,
            organization_id,
            day_id,
            key,
            payload,
        )
        .await
    {
        Ok(outcome) => (StatusCode::OK, Json(json!({"data":outcome}))).into_response(),
        Err(error) => period_error_response(error),
    }
}

async fn control_context(
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
    if !organization.can_manage_finance_controls() {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "business_period_control_access_denied",
        ));
    }
    Ok((actor_id, organization.id))
}

fn idempotency_key(headers: &HeaderMap) -> Result<Uuid, &'static str> {
    let value = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn period_error_response(error: PeriodControlError) -> Response {
    match error {
        PeriodControlError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        PeriodControlError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "period_control_not_found")
        }
        PeriodControlError::Conflict => {
            api_error(StatusCode::CONFLICT, "period_control_conflict")
        }
        PeriodControlError::PeriodClosed => {
            api_error(StatusCode::CONFLICT, "business_period_closed")
        }
        PeriodControlError::DayClosed => {
            api_error(StatusCode::CONFLICT, "business_day_closed")
        }
        PeriodControlError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "period_control_storage_unavailable",
        ),
    }
}

fn service_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_context_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error":code}))).into_response()
}
