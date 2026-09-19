// src/routes/users.rs
// User management (list, detail)
// Requires JWT auth + RBAC

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};

use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2,
};
use bcrypt::verify as verify_bcrypt;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::task;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use sqlx::Row;

use crate::config::AppState;
use crate::backoffice::{is_backoffice_eligible, parse_backoffice_application, validate_application_roles};
use crate::routes::proofs::{consume_identity_verification_proof, consume_phone_otp_proof};
use crate::routes::verification::{derive_verification_state, merged_verification_payload};

const MAX_METADATA_BYTES: usize = 48 * 1024;
const MAX_METADATA_DEPTH: usize = 6;
const MAX_METADATA_ARRAY_ITEMS: usize = 64;
const MAX_METADATA_OBJECT_KEYS: usize = 80;
const MAX_STRING_LEN: usize = 500;
const MAX_PROFILE_MEDIA_URL_LEN: usize = 32 * 1024;

// ============================================================
// Types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub q: Option<String>, // search email / username / full_name
}

#[derive(Debug, Serialize)]
pub struct UserListItem {
    pub id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub meta: PaginationMeta,
}

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: i64,
    pub limit: i64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct UserDetailResponse {
    pub id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateMeRequest {
    pub name: Option<String>,
    pub full_name: Option<String>,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub cover_image: Option<String>,
    pub metadata: Option<Value>,
    pub profile: Option<Value>,
    pub freelancer_profile: Option<Value>,
    pub provider_profile: Option<Value>,
    pub buyer_profile: Option<Value>,
    pub media: Option<Value>,
    pub verification: Option<Value>,
    pub phone_otp_token: Option<String>,
    pub identity_verification_proof_token: Option<String>,
    pub roles: Option<Vec<String>>,
    pub image_urls: Option<Vec<String>>,
    pub document_urls: Option<Vec<String>>,
    pub onboarding_step: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteMeRequest {
    pub password: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct AccessClaims {
    pub sub: String,
    #[allow(dead_code)]
    pub exp: usize,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub perms: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub username: String,
}

// ============================================================
// Helpers
// ============================================================

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn decode_access_token(
    secret: &str,
    token: &str,
) -> Result<AccessClaims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    Ok(token_data.claims)
}

fn has_permission(perms: &[String], required: &str) -> bool {
    perms.iter().any(|p| p == required)
}

fn has_role(roles: &[String], required: &str) -> bool {
    roles.iter().any(|role| role.eq_ignore_ascii_case(required))
}

fn normalize_backoffice_email(raw: &str) -> Option<String> {
    let email = raw.trim().to_ascii_lowercase();
    let mut parts = email.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    if parts.next().is_some()
        || local.is_empty()
        || domain.len() < 3
        || !domain.contains('.')
        || email.chars().any(char::is_whitespace)
    {
        return None;
    }
    Some(email)
}

fn normalize_google_backoffice_application(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "crm" => Some("crm"),
        "cms" => Some("cms"),
        _ => None,
    }
}

fn normalize_google_backoffice_roles(application: &str, values: &[String]) -> Vec<String> {
    let defaults: &[&str] = match application {
        "cms" => &["content_admin"],
        _ => &["sales"],
    };
    let mut roles = Vec::new();
    for value in values {
        let role = value.trim().to_ascii_lowercase();
        if matches!(role.as_str(), "admin" | "content_admin" | "moderator" | "sales" | "support")
            && !roles.contains(&role)
        {
            roles.push(role);
        }
    }
    if roles.is_empty() {
        defaults.iter().map(|value| (*value).to_string()).collect()
    } else {
        roles
    }
}

async fn require_super_admin(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<AccessClaims, StatusCode> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let claims = decode_access_token(&state.config.jwt_secret, token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    if !has_role(&claims.roles, "super_admin") {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(claims)
}

#[derive(Debug, Deserialize)]
pub struct UpsertBackofficeGoogleAccessRequest {
    pub email: String,
    pub application: String,
    #[serde(default)]
    pub role_names: Vec<String>,
    #[serde(default = "default_google_access_status")]
    pub status: String,
}

fn default_google_access_status() -> String {
    "approved".to_string()
}

pub async fn list_backoffice_google_access(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(status) = require_super_admin(&state, &headers).await {
        return (status, Json(json!({"error":"backoffice owner access required"}))).into_response();
    }

    match sqlx::query(
        r#"
        SELECT id, email::text AS email, application, role_names, status, granted_by, created_at, updated_at, last_login_at
        FROM core.backoffice_google_access
        ORDER BY application, lower(email::text)
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => {
            let data: Vec<Value> = rows
                .into_iter()
                .map(|row| json!({
                    "id": row.get::<Uuid, _>("id"),
                    "email": row.get::<String, _>("email"),
                    "application": row.get::<String, _>("application"),
                    "role_names": row.get::<Vec<String>, _>("role_names"),
                    "status": row.get::<String, _>("status"),
                    "granted_by": row.get::<Option<Uuid>, _>("granted_by"),
                    "created_at": row.get::<DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<DateTime<Utc>, _>("updated_at"),
                    "last_login_at": row.get::<Option<DateTime<Utc>>, _>("last_login_at")
                }))
                .collect();
            (StatusCode::OK, Json(json!({"data": data}))).into_response()
        }
        Err(error) => {
            tracing::error!("list backoffice google access failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn upsert_backoffice_google_access(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<UpsertBackofficeGoogleAccessRequest>,
) -> impl IntoResponse {
    let claims = match require_super_admin(&state, &headers).await {
        Ok(value) => value,
        Err(status) => {
            return (status, Json(json!({"error":"backoffice owner access required"}))).into_response();
        }
    };

    let email = match normalize_backoffice_email(&payload.email) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid email"}))).into_response(),
    };
    let application = match normalize_google_backoffice_application(&payload.application) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error":"application must be crm or cms"}))).into_response(),
    };
    let status = match payload.status.trim().to_ascii_lowercase().as_str() {
        "pending" | "approved" | "revoked" => payload.status.trim().to_ascii_lowercase(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid status"}))).into_response(),
    };
    let role_names = normalize_google_backoffice_roles(application, &payload.role_names);
    let allowed_roles: &[&str] = match application {
        "crm" => &["admin", "moderator", "sales", "support"],
        "cms" => &["admin", "content_admin"],
        _ => &[],
    };
    if role_names.iter().any(|role| !allowed_roles.contains(&role.as_str())) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"role is not valid for this application"})),
        ).into_response();
    }

    let result = sqlx::query(
        r#"
        INSERT INTO core.backoffice_google_access (
            email, application, role_names, status, granted_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (lower(email::text), application) DO UPDATE
        SET role_names = EXCLUDED.role_names,
            status = EXCLUDED.status,
            granted_by = EXCLUDED.granted_by,
            updated_at = NOW()
        RETURNING id, email::text AS email, application, role_names, status
        "#,
    )
    .bind(&email)
    .bind(application)
    .bind(&role_names)
    .bind(&status)
    .bind(Uuid::parse_str(&claims.sub).ok())
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let actor_id = Uuid::parse_str(&claims.sub).ok();
            let _ = sqlx::query(
                r#"
                INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
                VALUES ('backoffice_google_access', 'backoffice.google_access.updated', $1, NULL, $2, NOW())
                "#,
            )
            .bind(actor_id)
            .bind(json!({
                "email": email,
                "application": application,
                "role_names": role_names,
                "status": status
            }))
            .execute(&state.db)
            .await;

            (
                StatusCode::OK,
                Json(json!({
                    "id": row.get::<Uuid, _>("id"),
                    "email": row.get::<String, _>("email"),
                    "application": row.get::<String, _>("application"),
                    "role_names": row.get::<Vec<String>, _>("role_names"),
                    "status": row.get::<String, _>("status")
                })),
            ).into_response()
        }
        Err(error) => {
            tracing::error!("upsert backoffice google access failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}


fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_phone_digits(raw: &str) -> String {
    raw.chars().filter(|ch| ch.is_ascii_digit()).collect()
}

fn sanitize_key(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() || value.len() > 64 {
        return None;
    }
    let is_valid = value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-');
    if is_valid {
        Some(value.to_string())
    } else {
        None
    }
}

fn sanitize_string(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let value: String = trimmed.chars().take(MAX_STRING_LEN).collect();
    Some(value)
}

fn normalize_metadata_key(raw: &str) -> String {
    let mut normalized = String::new();
    for (index, ch) in raw.trim().chars().enumerate() {
        if ch.is_ascii_uppercase() {
            if index > 0 && !normalized.ends_with('_') {
                normalized.push('_');
            }
            normalized.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch.is_ascii_whitespace() {
            if !normalized.ends_with('_') {
                normalized.push('_');
            }
        } else {
            normalized.push(ch.to_ascii_lowercase());
        }
    }
    normalized
}

fn is_server_owned_metadata_key(raw: &str) -> bool {
    let key = normalize_metadata_key(raw);
    matches!(
        key.as_str(),
        "verification"
            | "verified"
            | "is_verified"
            | "email_verified"
            | "phone_verified"
            | "document_verified"
            | "liveness_verified"
            | "identity_verified"
            | "transaction_eligible"
            | "kyc_status"
            | "trust_status"
            | "trust_score"
            | "trust_tier"
            | "trust_badge"
            | "manual_verified"
            | "verified_by_lajukan"
            | "lajukan_verified"
            | "reviewed_by"
            | "reviewed_at"
    ) || key.contains("verification")
        || key.ends_with("_verified")
        || key.starts_with("verification_")
        || key.starts_with("kyc_")
        || key.starts_with("trust_")
        || key.starts_with("admin_review_")
        || key.starts_with("manual_review_")
}

fn sanitize_json_value_with_policy(
    value: Value,
    depth: usize,
    allow_server_owned: bool,
) -> Option<Value> {
    if depth > MAX_METADATA_DEPTH {
        return None;
    }
    match value {
        Value::Null => None,
        Value::Bool(v) => Some(Value::Bool(v)),
        Value::Number(v) => Some(Value::Number(v)),
        Value::String(v) => sanitize_string(&v).map(Value::String),
        Value::Array(values) => {
            let mut next = Vec::new();
            for item in values.into_iter().take(MAX_METADATA_ARRAY_ITEMS) {
                if let Some(cleaned) =
                    sanitize_json_value_with_policy(item, depth + 1, allow_server_owned)
                {
                    next.push(cleaned);
                }
            }
            Some(Value::Array(next))
        }
        Value::Object(values) => {
            let mut next = serde_json::Map::new();
            for (key, value) in values.into_iter().take(MAX_METADATA_OBJECT_KEYS) {
                let Some(clean_key) = sanitize_key(&key) else {
                    continue;
                };
                if !allow_server_owned && is_server_owned_metadata_key(&clean_key) {
                    continue;
                }
                if let Some(clean_value) =
                    sanitize_json_value_with_policy(value, depth + 1, allow_server_owned)
                {
                    next.insert(clean_key, clean_value);
                }
            }
            Some(Value::Object(next))
        }
    }
}

fn sanitize_json_value(value: Value, depth: usize) -> Option<Value> {
    sanitize_json_value_with_policy(value, depth, false)
}

fn sanitize_trusted_json_value(value: Value, depth: usize) -> Option<Value> {
    sanitize_json_value_with_policy(value, depth, true)
}

fn normalize_http_url(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() || value.len() > 2048 {
        return None;
    }
    let lower = value.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return None;
    }
    Some(value.to_string())
}

fn normalize_profile_media_url(raw: &str, allow_inline_svg: bool) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() || value.len() > MAX_PROFILE_MEDIA_URL_LEN {
        return None;
    }

    let lower = value.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return Some(value.to_string());
    }

    if value.starts_with('/') && !value.starts_with("//") {
        return Some(value.to_string());
    }

    if allow_inline_svg && lower.starts_with("data:image/svg+xml") {
        let blocked = [
            "<script",
            "%3cscript",
            "javascript:",
            "javascript%3a",
            "onload",
            "onerror",
            "foreignobject",
            "%3cforeignobject",
            "%3ciframe",
            "%3cobject",
            "%3cembed",
        ];
        if blocked.iter().any(|needle| lower.contains(needle)) {
            return None;
        }
        return Some(value.to_string());
    }

    None
}

fn normalize_url_list(values: Option<Vec<String>>, max_items: usize) -> Option<Vec<String>> {
    let mut clean = Vec::new();
    for value in values.unwrap_or_default().into_iter().take(max_items) {
        if let Some(url) = normalize_http_url(&value) {
            if !clean.iter().any(|existing| existing == &url) {
                clean.push(url);
            }
        }
    }
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

fn normalize_roles(values: Option<Vec<String>>) -> Option<Vec<String>> {
    let allowlist = [
        "buyer",
        "provider",
        "freelancer",
        "employer",
        "agent",
        "seller",
        "talent",
        "vendor",
    ];
    let mut clean = Vec::new();
    for value in values.unwrap_or_default().into_iter().take(16) {
        let normalized = value.trim().to_ascii_lowercase();
        if normalized.is_empty() || !allowlist.contains(&normalized.as_str()) {
            continue;
        }
        if !clean.iter().any(|existing| existing == &normalized) {
            clean.push(normalized);
        }
    }
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

async fn verify_password(hash: &str, password: &str) -> bool {
    let hash_owned = hash.to_owned();
    let password_owned = password.to_owned();
    task::spawn_blocking(move || {
        if hash_owned.starts_with("$2a$")
            || hash_owned.starts_with("$2b$")
            || hash_owned.starts_with("$2y$")
        {
            return verify_bcrypt(&password_owned, &hash_owned).unwrap_or(false);
        }

        PasswordHash::new(&hash_owned)
            .map(|parsed| {
                Argon2::default()
                    .verify_password(password_owned.as_bytes(), &parsed)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

fn extract_audit_info(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let ip = headers
        .get("X-Real-Ip")
        .or_else(|| headers.get("X-Forwarded-For"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let ua = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    (ip, ua)
}

async fn record_audit_log(
    state: Arc<AppState>,
    action: &'static str,
    actor_id: Option<Uuid>,
    metadata: Option<Value>,
    headers: &HeaderMap,
) {
    let (ip, ua) = extract_audit_info(headers);
    let _ = sqlx::query(
        r#"
        INSERT INTO events.audit_logs (entity, action, actor_id, metadata, ip_address, user_agent, created_at)
        VALUES ('user', $1, $2, $3, $4, $5, NOW())
        "#
    )
    .bind(action)
    .bind(actor_id)
    .bind(metadata.unwrap_or_else(|| json!({})))
    .bind(ip)
    .bind(ua)
    .execute(&state.db)
    .await;
}

// ============================================================
// GET /users/me
// ============================================================

pub async fn get_me_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing token"})),
            )
                .into_response()
        }
    };

    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token"})),
            )
                .into_response()
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token subject"})),
            )
                .into_response()
        }
    };

    let row = match sqlx::query(
        r#"
        SELECT
            u.id,
            COALESCE(u.email::text, '') AS email,
            u.phone,
            up.username,
            up.full_name,
            up.bio,
            up.location,
            up.metadata,
            u.is_active,
            u.email_verified,
            u.phone_verified,
            (u.password_hash IS NOT NULL) AS has_password,
            u.created_at
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response()
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response()
        }
    };

    let id = row.get::<Uuid, _>("id");
    let email = row.get::<String, _>("email");
    let phone = row.get::<Option<String>, _>("phone");
    let username = row.get::<Option<String>, _>("username");
    let full_name = row.get::<Option<String>, _>("full_name");
    let bio = row.get::<Option<String>, _>("bio");
    let location = row.get::<Option<String>, _>("location");
    let metadata = row
        .get::<Option<Value>, _>("metadata")
        .unwrap_or_else(|| json!({}));
    let is_active = row.get::<bool, _>("is_active");
    let email_verified = row.get::<bool, _>("email_verified");
    let phone_verified = row.get::<bool, _>("phone_verified");
    let has_password = row.get::<bool, _>("has_password");
    let created_at = row.get::<DateTime<Utc>, _>("created_at");
    let verification_state = derive_verification_state(
        Some(&metadata),
        is_active,
        Some(email.as_str()),
        phone.as_deref(),
        email_verified,
        phone_verified,
    );
    let verification = merged_verification_payload(Some(&metadata), &verification_state);

    (
        StatusCode::OK,
        Json(json!({
            "id": id,
            "email": email,
            "phone": phone,
            "username": username,
            "full_name": full_name,
            "bio": bio,
            "location": location,
            "metadata": metadata,
            "email_verified": verification_state.email_verified,
            "phone_verified": verification_state.phone_verified,
            "document_verified": verification_state.document_verified,
            "liveness_verified": verification_state.liveness_verified,
            "identity_verified": verification_state.identity_verified,
            "transaction_eligible": verification_state.transaction_eligible,
            "kyc_status": verification_state.kyc_status,
            "verification": verification,
            "is_active": is_active,
            "created_at": created_at,
            "has_password": has_password,
            "hasPassword": has_password,
            "roles": claims.roles,
            "permissions": claims.perms
        })),
    )
        .into_response()
}

// ============================================================
// PUT /users/me
// ============================================================

pub async fn update_me_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<UpdateMeRequest>,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing token"})),
            )
                .into_response()
        }
    };

    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token"})),
            )
                .into_response()
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token subject"})),
            )
                .into_response()
        }
    };

    if payload.verification.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"verification is server-managed"})),
        )
            .into_response();
    }

    let phone_otp_token = normalize_optional_text(payload.phone_otp_token);
    let identity_verification_proof_token =
        normalize_optional_text(payload.identity_verification_proof_token);

    let full_name = normalize_optional_text(payload.full_name.or(payload.name));
    let username = normalize_optional_text(payload.username);
    let phone = normalize_optional_text(payload.phone);
    let location = normalize_optional_text(payload.location);
    let bio = normalize_optional_text(payload.bio);
    let avatar_url = normalize_optional_text(payload.avatar_url)
        .and_then(|value| normalize_profile_media_url(&value, true));
    let cover_image = normalize_optional_text(payload.cover_image)
        .and_then(|value| normalize_profile_media_url(&value, false));
    let roles = normalize_roles(payload.roles);
    let image_urls = normalize_url_list(payload.image_urls, 40);
    let document_urls = normalize_url_list(payload.document_urls, 24);
    let onboarding_step = normalize_optional_text(payload.onboarding_step);

    let metadata_raw = payload
        .metadata
        .and_then(|value| sanitize_json_value(value, 0));
    let profile_raw = payload
        .profile
        .and_then(|value| sanitize_json_value(value, 0));
    let freelancer_profile = payload
        .freelancer_profile
        .and_then(|value| sanitize_json_value(value, 0));
    let provider_profile = payload
        .provider_profile
        .and_then(|value| sanitize_json_value(value, 0));
    let buyer_profile = payload
        .buyer_profile
        .and_then(|value| sanitize_json_value(value, 0));
    let media_raw = payload
        .media
        .and_then(|value| sanitize_json_value(value, 0));

    let phone_verified_by_proof = match phone_otp_token.as_deref() {
        Some(token) => {
            let Some(phone_value) = phone.as_deref() else {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error":"phone is required for phone verification"})),
                )
                    .into_response();
            };
            match consume_phone_otp_proof(&state, token, phone_value, &["profile"]).await {
                Ok(true) => true,
                Ok(false) => {
                    return (
                        StatusCode::UNAUTHORIZED,
                        Json(json!({"error":"invalid or expired phone verification"})),
                    )
                        .into_response();
                }
                Err(error) => {
                    tracing::error!("phone profile proof verification unavailable: {:?}", error);
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(json!({"error":"phone verification is temporarily unavailable"})),
                    )
                        .into_response();
                }
            }
        }
        None => false,
    };

    let trusted_verification = match identity_verification_proof_token.as_deref() {
        Some(token) => match consume_identity_verification_proof(&state, token, user_id).await {
            Ok(Some(value)) => match sanitize_trusted_json_value(value, 0) {
                Some(Value::Object(value)) if !value.is_empty() => Some(Value::Object(value)),
                _ => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({"error":"invalid identity verification payload"})),
                    )
                        .into_response();
                }
            },
            Ok(None) => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error":"invalid or expired identity verification proof"})),
                )
                    .into_response();
            }
            Err(error) => {
                tracing::error!("identity verification proof unavailable: {:?}", error);
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({"error":"identity verification is temporarily unavailable"})),
                )
                    .into_response();
            }
        },
        None => None,
    };

    if let Some(ref username_value) = username {
        if username_value.len() < 3 {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"username minimal 3 karakter"})),
            )
                .into_response();
        }
    }

    if let Some(ref phone_value) = phone {
        let digits: String = phone_value.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() < 8 {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"phone tidak valid"})),
            )
                .into_response();
        }
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"transaction error"})),
            )
                .into_response()
        }
    };

    let current_user_row = match sqlx::query(
        "SELECT phone, phone_verified FROM core.users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            let _ = tx.rollback().await;
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response();
        }
        Err(_) => {
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to read current user"})),
            )
                .into_response();
        }
    };

    let current_phone = current_user_row.get::<Option<String>, _>("phone");
    let current_phone_verified = current_user_row.get::<bool, _>("phone_verified");
    let phone_changed = phone
        .as_deref()
        .map(|next| {
            normalize_phone_digits(next)
                != normalize_phone_digits(current_phone.as_deref().unwrap_or(""))
        })
        .unwrap_or(false);

    if phone.is_some() {
        let next_phone_verified = if phone_verified_by_proof {
            true
        } else if phone_changed {
            false
        } else {
            current_phone_verified
        };
        if sqlx::query(
            "UPDATE core.users SET phone = $2, phone_verified = $3, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(user_id)
        .bind(phone.clone())
        .bind(next_phone_verified)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to update phone"})),
            )
                .into_response();
        }
    }

    let upsert_res = sqlx::query(
        r#"
        INSERT INTO core.user_profiles (user_id, full_name, username, bio, location, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
            username = COALESCE(EXCLUDED.username, user_profiles.username),
            bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
            location = COALESCE(EXCLUDED.location, user_profiles.location),
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(full_name.clone())
    .bind(username.clone())
    .bind(bio.clone())
    .bind(location.clone())
    .execute(&mut *tx)
    .await;

    if upsert_res.is_err() {
        let _ = tx.rollback().await;
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"username sudah dipakai atau data tidak valid"})),
        )
            .into_response();
    }

    let mut metadata_patch = serde_json::Map::new();
    if let Some(avatar) = avatar_url {
        metadata_patch.insert("avatar_url".to_string(), Value::String(avatar));
    }
    if let Some(cover) = cover_image {
        metadata_patch.insert("cover_image".to_string(), Value::String(cover));
    }
    if let Some(roles) = roles {
        metadata_patch.insert("roles".to_string(), json!(roles));
    }
    if let Some(profile) = profile_raw {
        metadata_patch.insert("profile".to_string(), profile);
    }
    if let Some(freelancer) = freelancer_profile {
        metadata_patch.insert("freelancer_profile".to_string(), freelancer);
    }
    if let Some(provider) = provider_profile {
        metadata_patch.insert("provider_profile".to_string(), provider);
    }
    if let Some(buyer) = buyer_profile {
        metadata_patch.insert("buyer_profile".to_string(), buyer);
    }
    if let Some(media) = media_raw {
        metadata_patch.insert("media".to_string(), media);
    }
    let mut verification_patch = match trusted_verification {
        Some(Value::Object(map)) => map,
        Some(_) | None => serde_json::Map::new(),
    };
    if phone.is_some() {
        verification_patch.insert(
            "phone_verified".to_string(),
            Value::Bool(if phone_verified_by_proof {
                true
            } else if phone_changed {
                false
            } else {
                current_phone_verified
            }),
        );
    }
    if !verification_patch.is_empty() {
        metadata_patch.insert(
            "verification".to_string(),
            Value::Object(verification_patch),
        );
    }
    if let Some(images) = image_urls {
        metadata_patch.insert("gallery_images".to_string(), json!(images));
    }
    if let Some(files) = document_urls {
        metadata_patch.insert("documents".to_string(), json!(files));
    }
    if let Some(step) = onboarding_step {
        metadata_patch.insert(
            "onboarding".to_string(),
            json!({
                "last_step": step,
                "updated_at": Utc::now().to_rfc3339(),
            }),
        );
    }
    if let Some(metadata) = metadata_raw {
        if let Value::Object(ref map) = metadata {
            if let Some(avatar_style) = map.get("avatar_style").cloned() {
                metadata_patch.insert("avatar_style".to_string(), avatar_style);
            }
            if let Some(avatar_source) = map.get("avatar_source").cloned() {
                metadata_patch.insert("avatar_source".to_string(), avatar_source);
            }
            if let Some(avatar_updated_at) = map.get("avatar_updated_at").cloned() {
                metadata_patch.insert("avatar_updated_at".to_string(), avatar_updated_at);
            }
            if let Some(avatar_generated_at) = map.get("avatar_generated_at").cloned() {
                metadata_patch.insert("avatar_generated_at".to_string(), avatar_generated_at);
            }
        }
        metadata_patch.insert("extended".to_string(), metadata);
    }

    let metadata_updated = !metadata_patch.is_empty();
    if metadata_updated {
        let existing_metadata = match sqlx::query_scalar::<_, Value>(
            r#"
            SELECT COALESCE(metadata, '{}'::jsonb)
            FROM user_profiles
            WHERE user_id = $1
            FOR UPDATE
            "#,
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        {
            Ok(Some(value)) => value,
            Ok(None) => json!({}),
            Err(_) => {
                let _ = tx.rollback().await;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"failed to read current profile metadata"})),
                )
                    .into_response();
            }
        };

        let mut merged = match existing_metadata {
            Value::Object(map) => map,
            _ => serde_json::Map::new(),
        };
        for (key, value) in metadata_patch {
            if key == "extended" || key == "verification" {
                if let Value::Object(next_object) = value {
                    let mut existing_object = match merged.remove(&key) {
                        Some(Value::Object(map)) => map,
                        _ => serde_json::Map::new(),
                    };
                    for (nested_key, nested_value) in next_object {
                        existing_object.insert(nested_key, nested_value);
                    }
                    merged.insert(key, Value::Object(existing_object));
                    continue;
                }
            }
            merged.insert(key, value);
        }

        let merged_value = Value::Object(merged);
        let metadata_size = serde_json::to_vec(&merged_value)
            .map(|bytes| bytes.len())
            .unwrap_or(0);
        if metadata_size > MAX_METADATA_BYTES {
            let _ = tx.rollback().await;
            return (
                StatusCode::PAYLOAD_TOO_LARGE,
                Json(json!({"error":"metadata profile terlalu besar"})),
            )
                .into_response();
        }

        if sqlx::query(
            r#"
            UPDATE user_profiles
            SET metadata = $2::jsonb,
                updated_at = NOW()
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .bind(merged_value)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to update profile metadata"})),
            )
                .into_response();
        }
    }

    if tx.commit().await.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"commit failed"})),
        )
            .into_response();
    }

    record_audit_log(
        state.clone(),
        "user.update_self",
        Some(user_id),
        Some(json!({
            "full_name": full_name,
            "username": username,
            "location": location,
            "metadata_updated": metadata_updated
        })),
        &headers,
    )
    .await;

    get_me_profile(State(state), headers).await.into_response()
}

