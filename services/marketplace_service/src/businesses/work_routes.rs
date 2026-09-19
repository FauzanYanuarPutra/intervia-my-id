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
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
    work::{CreateWorkItemRequest, UpdateWorkItemRequest, WorkRepository, WorkRepositoryError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/work",
            get(list).post(create),
        )
        .route(
            "/v1/businesses/{business_id}/work/sync",
            post(sync),
        )
        .route(
            "/v1/businesses/{business_id}/work/{work_id}",
            axum::routing::patch(update),
        )
}

#[derive(Debug, Default, Deserialize)]
struct WorkQuery {
    status: Option<String>,
    assignee_user_id: Option<Uuid>,
}

async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<WorkQuery>,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let organization = match service(&state)
        .organization_for_business(&authorization, business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return service_error_response(error),
    };

    if !organization.can_view_work() {
        return api_error(StatusCode::FORBIDDEN, "business_work_access_denied");
    }

    match WorkRepository::new(state.db.clone())
        .list(
            business_id,
            organization.id,
            query.status.as_deref(),
            query.assignee_user_id,
        )
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => work_error_response(error),
    }
}

async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateWorkItemRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let organization = match service(&state)
        .organization_for_business(&authorization, business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return service_error_response(error),
    };

    if !organization.can_manage_work() {
        return api_error(StatusCode::FORBIDDEN, "business_work_manage_denied");
    }

    match WorkRepository::new(state.db.clone())
        .create(actor_id, business_id, organization.id, payload)
        .await
    {
        Ok(work) => (
            StatusCode::CREATED,
            Json(json!({"data":{"work":work,"replayed":false}})),
        )
            .into_response(),
        Err(error) => work_error_response(error),
    }
}

async fn sync(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let organization = match service(&state)
        .organization_for_business(&authorization, business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return service_error_response(error),
    };

    if !organization.can_manage_work() {
        return api_error(StatusCode::FORBIDDEN, "business_work_manage_denied");
    }

    match WorkRepository::new(state.db.clone())
        .sync_suggestions(actor_id, business_id, organization.id)
        .await
    {
        Ok(created) => (
            StatusCode::OK,
            Json(json!({"data":{"created":created}})),
        )
            .into_response(),
        Err(error) => work_error_response(error),
    }
}

async fn update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, work_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateWorkItemRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let organization = match service(&state)
        .organization_for_business(&authorization, business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return service_error_response(error),
    };

    if !organization.can_view_work() {
        return api_error(StatusCode::FORBIDDEN, "business_work_access_denied");
    }

    match WorkRepository::new(state.db.clone())
        .update(
            actor_id,
            business_id,
            organization.id,
            work_id,
            payload,
            organization.can_manage_work(),
        )
        .await
    {
        Ok(work) => (
            StatusCode::OK,
            Json(json!({"data":{"work":work}})),
        )
            .into_response(),
        Err(error) => work_error_response(error),
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
) -> Result<(Uuid, String), Response> {
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .map(str::to_owned)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    Ok((actor_id, authorization))
}

fn service_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_not_found")
        }
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_context_unavailable",
        ),
    }
}

fn work_error_response(error: WorkRepositoryError) -> Response {
    match error {
        WorkRepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        WorkRepositoryError::Forbidden => api_error(StatusCode::FORBIDDEN, "business_work_forbidden"),
        WorkRepositoryError::NotFound => api_error(StatusCode::NOT_FOUND, "business_work_not_found"),
        WorkRepositoryError::Conflict => api_error(StatusCode::CONFLICT, "business_work_conflict"),
        WorkRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_work_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error": code}))).into_response()
}
