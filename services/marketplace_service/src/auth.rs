use axum::http::HeaderMap;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub(crate) struct AccessClaims {
    pub(crate) sub: String,
    #[allow(dead_code)]
    pub(crate) exp: usize,
    #[serde(default)]
    pub(crate) roles: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub(crate) perms: Vec<String>,
}

pub(crate) fn auth_claims_from_headers(
    headers: &HeaderMap,
    jwt_secret: &str,
) -> Option<AccessClaims> {
    let header = headers
        .get("authorization")
        .or_else(|| headers.get("Authorization"))
        .and_then(|v| v.to_str().ok())?;
    if !header.starts_with("Bearer ") {
        return None;
    }
    let token = header.trim_start_matches("Bearer ").trim();
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )
    .ok()
    .map(|d| d.claims)
}

pub(crate) fn user_id_from_auth(headers: &HeaderMap, jwt_secret: &str) -> Option<Uuid> {
    auth_claims_from_headers(headers, jwt_secret).and_then(|c| Uuid::parse_str(&c.sub).ok())
}

pub(crate) fn user_id_from_token_string(token: &str, jwt_secret: &str) -> Option<Uuid> {
    let cleaned = token
        .trim()
        .trim_start_matches("Bearer ")
        .trim_start_matches("bearer ")
        .trim();
    if cleaned.is_empty() {
        return None;
    }
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<AccessClaims>(
        cleaned,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )
    .ok()
    .and_then(|decoded| Uuid::parse_str(&decoded.claims.sub).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_tokens_do_not_authenticate() {
        assert!(user_id_from_token_string("", "test-secret").is_none());
        assert!(user_id_from_token_string("Bearer not-a-jwt", "test-secret").is_none());
    }
}
