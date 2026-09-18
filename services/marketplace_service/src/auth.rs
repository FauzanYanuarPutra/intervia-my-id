use axum::http::HeaderMap;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::env;
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

pub(crate) fn auth_claims_from_headers(
    headers: &HeaderMap,
    verifier: &JwtVerifier,
) -> Option<AccessClaims> {
    let header = headers
        .get("authorization")
        .or_else(|| headers.get("Authorization"))
        .and_then(|v| v.to_str().ok())?;
    if !header.starts_with("Bearer ") {
        return None;
    }
    verifier.decode_claims(header.trim_start_matches("Bearer ").trim())
}

pub(crate) fn user_id_from_auth(headers: &HeaderMap, verifier: &JwtVerifier) -> Option<Uuid> {
    auth_claims_from_headers(headers, verifier).and_then(|c| Uuid::parse_str(&c.sub).ok())
}

pub(crate) fn user_id_from_token_string(token: &str, verifier: &JwtVerifier) -> Option<Uuid> {
    let cleaned = token
        .trim()
        .trim_start_matches("Bearer ")
        .trim_start_matches("bearer ")
        .trim();
    if cleaned.is_empty() {
        return None;
    }
    verifier
        .decode_claims(cleaned)
        .and_then(|decoded| Uuid::parse_str(&decoded.sub).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn legacy_verifier() -> JwtVerifier {
        JwtVerifier {
            legacy_secret: "test-secret".to_string(),
            public_key_pem: None,
            allow_legacy_hs256: true,
        }
    }

    #[test]
    fn malformed_tokens_do_not_authenticate() {
        let verifier = legacy_verifier();
        assert!(user_id_from_token_string("", &verifier).is_none());
        assert!(user_id_from_token_string("Bearer not-a-jwt", &verifier).is_none());
    }
}