// ============================================================
// DELETE /users/me
// ============================================================

pub async fn delete_me_account(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<DeleteMeRequest>,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing token"})),
            )
                .into_response()
        }
    };

    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token"})),
            )
                .into_response()
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token subject"})),
            )
                .into_response()
        }
    };

    let password_hash = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT password_hash FROM core.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(hash)) => hash,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response()
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response()
        }
    };

    let Some(password_hash) = password_hash.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"set a password first before deleting this account"})),
        )
            .into_response();
    };

    if !verify_password(password_hash, &payload.password).await {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid password"})),
        )
            .into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db transaction error"})),
            )
                .into_response()
        }
    };

    let update_res = sqlx::query(
        r#"
        UPDATE users
        SET
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await;

    match update_res {
        Ok(result) if result.rows_affected() == 1 => {}
        Ok(_) => {
            let _ = tx.rollback().await;
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response();
        }
        Err(_) => {
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to delete account"})),
            )
                .into_response();
        }
    }

    if sqlx::query("UPDATE core.sessions SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .is_err()
    {
        let _ = tx.rollback().await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"failed to revoke account sessions"})),
        )
            .into_response();
    }

    if tx.commit().await.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"failed to finalize account deletion"})),
        )
            .into_response();
    }

    record_audit_log(
        state.clone(),
        "me.delete",
        Some(user_id),
        Some(json!({
            "reason": payload.reason.unwrap_or_default(),
        })),
        &headers,
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "account deleted"
        })),
    )
        .into_response()
}

