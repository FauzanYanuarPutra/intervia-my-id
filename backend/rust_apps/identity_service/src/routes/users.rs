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
use crate::routes::verification::{derive_verification_state, merged_verification_payload};

const MAX_METADATA_BYTES: usize = 48 * 1024;
const MAX_METADATA_DEPTH: usize = 6;
const MAX_METADATA_ARRAY_ITEMS: usize = 64;
const MAX_METADATA_OBJECT_KEYS: usize = 80;
const MAX_STRING_LEN: usize = 500;
const DEFAULT_PROFILE_AVATAR: &str = "/default-avatar.svg";

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

fn read_json_bool(value: &Value) -> Option<bool> {
    match value {
        Value::Bool(flag) => Some(*flag),
        Value::String(text) => match text.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Some(true),
            "false" | "0" | "no" => Some(false),
            _ => None,
        },
        Value::Number(number) => Some(number.as_i64().unwrap_or(0) == 1),
        _ => None,
    }
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

fn sanitize_json_value(value: Value, depth: usize) -> Option<Value> {
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
                if let Some(cleaned) = sanitize_json_value(item, depth + 1) {
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
                if let Some(clean_value) = sanitize_json_value(value, depth + 1) {
                    next.insert(clean_key, clean_value);
                }
            }
            Some(Value::Object(next))
        }
    }
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
        INSERT INTO audit_logs (entity, action, actor_id, metadata, ip_address, user_agent, created_at)
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
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

    let full_name = normalize_optional_text(payload.full_name.or(payload.name));
    let username = normalize_optional_text(payload.username);
    let phone = normalize_optional_text(payload.phone);
    let location = normalize_optional_text(payload.location);
    let bio = normalize_optional_text(payload.bio);
    let avatar_url = Some(DEFAULT_PROFILE_AVATAR.to_string());
    let cover_image =
        normalize_optional_text(payload.cover_image).and_then(|value| normalize_http_url(&value));
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
    let verification_raw = payload
        .verification
        .and_then(|value| sanitize_json_value(value, 0));
    let verification_phone_verified = verification_raw
        .as_ref()
        .and_then(|value| value.get("phone_verified"))
        .and_then(read_json_bool)
        .unwrap_or(false);

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
        "SELECT phone, phone_verified FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
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
        let next_phone_verified = if verification_phone_verified {
            true
        } else if phone_changed {
            false
        } else {
            current_phone_verified
        };
        if sqlx::query(
            "UPDATE users SET phone = $2, phone_verified = $3, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
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
        INSERT INTO user_profiles (user_id, full_name, username, bio, location, updated_at)
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
    let mut verification_patch = match verification_raw {
        Some(Value::Object(map)) => map,
        Some(_) | None => serde_json::Map::new(),
    };
    if phone_changed && !verification_phone_verified {
        verification_patch.insert("phone_verified".to_string(), Value::Bool(false));
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
        "SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
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
