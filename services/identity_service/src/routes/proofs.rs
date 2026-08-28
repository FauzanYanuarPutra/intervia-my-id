use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::config::AppState;

const OTP_VERIFICATION_PREFIX: &str = "otp:verify:";
const IDENTITY_VERIFICATION_PROOF_PREFIX: &str = "identity:verification:proof:";

#[derive(Debug, Deserialize)]
struct OtpVerificationPayload {
    #[serde(rename = "type")]
    kind: String,
    target: String,
    purpose: String,
}

#[derive(Debug, Deserialize)]
struct IdentityVerificationProofPayload {
    user_id: String,
    verification: Value,
}

fn normalize_phone(raw: &str) -> String {
    raw.chars().filter(|ch| ch.is_ascii_digit()).collect()
}

fn normalize_proof_token(raw: &str) -> Option<&str> {
    let token = raw.trim();
    if !(32..=128).contains(&token.len())
        || !token
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return None;
    }
    Some(token)
}

fn valid_phone_otp_payload(raw: &str, expected_phone: &str, allowed_purposes: &[&str]) -> bool {
    let Ok(payload) = serde_json::from_str::<OtpVerificationPayload>(raw) else {
        return false;
    };

    payload.kind == "phone"
        && normalize_phone(&payload.target) == normalize_phone(expected_phone)
        && allowed_purposes
            .iter()
            .any(|purpose| payload.purpose == *purpose)
}

fn identity_verification_from_payload(raw: &str, expected_user_id: Uuid) -> Option<Value> {
    let payload = serde_json::from_str::<IdentityVerificationProofPayload>(raw).ok()?;
    if Uuid::parse_str(payload.user_id.trim()).ok()? != expected_user_id
        || !payload.verification.is_object()
    {
        return None;
    }
    Some(payload.verification)
}

async fn read_redis_value(state: &AppState, key: &str) -> Result<Option<String>> {
    let mut connection = state
        .redis
        .get()
        .await
        .context("failed to acquire Redis connection for identity proof")?;
    let raw: Option<String> = deadpool_redis::redis::cmd("GET")
        .arg(key)
        .query_async(&mut connection)
        .await
        .context("failed to read identity proof")?;
    Ok(raw)
}

async fn consume_redis_value(state: &AppState, key: &str) -> Result<Option<String>> {
    let mut connection = state
        .redis
        .get()
        .await
        .context("failed to acquire Redis connection for identity proof")?;
    let raw: Option<String> = deadpool_redis::redis::cmd("GETDEL")
        .arg(key)
        .query_async(&mut connection)
        .await
        .context("failed to consume identity proof")?;
    Ok(raw)
}

pub(crate) async fn validate_phone_otp_proof(
    state: &AppState,
    token: &str,
    expected_phone: &str,
    allowed_purposes: &[&str],
) -> Result<bool> {
    let Some(token) = normalize_proof_token(token) else {
        return Ok(false);
    };
    let key = format!("{OTP_VERIFICATION_PREFIX}{token}");
    let Some(raw) = read_redis_value(state, &key).await? else {
        return Ok(false);
    };
    Ok(valid_phone_otp_payload(
        &raw,
        expected_phone,
        allowed_purposes,
    ))
}

pub(crate) async fn consume_phone_otp_proof(
    state: &AppState,
    token: &str,
    expected_phone: &str,
    allowed_purposes: &[&str],
) -> Result<bool> {
    let Some(token) = normalize_proof_token(token) else {
        return Ok(false);
    };
    let key = format!("{OTP_VERIFICATION_PREFIX}{token}");
    let Some(raw) = consume_redis_value(state, &key).await? else {
        return Ok(false);
    };
    Ok(valid_phone_otp_payload(
        &raw,
        expected_phone,
        allowed_purposes,
    ))
}

pub(crate) async fn consume_identity_verification_proof(
    state: &AppState,
    token: &str,
    expected_user_id: Uuid,
) -> Result<Option<Value>> {
    let Some(token) = normalize_proof_token(token) else {
        return Ok(None);
    };
    let key = format!("{IDENTITY_VERIFICATION_PROOF_PREFIX}{token}");
    let Some(raw) = consume_redis_value(state, &key).await? else {
        return Ok(None);
    };
    Ok(identity_verification_from_payload(&raw, expected_user_id))
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{identity_verification_from_payload, valid_phone_otp_payload};

    #[test]
    fn phone_otp_proof_is_bound_to_phone_and_purpose() {
        let raw = json!({
            "type": "phone",
            "target": "+62 812-3456-7890",
            "purpose": "login"
        })
        .to_string();

        assert!(valid_phone_otp_payload(
            &raw,
            "6281234567890",
            &["login", "register"]
        ));
        assert!(!valid_phone_otp_payload(
            &raw,
            "6281234567891",
            &["login", "register"]
        ));
        assert!(!valid_phone_otp_payload(
            &raw,
            "6281234567890",
            &["profile"]
        ));
    }

    #[test]
    fn identity_verification_proof_is_bound_to_user() {
        let user_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();
        let raw = json!({
            "user_id": user_id,
            "verification": { "identity_verified": true }
        })
        .to_string();

        assert!(identity_verification_from_payload(&raw, user_id).is_some());
        assert!(identity_verification_from_payload(&raw, other_user_id).is_none());
    }
}