// ============================================================
// GET /users  (ADMIN ONLY)
// ============================================================

pub async fn list_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListUsersQuery>,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing token"})),
            )
                .into_response()
        }
    };

    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token"})),
            )
                .into_response()
        }
    };

    if !has_permission(&claims.perms, "user.read") {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"insufficient permission"})),
        )
            .into_response();
    }

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;
    let search = query.q.unwrap_or_default();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND (
            $1 = '' OR
            COALESCE(u.email::text, '') ILIKE '%' || $1 || '%' OR
            up.username ILIKE '%' || $1 || '%' OR
            up.full_name ILIKE '%' || $1 || '%'
          )
        "#,
    )
    .bind(&search)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let rows = match sqlx::query(
        r#"
        SELECT
            u.id,
            COALESCE(u.email::text, '') AS email,
            up.username,
            up.full_name,
            u.is_active,
            u.created_at,
            COALESCE(ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        LEFT JOIN core.user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.deleted_at IS NULL
          AND (
            $1 = '' OR
            COALESCE(u.email::text, '') ILIKE '%' || $1 || '%' OR
            up.username ILIKE '%' || $1 || '%' OR
            up.full_name ILIKE '%' || $1 || '%'
          )
        GROUP BY u.id, up.username, up.full_name
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response()
        }
    };

    let data: Vec<UserListItem> = rows
        .into_iter()
        .map(|row| UserListItem {
            id: row.get("id"),
            email: row.get("email"),
            username: row.get("username"),
            full_name: row.get("full_name"),
            is_active: row.get("is_active"),
            created_at: row.get("created_at"),
            roles: row.get("roles"),
        })
        .collect();

    let actor_id = Uuid::parse_str(&claims.sub).ok();
    record_audit_log(
        state.clone(),
        "user.list",
        actor_id,
        Some(json!({ "page": page, "limit": limit })),
        &headers,
    )
    .await;

    (
        StatusCode::OK,
        Json(PaginatedResponse {
            data,
            meta: PaginationMeta { page, limit, total },
        }),
    )
        .into_response()
}

