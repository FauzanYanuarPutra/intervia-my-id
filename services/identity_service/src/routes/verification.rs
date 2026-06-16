use serde_json::{Map, Value};

#[derive(Debug, Clone)]
pub struct VerificationState {
    pub email_verified: bool,
    pub phone_verified: bool,
    pub document_verified: bool,
    pub liveness_verified: bool,
    pub identity_verified: bool,
    pub transaction_eligible: bool,
    pub kyc_status: String,
}

fn get_nested<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    Some(current)
}

fn read_nested_bool(metadata: Option<&Value>, path: &[&str]) -> bool {
    metadata
        .and_then(|value| get_nested(value, path))
        .and_then(|value| match value {
            Value::Bool(flag) => Some(*flag),
            Value::String(text) => {
                let normalized = text.trim().to_ascii_lowercase();
                match normalized.as_str() {
                    "true" | "1" | "yes" => Some(true),
                    "false" | "0" | "no" => Some(false),
                    _ => None,
                }
            }
            Value::Number(number) => Some(number.as_i64().unwrap_or(0) == 1),
            _ => None,
        })
        .unwrap_or(false)
}

fn read_nested_string(metadata: Option<&Value>, path: &[&str]) -> Option<String> {
    metadata
        .and_then(|value| get_nested(value, path))
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_kyc_status(value: Option<String>) -> Option<String> {
    let normalized = value?.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "none" | "basic" | "full" | "enhanced" => Some(normalized),
        _ => None,
    }
}

pub fn derive_verification_state(
    metadata: Option<&Value>,
    is_active: bool,
    email: Option<&str>,
    phone: Option<&str>,
    email_verified: bool,
    phone_verified: bool,
) -> VerificationState {
    let has_email = email.map(|value| !value.trim().is_empty()).unwrap_or(false);
    let has_phone = phone
        .map(|value| value.chars().filter(|ch| ch.is_ascii_digit()).count() >= 8)
        .unwrap_or(false);

    let effective_email_verified = has_email
        && (email_verified
            || read_nested_bool(metadata, &["verification", "email_verified"])
            || read_nested_bool(metadata, &["profile", "verification", "email_verified"])
            || read_nested_bool(metadata, &["extended", "verification", "email_verified"]));
    let effective_phone_verified = has_phone
        && (phone_verified
            || read_nested_bool(metadata, &["verification", "phone_verified"])
            || read_nested_bool(metadata, &["profile", "verification", "phone_verified"])
            || read_nested_bool(metadata, &["extended", "verification", "phone_verified"]));

    let document_verified = read_nested_bool(metadata, &["verification", "document_verified"])
        || read_nested_bool(metadata, &["profile", "verification", "document_verified"])
        || read_nested_bool(metadata, &["extended", "verification", "document_verified"]);
    let liveness_verified = read_nested_bool(metadata, &["verification", "liveness_verified"])
        || read_nested_bool(metadata, &["profile", "verification", "liveness_verified"])
        || read_nested_bool(metadata, &["extended", "verification", "liveness_verified"]);
    let stored_identity_verified =
        read_nested_bool(metadata, &["verification", "identity_verified"])
            || read_nested_bool(metadata, &["profile", "verification", "identity_verified"])
            || read_nested_bool(metadata, &["extended", "verification", "identity_verified"]);

    let kyc_status = normalize_kyc_status(
        read_nested_string(metadata, &["verification", "kyc_status"])
            .or_else(|| read_nested_string(metadata, &["profile", "verification", "kyc_status"]))
            .or_else(|| read_nested_string(metadata, &["extended", "verification", "kyc_status"])),
    )
    .unwrap_or_else(|| {
        if document_verified && liveness_verified && effective_phone_verified {
            "enhanced".to_string()
        } else if document_verified && liveness_verified {
            "full".to_string()
        } else if effective_phone_verified
            || effective_email_verified
            || document_verified
            || liveness_verified
        {
            "basic".to_string()
        } else {
            "none".to_string()
        }
    });

    let identity_verified = stored_identity_verified
        || effective_phone_verified
        || (document_verified && liveness_verified);
    let transaction_eligible = is_active
        && (identity_verified || matches!(kyc_status.as_str(), "basic" | "full" | "enhanced"));

    VerificationState {
        email_verified: effective_email_verified,
        phone_verified: effective_phone_verified,
        document_verified,
        liveness_verified,
        identity_verified,
        transaction_eligible,
        kyc_status,
    }
}

pub fn merged_verification_payload(metadata: Option<&Value>, state: &VerificationState) -> Value {
    let mut map = match metadata
        .and_then(|value| value.get("verification"))
        .cloned()
        .unwrap_or(Value::Object(Map::new()))
    {
        Value::Object(object) => object,
        _ => Map::new(),
    };

    map.insert(
        "email_verified".to_string(),
        Value::Bool(state.email_verified),
    );
    map.insert(
        "phone_verified".to_string(),
        Value::Bool(state.phone_verified),
    );
    map.insert(
        "document_verified".to_string(),
        Value::Bool(state.document_verified),
    );
    map.insert(
        "liveness_verified".to_string(),
        Value::Bool(state.liveness_verified),
    );
    map.insert(
        "identity_verified".to_string(),
        Value::Bool(state.identity_verified),
    );
    map.insert(
        "transaction_eligible".to_string(),
        Value::Bool(state.transaction_eligible),
    );
    map.insert(
        "kyc_status".to_string(),
        Value::String(state.kyc_status.clone()),
    );

    Value::Object(map)
}

pub fn public_verification_payload(metadata: Option<&Value>, state: &VerificationState) -> Value {
    let status = read_nested_string(metadata, &["verification", "status"]).unwrap_or_else(|| {
        if matches!(state.kyc_status.as_str(), "full" | "enhanced") {
            "approved".to_string()
        } else if state.document_verified || state.liveness_verified {
            "manual_review".to_string()
        } else {
            "not_started".to_string()
        }
    });
    let document_type = read_nested_string(metadata, &["verification", "document_type"])
        .unwrap_or_else(|| "ktp".to_string());
    let document_country = read_nested_string(metadata, &["verification", "document_country"])
        .unwrap_or_else(|| "ID".to_string());

    Value::Object(Map::from_iter([
        ("status".to_string(), Value::String(status)),
        ("document_type".to_string(), Value::String(document_type)),
        (
            "document_country".to_string(),
            Value::String(document_country),
        ),
        (
            "email_verified".to_string(),
            Value::Bool(state.email_verified),
        ),
        (
            "phone_verified".to_string(),
            Value::Bool(state.phone_verified),
        ),
        (
            "document_verified".to_string(),
            Value::Bool(state.document_verified),
        ),
        (
            "liveness_verified".to_string(),
            Value::Bool(state.liveness_verified),
        ),
        (
            "identity_verified".to_string(),
            Value::Bool(state.identity_verified),
        ),
        (
            "transaction_eligible".to_string(),
            Value::Bool(state.transaction_eligible),
        ),
        (
            "kyc_status".to_string(),
            Value::String(state.kyc_status.clone()),
        ),
    ]))
}
