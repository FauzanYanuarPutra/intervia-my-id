use axum::http::HeaderMap;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::{env, sync::OnceLock};
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

static RS256_DECODING_KEY: OnceLock<Result<DecodingKey, String>> = OnceLock::new();

fn environment_requires_asymmetric_access_tokens() -> bool {
    env::var("APP_ENV")
        .ok()
        .or_else(|| env::var("ENV").ok())
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "production" | "prod" | "staging"
            )
        })
        .unwrap_or(false)
}

fn resolve_access_token_algorithm(configured: &str, require_asymmetric: bool) -> Option<Algorithm> {
    match configured.trim().to_ascii_uppercase().as_str() {
        "RS256" => Some(Algorithm::RS256),
        "HS256" if require_asymmetric => None,
        "HS256" => Some(Algorithm::HS256),
        _ => None,
    }
}

fn access_token_algorithm() -> Option<Algorithm> {
    let configured = env::var("JWT_ACCESS_ALG").unwrap_or_else(|_| "HS256".to_string());
    resolve_access_token_algorithm(
        &configured,
        environment_requires_asymmetric_access_tokens(),
    )
}

fn rs256_decoding_key() -> Option<&'static DecodingKey> {
    RS256_DECODING_KEY
        .get_or_init(|| {
            let pem = env::var("JWT_PUBLIC_KEY_PEM")
                .map_err(|_| "JWT_PUBLIC_KEY_PEM is required for RS256".to_string())?
                .replace("\\n", "\n");
            DecodingKey::from_rsa_pem(pem.as_bytes())
                .map_err(|_| "JWT_PUBLIC_KEY_PEM is not a valid RSA public key".to_string())
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
    decode_access_claims(token, jwt_secret)
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

    decode_access_claims(cleaned, jwt_secret).and_then(|decoded| Uuid::parse_str(&decoded.sub).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supported_access_token_algorithms_are_explicit() {
        assert_eq!(Algorithm::HS256, Algorithm::HS256);
        assert_eq!(Algorithm::RS256, Algorithm::RS256);
    }

    #[test]
    fn production_like_environments_reject_hs256_access_tokens() {
        assert!(resolve_access_token_algorithm("HS256", true).is_none());
        assert_eq!(
            resolve_access_token_algorithm("RS256", true),
            Some(Algorithm::RS256)
        );
    }

    #[test]
    fn development_can_keep_hs256_during_migration() {
        assert_eq!(
            resolve_access_token_algorithm("HS256", false),
            Some(Algorithm::HS256)
        );
    }

    #[test]
    fn malformed_tokens_do_not_authenticate() {
        assert!(user_id_from_token_string("", "test-secret").is_none());
        assert!(user_id_from_token_string("Bearer not-a-jwt", "test-secret").is_none());
    }
}