// ============================================================
// GET /users/:id  (ADMIN ONLY)
// ============================================================

pub async fn get_user_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing token"})),
            )
                .into_response()
        }
    };

    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token"})),
            )
                .into_response()
        }
    };

    let is_self = claims.sub == user_id.to_string();
    if !is_self && !has_permission(&claims.perms, "user.read") {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"insufficient permission"})),
        )
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT
            u.id,
            COALESCE(u.email::text, '') AS email,
            up.username,
            up.full_name,
            u.is_active,
            u.created_at,
            COALESCE(ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
            COALESCE(ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        LEFT JOIN core.user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
        GROUP BY u.id, up.username, up.full_name
        LIMIT 1
        "#
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"user not found"}))).into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db error"}))).into_response(),
    };

    let actor_id = Uuid::parse_str(&claims.sub).ok();
    record_audit_log(
        state.clone(),
        "user.view",
        actor_id,
        Some(json!({ "target_user": user_id })),
        &headers,
    )
    .await;

    (
        StatusCode::OK,
        Json(UserDetailResponse {
            id: row.get("id"),
            email: row.get("email"),
            username: row.get("username"),
            full_name: row.get("full_name"),
            is_active: row.get("is_active"),
            created_at: row.get("created_at"),
            roles: row.get("roles"),
            permissions: row.get("permissions"),
        }),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{sanitize_json_value, sanitize_trusted_json_value};

    #[test]
    fn owner_metadata_drops_server_managed_trust_fields_recursively() {
        let sanitized = sanitize_json_value(
            json!({
                "headline": "Pengrajin",
                "verification": { "identity_verified": true },
                "profile": {
                    "bio": "Profil publik",
                    "phone_verified": true,
                    "trust_score": 100
                },
                "extended": {
                    "kyc_status": "enhanced",
                    "skills": ["Anyaman"]
                }
            }),
            0,
        )
        .expect("sanitized metadata");

        assert_eq!(sanitized["headline"].as_str(), Some("Pengrajin"));
        assert_eq!(sanitized["profile"]["bio"].as_str(), Some("Profil publik"));
        assert_eq!(sanitized["extended"]["skills"][0].as_str(), Some("Anyaman"));
        assert!(sanitized.get("verification").is_none());
        assert!(sanitized["profile"].get("phone_verified").is_none());
        assert!(sanitized["profile"].get("trust_score").is_none());
        assert!(sanitized["extended"].get("kyc_status").is_none());
    }

    #[test]
    fn trusted_verification_payload_retains_server_managed_fields() {
        let sanitized = sanitize_trusted_json_value(
            json!({
                "identity_verified": true,
                "document_verified": true,
                "kyc_status": "full"
            }),
            0,
        )
        .expect("trusted verification");

        assert_eq!(sanitized["identity_verified"].as_bool(), Some(true));
        assert_eq!(sanitized["document_verified"].as_bool(), Some(true));
        assert_eq!(sanitized["kyc_status"].as_str(), Some("full"));
    }
}


