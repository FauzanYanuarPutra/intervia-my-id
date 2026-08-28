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
    domain::{CreateOrganizationRequest, EnsureOrganizationRequest},
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
        Err(error) => return actor_auth_error_response(error),
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
        Err(error) => return actor_auth_error_response(error),
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

pub async fn ensure_organization(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<EnsureOrganizationRequest>,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor_user_id) => actor_user_id,
        Err(error) => return actor_auth_error_response(error),
    };
    let raw_idempotency_key = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok());
    let idempotency_key = match parse_idempotency_key(raw_idempotency_key) {
        Ok(key) => key,
        Err(error) => {
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))).into_response()
        }
    };
    let service = OrganizationService::new(OrganizationRepository::new(&state.db));

    match service
        .ensure(actor_user_id, idempotency_key, &payload.name)
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
                    "organization": outcome.organization,
                    "replayed": outcome.replayed,
                }
            })),
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
        Err(error) => return actor_auth_error_response(error),
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
        Err(error) => return actor_auth_error_response(error),
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

fn authenticate_actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, ActorAuthError> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or(ActorAuthError::MissingToken)?;

    decode_actor(&state.config.jwt_secret, token).ok_or(ActorAuthError::InvalidToken)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ActorAuthError {
    MissingToken,
    InvalidToken,
}

fn actor_auth_error_response(error: ActorAuthError) -> axum::response::Response {
    let message = match error {
        ActorAuthError::MissingToken => "missing token",
        ActorAuthError::InvalidToken => "invalid token",
    };
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": message }))).into_response()
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

fn parse_idempotency_key(value: Option<&str>) -> Result<Uuid, &'static str> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
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
        OrganizationServiceError::IdempotencyConflict => (
            StatusCode::CONFLICT,
            Json(json!({ "error": "idempotency_conflict" })),
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

    #[test]
    fn provisioning_requires_a_uuid_idempotency_key() {
        let expected =
            Uuid::parse_str("33333333-3333-4333-8333-333333333333").expect("valid fixture");

        assert_eq!(
            parse_idempotency_key(Some("33333333-3333-4333-8333-333333333333")),
            Ok(expected),
        );
        assert_eq!(parse_idempotency_key(None), Err("missing_idempotency_key"));
        assert_eq!(
            parse_idempotency_key(Some("not-a-uuid")),
            Err("invalid_idempotency_key"),
        );
    }
}
