use chrono::{DateTime, Utc};
use reqwest::RequestBuilder;
use serde_json::{json, Value};
use sha2::{Digest, Sha512};
use std::{env, error::Error};
use uuid::Uuid;

use crate::{
    clean_text, MAX_TOPUP_CENTS_DEV, MAX_TOPUP_CENTS_LIVE, MAX_WITHDRAWAL_CENTS_DEV,
    MAX_WITHDRAWAL_CENTS_LIVE, MIN_TOPUP_CENTS_DEV, MIN_TOPUP_CENTS_LIVE, MIN_WITHDRAWAL_CENTS_DEV,
    MIN_WITHDRAWAL_CENTS_LIVE,
};

pub(crate) fn normalize_currency(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_uppercase())
}

pub(crate) fn is_valid_currency(value: &str) -> bool {
    value.len() == 3 && value.chars().all(|c| c.is_ascii_uppercase())
}

pub(crate) fn parse_env_bool(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(raw) => matches!(
            raw.trim().to_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

pub(crate) fn wallet_default_environment() -> String {
    normalize_wallet_environment(env::var("WALLET_DEFAULT_ENV").ok())
        .unwrap_or_else(|| "development".to_string())
}

pub(crate) fn payments_enabled() -> bool {
    parse_env_bool("PAYMENTS_ENABLED", false)
}

pub(crate) fn wallet_live_enabled() -> bool {
    parse_env_bool("WALLET_LIVE_ENABLED", false)
}

pub(crate) fn wallet_default_provider() -> String {
    normalize_payment_provider(env::var("WALLET_DEFAULT_PROVIDER").ok())
        .unwrap_or_else(|| "mock".to_string())
}

pub(crate) fn normalize_wallet_environment(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "dev" | "development" | "sandbox" | "test" => "development".to_string(),
        "live" | "production" | "prod" => "live".to_string(),
        other => other.to_string(),
    })
}

pub(crate) fn is_valid_wallet_environment(value: &str) -> bool {
    matches!(value, "development" | "live")
}

pub(crate) fn normalize_payment_provider(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "midtrans" => "midtrans".to_string(),
        "stripe" => "stripe".to_string(),
        "xendit" => "xendit".to_string(),
        "paypal" => "paypal".to_string(),
        "adyen" => "adyen".to_string(),
        "manual" => "manual".to_string(),
        "mock" | "test" | "sandbox" => "mock".to_string(),
        other => other.to_string(),
    })
}

pub(crate) fn is_valid_payment_provider(value: &str) -> bool {
    matches!(
        value,
        "midtrans" | "stripe" | "xendit" | "paypal" | "adyen" | "manual" | "mock"
    )
}

pub(crate) fn normalize_topup_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending" => "pending".to_string(),
        "paid" | "success" | "settled" => "paid".to_string(),
        "failed" => "failed".to_string(),
        "cancelled" | "canceled" => "cancelled".to_string(),
        "expired" => "expired".to_string(),
        other => other.to_string(),
    })
}

pub(crate) fn is_valid_topup_status(value: &str) -> bool {
    matches!(
        value,
        "pending" | "paid" | "failed" | "cancelled" | "expired"
    )
}

pub(crate) fn normalize_withdrawal_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending" | "pending_review" | "review" => "pending_review".to_string(),
        "processing" | "process" => "processing".to_string(),
        "completed" | "paid" | "success" => "completed".to_string(),
        "cancelled" | "canceled" => "cancelled".to_string(),
        "failed" => "failed".to_string(),
        "rejected" | "declined" => "rejected".to_string(),
        other => other.to_string(),
    })
}

pub(crate) fn is_valid_withdrawal_status(value: &str) -> bool {
    matches!(
        value,
        "pending_review" | "processing" | "completed" | "cancelled" | "failed" | "rejected"
    )
}