#[derive(Debug, Deserialize)]
pub struct BackofficeCandidateQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn search_backoffice_candidates(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<BackofficeCandidateQuery>,
) -> impl IntoResponse {
    if let Err(status) = require_super_admin(&state, &headers).await {
        return (status, Json(json!({"error":"backoffice owner access required"}))).into_response();
    }
    let q = query.q.trim().to_string();
    if q.len() < 2 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"search requires at least 2 characters"}))).into_response();
    }
    let limit = query.limit.unwrap_or(20).clamp(1, 50);

    let rows = match sqlx::query(
        r#"
        SELECT
          u.id, u.email::text AS email, u.email_verified, u.phone_verified,
          u.status::text AS status, u.is_active, up.username::text AS username,
          up.full_name, up.metadata
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND (
            lower(COALESCE(up.username::text,'')) LIKE '%' || lower($1) || '%'
            OR lower(COALESCE(up.full_name,'')) LIKE '%' || lower($1) || '%'
            OR lower(u.email::text) LIKE '%' || lower($1) || '%'
          )
        ORDER BY
          CASE WHEN lower(COALESCE(up.username::text,'')) = lower($1) THEN 0 ELSE 1 END,
          u.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(&q)
    .bind(limit)
    .fetch_all(&state.db)
    .await {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("backoffice candidate search failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response();
        }
    };

    let data: Vec<Value> = rows.into_iter().map(|row| {
        let metadata: Value = row.get::<Option<Value>, _>("metadata").unwrap_or_else(|| json!({}));
        let identity_verified = metadata.pointer("/verification/identity_verified")
            .and_then(Value::as_bool).unwrap_or(false);
        let eligible = is_backoffice_eligible(
            row.get("is_active"),
            row.get::<String, _>("status") == "banned",
            row.get("email_verified"),
            row.get("phone_verified"),
        );
        json!({
            "id": row.get::<Uuid,_>("id"),
            "email": row.get::<String,_>("email"),
            "username": row.get::<Option<String>,_>("username"),
            "full_name": row.get::<Option<String>,_>("full_name"),
            "status": row.get::<String,_>("status"),
            "email_verified": row.get::<bool,_>("email_verified"),
            "phone_verified": row.get::<bool,_>("phone_verified"),
            "identity_verified": identity_verified,
            "eligible": eligible
        })
    }).collect();

    (StatusCode::OK, Json(json!({"data": data}))).into_response()
}

