use axum::http::{header, HeaderMap, StatusCode};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::{env, sync::OnceLock};

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

static RS256_DECODING_KEY: OnceLock<Result<DecodingKey, String>> = OnceLock::new();

fn access_token_algorithm() -> Option<Algorithm> {
    match env::var("JWT_ACCESS_ALG")
        .unwrap_or_else(|_| "HS256".to_string())
        .trim()
        .to_ascii_uppercase()
        .as_str()
    {
        "HS256" => Some(Algorithm::HS256),
        "RS256" => Some(Algorithm::RS256),
        _ => None,
    }
}

fn rs256_decoding_key() -> Option<&'static DecodingKey> {
    RS256_DECODING_KEY
        .get_or_init(|| {
            let encoded = env::var("JWT_PUBLIC_KEY_PEM_B64")
                .map_err(|_| "JWT_PUBLIC_KEY_PEM_B64 is required for RS256".to_string())?;
            let pem = STANDARD
                .decode(encoded.trim())
                .map_err(|_| "JWT_PUBLIC_KEY_PEM_B64 is not valid base64".to_string())?;
            DecodingKey::from_rsa_pem(&pem)
                .map_err(|_| "JWT_PUBLIC_KEY_PEM_B64 is not a valid RSA public key".to_string())
        })
        .as_ref()
        .ok()
}

fn validation(algorithm: Algorithm) -> Validation {
    let mut validation = Validation::new(algorithm);
    validation.validate_exp = true;

    if algorithm == Algorithm::RS256 {
        if let Ok(issuer) = env::var("JWT_ISSUER") {
            let issuer = issuer.trim();
            if !issuer.is_empty() {
                validation.set_issuer(&[issuer]);
            }
        }
        if let Ok(audience) = env::var("JWT_AUDIENCE") {
            let audience = audience.trim();
            if !audience.is_empty() {
                validation.set_audience(&[audience]);
            }
        }
    }

    validation
}

fn decode_access_claims(token: &str, jwt_secret: &str) -> Option<AccessClaims> {
    let algorithm = access_token_algorithm()?;
    match algorithm {
        Algorithm::RS256 => {
            let key = rs256_decoding_key()?;
            decode::<AccessClaims>(token, key, &validation(algorithm))
                .ok()
                .map(|decoded| decoded.claims)
        }
        Algorithm::HS256 => decode::<AccessClaims>(
            token,
            &DecodingKey::from_secret(jwt_secret.as_bytes()),
            &validation(algorithm),
        )
        .ok()
        .map(|decoded| decoded.claims),
        _ => None,
    }
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
    let claims = decode_access_claims(&token, &state.jwt_secret)?;

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

    #[test]
    fn malformed_tokens_do_not_authenticate() {
        assert!(decode_access_claims("not-a-jwt", "test-secret").is_none());
    }
}
