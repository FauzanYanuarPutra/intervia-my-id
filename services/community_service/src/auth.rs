use axum::http::{header, HeaderMap, StatusCode};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::env;

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

#[derive(Clone)]
pub(crate) struct JwtVerifier {
    legacy_secret: String,
    public_key_pem: Option<String>,
    allow_legacy_hs256: bool,
}

impl JwtVerifier {
    pub(crate) fn from_env(legacy_secret: String) -> anyhow::Result<Self> {
        let public_key_pem = env::var("JWT_PUBLIC_KEY_PEM")
            .ok()
            .map(|value| value.replace("\\n", "\n").trim().to_string())
            .filter(|value| !value.is_empty());
        let allow_legacy_hs256 = env::var("JWT_ALLOW_LEGACY_HS256")
            .ok()
            .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(true);

        if let Some(public_key_pem) = public_key_pem.as_deref() {
            DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
                .map_err(|error| anyhow::anyhow!("invalid JWT_PUBLIC_KEY_PEM: {error:?}"))?;
        } else if !allow_legacy_hs256 {
            anyhow::bail!("JWT_PUBLIC_KEY_PEM is required when legacy HS256 verification is disabled");
        }

        Ok(Self {
            legacy_secret,
            public_key_pem,
            allow_legacy_hs256,
        })
    }

    fn decode_claims(&self, token: &str) -> Option<AccessClaims> {
        let header = decode_header(token).ok()?;
        match header.alg {
            Algorithm::RS256 => {
                let public_key_pem = self.public_key_pem.as_deref()?;
                let mut validation = Validation::new(Algorithm::RS256);
                validation.validate_exp = true;
                decode::<AccessClaims>(
                    token,
                    &DecodingKey::from_rsa_pem(public_key_pem.as_bytes()).ok()?,
                    &validation,
                )
                .ok()
                .map(|decoded| decoded.claims)
            }
            Algorithm::HS256 if self.allow_legacy_hs256 => {
                let mut validation = Validation::new(Algorithm::HS256);
                validation.validate_exp = true;
                decode::<AccessClaims>(
                    token,
                    &DecodingKey::from_secret(self.legacy_secret.as_bytes()),
                    &validation,
                )
                .ok()
                .map(|decoded| decoded.claims)
            }
            _ => None,
        }
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
    let claims = state.jwt_verifier.decode_claims(&token)?;

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