#[derive(Debug, Deserialize)]
pub struct CreateBackofficeInvitationRequest {
    pub invitee_user_id: Uuid,
    pub application: String,
    pub role_names: Vec<String>,
    pub expires_in_days: Option<i64>,
}

pub async fn create_backoffice_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateBackofficeInvitationRequest>,
) -> impl IntoResponse {
    let claims = match require_super_admin(&state, &headers).await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"backoffice owner access required"}))).into_response(),
    };
    let application = match parse_backoffice_application(&payload.application) {
        Some(value) => value,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error":"application must be crm or cms"}))).into_response(),
    };
    let roles = match validate_application_roles(application, &payload.role_names) {
        Ok(value) => value,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({"error": error.to_string()}))).into_response(),
    };
    let inviter_id = match Uuid::parse_str(&claims.sub) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid actor"}))).into_response(),
    };

    let user = match sqlx::query(
        r#"
        SELECT u.email::text AS email, u.email_verified, u.phone_verified,
               u.status::text AS status, u.is_active
        FROM core.users u
        WHERE u.id = $1 AND u.deleted_at IS NULL
        LIMIT 1
        "#,
    ).bind(payload.invitee_user_id).fetch_optional(&state.db).await {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"user not found"}))).into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response(),
    };

    let eligible = is_backoffice_eligible(
        user.get("is_active"),
        user.get::<String,_>("status") == "banned",
        user.get("email_verified"),
        user.get("phone_verified"),
    );
    if !eligible {
        return (StatusCode::CONFLICT, Json(json!({"error":"user must be active and have a verified email or phone before backoffice invitation"}))).into_response();
    }

    let days = payload.expires_in_days.unwrap_or(7).clamp(1, 30);
    let result = sqlx::query(
        r#"
        INSERT INTO core.backoffice_invitations
          (invitee_user_id, invited_by, application, role_names, status, expires_at)
        VALUES ($1,$2,$3,$4,'pending',NOW() + ($5::text || ' days')::interval)
        ON CONFLICT (invitee_user_id, application) WHERE status = 'pending'
        DO UPDATE SET role_names = EXCLUDED.role_names,
                      invited_by = EXCLUDED.invited_by,
                      expires_at = EXCLUDED.expires_at,
                      updated_at = NOW()
        RETURNING id, status, expires_at, application, role_names
        "#,
    )
    .bind(payload.invitee_user_id)
    .bind(inviter_id)
    .bind(application.as_str())
    .bind(&roles)
    .bind(days)
    .fetch_one(&state.db).await;

    match result {
        Ok(row) => {
            let _ = sqlx::query(
                r#"INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
                   VALUES ('backoffice_invitation','backoffice.invitation.created',$1,$2,$3,NOW())"#,
            ).bind(inviter_id).bind(payload.invitee_user_id).bind(json!({
                "application": application.as_str(),
                "role_names": roles,
                "expires_in_days": days
            })).execute(&state.db).await;

            (StatusCode::CREATED, Json(json!({
                "id": row.get::<Uuid,_>("id"),
                "status": row.get::<String,_>("status"),
                "expires_at": row.get::<DateTime<Utc>,_>("expires_at"),
                "application": row.get::<String,_>("application"),
                "role_names": row.get::<Vec<String>,_>("role_names")
            }))).into_response()
        }
        Err(error) => {
            tracing::error!("create backoffice invitation failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn list_backoffice_invitations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let claims = match require_super_admin(&state, &headers).await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"backoffice owner access required"}))).into_response(),
    };
    let inviter_id = match Uuid::parse_str(&claims.sub) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid actor"}))).into_response(),
    };
    let _ = sqlx::query(
        "UPDATE core.backoffice_invitations SET status='expired', responded_at=COALESCE(responded_at,NOW()) WHERE status='pending' AND expires_at < NOW()"
    ).execute(&state.db).await;

    match sqlx::query(
        r#"
        SELECT i.id, i.application, i.role_names, i.status, i.expires_at, i.created_at,
               u.id AS invitee_user_id, u.email::text AS email,
               up.username::text AS username, up.full_name
        FROM core.backoffice_invitations i
        JOIN core.users u ON u.id = i.invitee_user_id
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE i.invited_by = $1
        ORDER BY i.created_at DESC
        LIMIT 100
        "#
    ).bind(inviter_id).fetch_all(&state.db).await {
        Ok(rows) => {
            let data: Vec<Value> = rows.into_iter().map(|row| json!({
                "id": row.get::<Uuid,_>("id"),
                "application": row.get::<String,_>("application"),
                "role_names": row.get::<Vec<String>,_>("role_names"),
                "status": row.get::<String,_>("status"),
                "expires_at": row.get::<DateTime<Utc>,_>("expires_at"),
                "created_at": row.get::<DateTime<Utc>,_>("created_at"),
                "invitee_user_id": row.get::<Uuid,_>("invitee_user_id"),
                "email": row.get::<String,_>("email"),
                "username": row.get::<Option<String>,_>("username"),
                "full_name": row.get::<Option<String>,_>("full_name")
            })).collect();
            (StatusCode::OK, Json(json!({"data": data}))).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response(),
    }
}

pub async fn revoke_backoffice_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invitation_id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match require_super_admin(&state, &headers).await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"backoffice owner access required"}))).into_response(),
    };
    let actor_id = match Uuid::parse_str(&claims.sub) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid actor"}))).into_response(),
    };
    let result = sqlx::query(
        r#"
        UPDATE core.backoffice_invitations
        SET status='revoked', responded_at=NOW(), updated_at=NOW()
        WHERE id=$1 AND invited_by=$2 AND status='pending'
        RETURNING invitee_user_id, application
        "#
    ).bind(invitation_id).bind(actor_id).fetch_optional(&state.db).await;
    match result {
        Ok(Some(row)) => {
            let _ = sqlx::query(
                r#"INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
                   VALUES ('backoffice_invitation','backoffice.invitation.revoked',$1,$2,$3,NOW())"#
            ).bind(actor_id).bind(row.get::<Uuid,_>("invitee_user_id")).bind(json!({
                "application": row.get::<String,_>("application"),
                "invitation_id": invitation_id
            })).execute(&state.db).await;
            (StatusCode::OK, Json(json!({"success":true}))).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error":"pending invitation not found"}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response(),
    }
}

