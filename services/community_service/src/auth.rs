use axum::http::{header, HeaderMap, StatusCode};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use crate::{ApiError, ApiResult, AppState};

#[derive(Debug, Deserialize, Default)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    exp: usize,
    #[serde(default)]
    roles: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    perms: Vec<String>,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct AuthActor {
    pub(crate) user_id: String,
    pub(crate) roles: Vec<String>,
    pub(crate) username: Option<String>,
    pub(crate) name: Option<String>,
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub(crate) fn optional_actor(headers: &HeaderMap, state: &AppState) -> Option<AuthActor> {
    let token = bearer_token(headers)?;
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let claims = decode::<AccessClaims>(
        &token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    )
    .ok()?
    .claims;

    Some(AuthActor {
        user_id: claims.sub,
        roles: claims.roles,
        username: claims.username,
        name: claims.name.or(claims.full_name).or(claims.display_name),
    })
}

pub(crate) fn require_actor(headers: &HeaderMap, state: &AppState) -> ApiResult<AuthActor> {
    optional_actor(headers, state)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Unauthorized"))
}

pub(crate) fn is_moderator(actor: &AuthActor) -> bool {
    actor.roles.iter().any(|role| {
        matches!(
            role.to_ascii_lowercase().as_str(),
            "admin" | "superadmin" | "moderator" | "forum:moderator" | "forum:admin"
        )
    })
}

pub(crate) fn request_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moderator_roles_are_explicit() {
        let actor = AuthActor {
            user_id: "user".to_string(),
            roles: vec!["moderator".to_string()],
            username: None,
            name: None,
        };
        assert!(is_moderator(&actor));
    }
}
