use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::config::AppState;

use super::{
    domain::CreateOrganizationRequest,
    repository::OrganizationRepository,
    service::{OrganizationService, OrganizationServiceError},
};

#[derive(Debug, Deserialize)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    exp: usize,
}

pub async fn list_organizations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor_user_id) => actor_user_id,
        Err(response) => return response,
    };
    let service = OrganizationService::new(OrganizationRepository::new(&state.db));

    match service.list(actor_user_id).await {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => service_error_response(error),
    }
}

pub async fn create_organization(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrganizationRequest>,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor_user_id) => actor_user_id,
        Err(response) => return response,
    };
    let service = OrganizationService::new(OrganizationRepository::new(&state.db));

    match service
        .create(actor_user_id, &payload.name, payload.slug.as_deref())
        .await
    {
        Ok(organization) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "organization": organization } })),
        )
            .into_response(),
        Err(error) => service_error_response(error),
    }
}

pub async fn get_organization(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor_user_id) => actor_user_id,
        Err(response) => return response,
    };
    let service = OrganizationService::new(OrganizationRepository::new(&state.db));

    match service.get(actor_user_id, organization_id).await {
        Ok(organization) => (
            StatusCode::OK,
            Json(json!({ "data": { "organization": organization } })),
        )
            .into_response(),
        Err(error) => service_error_response(error),
    }
}

pub async fn list_organization_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor_user_id) => actor_user_id,
        Err(response) => return response,
    };
    let service = OrganizationService::new(OrganizationRepository::new(&state.db));

    match service.members(actor_user_id, organization_id).await {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => service_error_response(error),
    }
}

fn authenticate_actor(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Uuid, axum::response::Response> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "missing token" })),
            )
                .into_response()
        })?;

    decode_actor(&state.config.jwt_secret, token).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "invalid token" })),
        )
            .into_response()
    })
}

fn decode_actor(secret: &str, token: &str) -> Option<Uuid> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let claims = decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .ok()?
    .claims;

    Uuid::parse_str(&claims.sub).ok()
}

fn service_error_response(error: OrganizationServiceError) -> axum::response::Response {
    match error {
        OrganizationServiceError::Validation(error) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": error.to_string() })),
        )
            .into_response(),
        OrganizationServiceError::Conflict => (
            StatusCode::CONFLICT,
            Json(json!({ "error": "organization name or slug already exists" })),
        )
            .into_response(),
        OrganizationServiceError::NotFound => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "organization not found" })),
        )
            .into_response(),
        OrganizationServiceError::Storage => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "organization service unavailable" })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    use super::*;

    #[derive(Serialize)]
    struct TestAccessClaims {
        sub: String,
        exp: usize,
        roles: Vec<String>,
        perms: Vec<String>,
        username: String,
    }

    fn token(secret: &str, subject: &str) -> String {
        encode(
            &Header::new(Algorithm::HS256),
            &TestAccessClaims {
                sub: subject.to_string(),
                exp: (Utc::now() + Duration::minutes(5)).timestamp() as usize,
                roles: vec!["member".to_string()],
                perms: Vec::new(),
                username: "workspace-owner".to_string(),
            },
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .expect("test token")
    }

    #[test]
    fn actor_token_requires_valid_signature_and_uuid_subject() {
        let secret = "organization-route-test-secret-long-enough";
        let actor_id = Uuid::new_v4();

        assert_eq!(
            decode_actor(secret, &token(secret, &actor_id.to_string())),
            Some(actor_id)
        );
        assert_eq!(
            decode_actor("different-secret", &token(secret, &actor_id.to_string())),
            None
        );
        assert_eq!(decode_actor(secret, &token(secret, "not-a-uuid")), None);
    }
}