pub async fn list_my_backoffice_invitations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let claims = match decode_access_token(&state.config.jwt_secret, &extract_bearer_token(&headers).unwrap_or_default()) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid token"}))).into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid token subject"}))).into_response(),
    };
    let _ = sqlx::query(
        "UPDATE core.backoffice_invitations SET status='expired', responded_at=COALESCE(responded_at,NOW()) WHERE invitee_user_id=$1 AND status='pending' AND expires_at < NOW()"
    ).bind(user_id).execute(&state.db).await;
    match sqlx::query(
        r#"SELECT id, application, role_names, status, expires_at, created_at
           FROM core.backoffice_invitations
           WHERE invitee_user_id=$1 AND status='pending'
           ORDER BY created_at DESC"#
    ).bind(user_id).fetch_all(&state.db).await {
        Ok(rows) => {
            let data: Vec<Value> = rows.into_iter().map(|row| json!({
                "id": row.get::<Uuid,_>("id"),
                "application": row.get::<String,_>("application"),
                "role_names": row.get::<Vec<String>,_>("role_names"),
                "status": row.get::<String,_>("status"),
                "expires_at": row.get::<DateTime<Utc>,_>("expires_at"),
                "created_at": row.get::<DateTime<Utc>,_>("created_at")
            })).collect();
            (StatusCode::OK, Json(json!({"data": data}))).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response(),
    }
}