pub(crate) fn normalize_payment_method(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

pub(crate) fn topup_amount_range(environment: &str) -> (i64, i64) {
    if environment == "live" {
        (MIN_TOPUP_CENTS_LIVE, MAX_TOPUP_CENTS_LIVE)
    } else {
        (MIN_TOPUP_CENTS_DEV, MAX_TOPUP_CENTS_DEV)
    }
}

pub(crate) fn withdrawal_amount_range(environment: &str) -> (i64, i64) {
    if environment == "live" {
        (MIN_WITHDRAWAL_CENTS_LIVE, MAX_WITHDRAWAL_CENTS_LIVE)
    } else {
        (MIN_WITHDRAWAL_CENTS_DEV, MAX_WITHDRAWAL_CENTS_DEV)
    }
}

pub(crate) fn normalize_bank_code(value: Option<String>) -> Option<String> {
    clean_text(value)
        .map(|v| {
            v.to_lowercase()
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .take(32)
                .collect::<String>()
        })
        .filter(|v| !v.is_empty())
}

pub(crate) fn normalize_bank_account_number(value: Option<String>) -> Option<String> {
    clean_text(value)
        .map(|v| v.chars().filter(|c| c.is_ascii_digit()).collect::<String>())
        .filter(|v| !v.is_empty())
}

pub(crate) fn mask_bank_account_number(account_number: &str) -> String {
    let last4 = account_number
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();
    format!("****{}", last4)
}

pub(crate) fn hash_bank_account_number(
    secret: &str,
    bank_code: &str,
    account_number: &str,
) -> String {
    let mut hasher = Sha512::new();
    hasher.update(secret.as_bytes());
    hasher.update(b":wallet-withdrawal:");
    hasher.update(bank_code.as_bytes());
    hasher.update(b":");
    hasher.update(account_number.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

pub(crate) fn parse_env_i64(key: &str) -> Option<i64> {
    env::var(key)
        .ok()
        .and_then(|raw| raw.trim().parse::<i64>().ok())
        .filter(|v| *v > 0)
}

pub(crate) fn wallet_topup_timeout_minutes(environment: &str, provider: &str) -> i64 {
    let provider_tag = provider.trim().to_uppercase().replace('-', "_");
    let env_suffix = if environment == "live" { "LIVE" } else { "DEV" };
    let provider_env_key = format!(
        "WALLET_{}_TOPUP_TIMEOUT_MINUTES_{}",
        provider_tag, env_suffix
    );
    let provider_key = format!("WALLET_{}_TOPUP_TIMEOUT_MINUTES", provider_tag);
    let env_key = format!("WALLET_TOPUP_TIMEOUT_MINUTES_{}", env_suffix);

    let fallback_default = if provider == "midtrans" { 24 * 60 } else { 60 };
    parse_env_i64(&provider_env_key)
        .or_else(|| parse_env_i64(&provider_key))
        .or_else(|| parse_env_i64(&env_key))
        .or_else(|| parse_env_i64("WALLET_TOPUP_TIMEOUT_MINUTES"))
        .unwrap_or(fallback_default)
        .clamp(1, 7 * 24 * 60)
}

pub(crate) fn parse_wallet_datetime(value: &str) -> Option<DateTime<Utc>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    DateTime::parse_from_rfc3339(trimmed)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            DateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S %z")
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        })
}

pub(crate) fn extract_topup_payment_due_at(payment_payload: &Value) -> Option<DateTime<Utc>> {
    let candidates = [
        payment_payload
            .pointer("/wallet_flow/payment_due_at")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/midtrans/expiry_time")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/charge/expiry_time")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/snap/expiry_time")
            .and_then(Value::as_str),
    ];
    candidates
        .into_iter()
        .flatten()
        .find_map(parse_wallet_datetime)
}

pub(crate) fn midtrans_api_base_url(environment: &str) -> &'static str {
    if environment == "live" {
        "https://api.midtrans.com"
    } else {
        "https://api.sandbox.midtrans.com"
    }
}

pub(crate) fn midtrans_snap_base_url(environment: &str) -> &'static str {
    if environment == "live" {
        "https://app.midtrans.com"
    } else {
        "https://app.sandbox.midtrans.com"
    }
}

pub(crate) fn describe_reqwest_error(error: &reqwest::Error) -> String {
    let kind = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_request() {
        "request"
    } else if error.is_decode() {
        "decode"
    } else if error.is_body() {
        "body"
    } else if error.is_status() {
        "status"
    } else {
        "unknown"
    };

    let mut causes = Vec::new();
    let mut current = error.source();
    while let Some(cause) = current {
        causes.push(cause.to_string());
        current = cause.source();
    }

    if causes.is_empty() {
        format!("type={kind}; message={error}")
    } else {
        format!(
            "type={kind}; message={error}; causes={}",
            causes.join(" | ")
        )
    }
}

pub(crate) fn build_external_reference(environment: &str, provider: &str, user_id: Uuid) -> String {
    let prefix = if environment == "live" {
        "TOPUP-LIVE"
    } else {
        "TOPUP-DEV"
    };
    let provider_tag = provider.to_uppercase();
    let user_tag = user_id.simple().to_string()[..8].to_uppercase();
    let random_tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    format!("{prefix}-{provider_tag}-{user_tag}-{random_tag}")
}

pub(crate) fn clean_env_value(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| {
            let lowered = value.to_lowercase();
            !value.is_empty()
                && !lowered.starts_with("replace_with_")
                && !matches!(
                    lowered.as_str(),
                    "change_me" | "changeme" | "your_key_here" | "your_server_key"
                )
        })
}

