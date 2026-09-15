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
    product_modifiers::{
        ProductModifierError, ProductModifierRepository, ReplaceProductModifiersRequest,
    },
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/businesses/{business_id}/products/{product_id}/modifiers",
        get(get_modifiers).put(replace_modifiers),
    )
}

async fn get_modifiers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let organization_id = match modifier_context(&state, &headers, business_id).await {
        Ok((_, organization_id)) => organization_id,
        Err(response) => return response,
    };
    match ProductModifierRepository::new(state.db.clone())
        .get(business_id, organization_id, product_id)
        .await
    {
        Ok(modifiers) => (StatusCode::OK, Json(json!({ "data": { "modifiers": modifiers } }))).into_response(),
        Err(error) => modifier_error_response(error),
    }
}

async fn replace_modifiers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReplaceProductModifiersRequest>,
) -> Response {
    let (actor_id, organization_id) = match modifier_context(&state, &headers, business_id).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    match ProductModifierRepository::new(state.db.clone())
        .replace(actor_id, business_id, organization_id, product_id, payload)
        .await
    {
        Ok(modifiers) => (StatusCode::OK, Json(json!({ "data": { "modifiers": modifiers } }))).into_response(),
        Err(error) => modifier_error_response(error),
    }
}

async fn modifier_context(
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
    let organization = service(state)
        .organization_for_business(authorization, business_id)
        .await
        .map_err(business_error_response)?;
    if !organization.can_manage_catalog() {
        return Err(api_error(StatusCode::FORBIDDEN, "business_access_denied"));
    }
    Ok((actor_id, organization.id))
}

fn service(state: &AppState) -> BusinessService {
    BusinessService::new(
        BusinessRepository::new(state.db.clone()),
        ProductRepository::new(state.db.clone()),
        IdentityClient::new(state.http_client.clone(), state.identity_service_url.clone()),
    )
}

fn modifier_error_response(error: ProductModifierError) -> Response {
    match error {
        ProductModifierError::NotFound => api_error(StatusCode::NOT_FOUND, "product_not_found"),
        ProductModifierError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        ProductModifierError::Database => api_error(StatusCode::SERVICE_UNAVAILABLE, "product_modifier_storage_unavailable"),
    }
}

fn business_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => api_error(StatusCode::FORBIDDEN, "business_access_denied"),
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        BusinessServiceError::IdentityUnavailable => api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable"),
        _ => api_error(StatusCode::SERVICE_UNAVAILABLE, "business_unavailable"),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}