pub async fn respond_backoffice_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invitation_id): Path<Uuid>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let token = match extract_bearer_token(&headers) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"missing token"}))).into_response(),
    };
    let claims = match decode_access_token(&state.config.jwt_secret, &token) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid token"}))).into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(value) => value,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid token subject"}))).into_response(),
    };
    let accept = payload.get("accept").and_then(Value::as_bool).unwrap_or(false);

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database transaction error"}))).into_response(),
    };

    let invite = match sqlx::query(
        r#"SELECT i.id, i.application, i.role_names, i.expires_at, u.email::text AS email
           FROM core.backoffice_invitations i
           JOIN core.users u ON u.id=i.invitee_user_id
           WHERE i.id=$1 AND i.invitee_user_id=$2 AND i.status='pending'
           FOR UPDATE"#
    ).bind(invitation_id).bind(user_id).fetch_optional(&mut *tx).await {
        Ok(Some(row)) => row,
        Ok(None) => { let _=tx.rollback().await; return (StatusCode::NOT_FOUND, Json(json!({"error":"invitation not found"}))).into_response(); }
        Err(_) => { let _=tx.rollback().await; return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response(); }
    };

    let expires_at: DateTime<Utc> = invite.get("expires_at");
    if expires_at < Utc::now() {
        let _ = sqlx::query("UPDATE core.backoffice_invitations SET status='expired', responded_at=NOW() WHERE id=$1")
            .bind(invitation_id).execute(&mut *tx).await;
        let _ = tx.commit().await;
        return (StatusCode::GONE, Json(json!({"error":"invitation expired"}))).into_response();
    }

    let application: String = invite.get("application");
    let roles: Vec<String> = invite.get("role_names");
    if !accept {
        let _ = sqlx::query("UPDATE core.backoffice_invitations SET status='rejected', responded_at=NOW(), updated_at=NOW() WHERE id=$1")
            .bind(invitation_id).execute(&mut *tx).await;
        let _ = tx.commit().await;
        return (StatusCode::OK, Json(json!({"success":true,"status":"rejected"}))).into_response();
    }

    let email: String = invite.get("email");
    sqlx::query(
        r#"
        INSERT INTO core.backoffice_google_access (email, application, role_names, status, granted_by, created_at, updated_at)
        VALUES ($1,$2,$3,'approved',$4,NOW(),NOW())
        ON CONFLICT (lower(email::text), application) DO UPDATE
        SET role_names=EXCLUDED.role_names, status='approved', granted_by=EXCLUDED.granted_by, updated_at=NOW()
        "#
    ).bind(&email).bind(&application).bind(&roles).bind(user_id).execute(&mut *tx).await.map_err(|_| ()).ok();

    sqlx::query(
        "UPDATE core.backoffice_invitations SET status='accepted', accepted_at=NOW(), responded_at=NOW(), updated_at=NOW() WHERE id=$1"
    ).bind(invitation_id).execute(&mut *tx).await.map_err(|_| ()).ok();

    sqlx::query("UPDATE core.sessions SET revoked=TRUE WHERE user_id=$1").bind(user_id).execute(&mut *tx).await.map_err(|_| ()).ok();

    if tx.commit().await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to finalize invitation"}))).into_response();
    }

    record_audit_log(state.clone(),"backoffice.invitation.accepted",Some(user_id),Some(json!({
        "invitation_id": invitation_id, "application": application, "role_names": roles
    })),&headers).await;

    (StatusCode::OK, Json(json!({
        "success": true,
        "status": "accepted",
        "application": application,
        "role_names": roles,
        "message": "Akses backoffice aktif setelah login Google yang diizinkan."
    }))).into_response()
}