pub(crate) fn app_env_is_production() -> bool {
    env::var("ENV")
        .or_else(|_| env::var("APP_ENV"))
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

pub(crate) fn midtrans_server_key_for_environment(environment: &str) -> Option<String> {
    if environment == "live" {
        let live_key = clean_env_value("MIDTRANS_SERVER_KEY_LIVE").or_else(|| {
            if app_env_is_production() {
                None
            } else {
                clean_env_value("MIDTRANS_SERVER_KEY")
            }
        })?;
        if live_key.starts_with("SB-") {
            tracing::error!("MIDTRANS_SERVER_KEY_LIVE appears to be a sandbox key");
            return None;
        }
        return Some(live_key);
    }

    let sandbox_key = clean_env_value("MIDTRANS_SERVER_KEY_SANDBOX")
        .or_else(|| clean_env_value("MIDTRANS_SERVER_KEY"))?;
    if sandbox_key.starts_with("Mid-server-") {
        tracing::error!("MIDTRANS_SERVER_KEY_SANDBOX appears to be a live key");
        return None;
    }
    Some(sandbox_key)
}

pub(crate) fn midtrans_notification_url() -> Option<String> {
    env::var("WALLET_MIDTRANS_NOTIFICATION_URL")
        .ok()
        .or_else(|| env::var("MIDTRANS_PAYMENT_NOTIFICATION_URL").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(crate) fn with_midtrans_notification_header(request: RequestBuilder) -> RequestBuilder {
    if let Some(url) = midtrans_notification_url() {
        request.header("X-Override-Notification", url)
    } else {
        request
    }
}

pub(crate) fn midtrans_redirect_url(topup_id: Uuid, kind: &str) -> Option<String> {
    let (legacy_key, key, status_value) = match kind {
        "finish" => (
            "MIDTRANS_FINISH_REDIRECT_URL",
            "WALLET_MIDTRANS_FINISH_REDIRECT_URL",
            "finish",
        ),
        "unfinish" => (
            "MIDTRANS_UNFINISH_REDIRECT_URL",
            "WALLET_MIDTRANS_UNFINISH_REDIRECT_URL",
            "unfinish",
        ),
        "error" => (
            "MIDTRANS_ERROR_REDIRECT_URL",
            "WALLET_MIDTRANS_ERROR_REDIRECT_URL",
            "error",
        ),
        _ => return None,
    };

    let base = env::var(key)
        .ok()
        .or_else(|| env::var(legacy_key).ok())
        .or_else(|| env::var("FRONTEND_URL").ok())?;
    let base = base.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return None;
    }

    let url = if base.contains("/payments") {
        base
    } else {
        format!("{base}/payments")
    };
    Some(midtrans_redirect_url_with_status(
        url,
        topup_id,
        status_value,
    ))
}

pub(crate) fn midtrans_redirect_url_with_status(
    url: String,
    topup_id: Uuid,
    status_value: &str,
) -> String {
    let (base, query) = url.split_once('?').unwrap_or((url.as_str(), ""));
    let mut params = query
        .split('&')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .filter(|part| {
            let key = part.split_once('=').map(|(key, _)| key).unwrap_or(*part);
            !matches!(key, "topup_status" | "topup_id")
        })
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    params.push(format!("topup_status={status_value}"));
    params.push(format!("topup_id={topup_id}"));
    format!("{base}?{}", params.join("&"))
}

pub(crate) fn midtrans_enabled_payments(payment_method: Option<&str>) -> Vec<String> {
    let normalized = payment_method
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty());

    let methods: Vec<&str> = match normalized.as_deref() {
        None | Some("auto") | Some("all") | Some("any") => vec![
            "gopay",
            "shopeepay",
            "qris",
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
            "credit_card",
        ],
        Some("gopay") => vec!["gopay"],
        Some("shopeepay") => vec!["shopeepay"],
        Some("qris") => vec!["qris"],
        Some("credit_card") | Some("card") => vec!["credit_card"],
        Some("bca_va") | Some("bca") => vec!["bca_va"],
        Some("bni_va") | Some("bni") => vec!["bni_va"],
        Some("bri_va") | Some("bri") => vec!["bri_va"],
        Some("permata_va") | Some("permata") => vec!["permata_va"],
        Some("mandiri_va") | Some("mandiri") | Some("echannel") => vec!["echannel"],
        Some("cimb_va") | Some("cimb") => vec!["cimb_va"],
        Some("bank_transfer") | Some("va") | Some("virtual_account") => vec![
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
        ],
        Some("ewallet") | Some("e_wallet") => vec!["gopay", "shopeepay", "qris"],
        Some(_) => vec![
            "gopay",
            "shopeepay",
            "qris",
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
            "credit_card",
        ],
    };

    methods.into_iter().map(|v| v.to_string()).collect()
}

pub(crate) fn midtrans_direct_bank_from_method(method: &str) -> Option<&'static str> {
    match method {
        "bca_va" | "bca" => Some("bca"),
        "bni_va" | "bni" => Some("bni"),
        "bri_va" | "bri" => Some("bri"),
        "permata_va" | "permata" => Some("permata"),
        "cimb_va" | "cimb" => Some("cimb"),
        "bank_transfer" | "va" | "virtual_account" => Some("bca"),
        _ => None,
    }
}

pub(crate) fn build_midtrans_direct_charge_request(
    external_reference: &str,
    gross_amount: i64,
    payment_method: Option<&str>,
) -> Option<(String, Value)> {
    let normalized = payment_method
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())?;

    if normalized == "gopay" {
        return Some((
            normalized,
            json!({
                "payment_type": "gopay",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "gopay": {
                    "enable_callback": false
                }
            }),
        ));
    }

    if normalized == "shopeepay" {
        return Some((
            normalized,
            json!({
                "payment_type": "shopeepay",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "shopeepay": {}
            }),
        ));
    }

    if normalized == "qris" {
        return Some((
            normalized,
            json!({
                "payment_type": "qris",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                }
            }),
        ));
    }

    if matches!(normalized.as_str(), "mandiri_va" | "mandiri" | "echannel") {
        return Some((
            normalized,
            json!({
                "payment_type": "echannel",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "echannel": {
                    "bill_info1": "Payment For",
                    "bill_info2": "Wallet Topup"
                }
            }),
        ));
    }

    let bank = midtrans_direct_bank_from_method(&normalized)?;
    Some((
        normalized,
        json!({
            "payment_type": "bank_transfer",
            "transaction_details": {
                "order_id": external_reference,
                "gross_amount": gross_amount
            },
            "bank_transfer": {
                "bank": bank
            }
        }),
    ))
}

pub(crate) fn midtrans_action_url(payload: &Value, candidates: &[&str]) -> Option<String> {
    let actions = payload.get("actions").and_then(Value::as_array)?;
    for action in actions {
        let name = action
            .get("name")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_lowercase())
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        if candidates.iter().any(|candidate| name.contains(candidate)) {
            if let Some(url) = action.get("url").and_then(Value::as_str) {
                let trimmed = url.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

pub(crate) fn midtrans_checkout_hint_from_charge(payload: &Value) -> Option<String> {
    midtrans_action_url(
        payload,
        &[
            "deeplink",
            "deep_link",
            "generate-qr",
            "qr",
            "checkout",
            "desktop",
            "mobile",
        ],
    )
    .or_else(|| {
        payload
            .get("redirect_url")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

pub(crate) fn midtrans_provider_message(payload: &Value) -> Option<String> {
    for key in ["status_message", "message", "error_message", "error"] {
        if let Some(message) = payload
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(message.to_string());
        }
    }

    for key in ["validation_messages", "error_messages"] {
        if let Some(messages) = payload.get(key).and_then(Value::as_array) {
            let joined = messages
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
                .join("; ");
            if !joined.is_empty() {
                return Some(joined);
            }
        }
    }

    None
}

pub(crate) fn midtrans_rejection_summary(status: u16, payload: &Value) -> String {
    match midtrans_provider_message(payload) {
        Some(message) => format!("status {} message={}", status, message),
        None => format!("status {}", status),
    }
}

pub(crate) fn midtrans_signature(
    order_id: &str,
    status_code: &str,
    gross_amount: &str,
    server_key: &str,
) -> String {
    let raw = format!("{order_id}{status_code}{gross_amount}{server_key}");
    let mut hasher = Sha512::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    format!("{digest:x}")
}

pub(crate) fn parse_major_amount_cents(value: &str) -> Option<i64> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    let mut parts = value.split('.');
    let whole = parts.next()?;
    let fraction = parts.next().unwrap_or("");
    if parts.next().is_some()
        || whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
        || fraction.bytes().skip(2).any(|byte| byte != b'0')
    {
        return None;
    }

    let whole_cents = whole.parse::<i64>().ok()?.checked_mul(100)?;
    let mut fraction_digits = fraction.bytes();
    let tenths = fraction_digits.next().map(|byte| byte - b'0').unwrap_or(0);
    let hundredths = fraction_digits.next().map(|byte| byte - b'0').unwrap_or(0);
    whole_cents.checked_add(i64::from(tenths) * 10 + i64::from(hundredths))
}
