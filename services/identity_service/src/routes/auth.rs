// src/routes/auth.rs
// Final auth implementation: register, login, refresh, logout, me
// See notes in the assistant message for DB/table expectations.

use anyhow::Result;

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use bcrypt::verify as verify_bcrypt;

use axum::{
    extract::{Json, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
};

use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite}; // ✅ Gunakan Axum Cookie

use deadpool_redis::redis::AsyncCommands;

use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};

use rand::{distributions::Alphanumeric, Rng};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use sqlx::{FromRow, Row};

use std::sync::Arc;
use tokio::task;

use chrono::{DateTime, Duration, Utc}; // ✅ Serde enabled via Cargo.toml

use uuid::Uuid;

use crate::config::AppState;
use crate::routes::proofs::{consume_phone_otp_proof, validate_phone_otp_proof};
use crate::routes::verification::{derive_verification_state, merged_verification_payload};

// Optional: cookie::time::Duration for cookie expiry
use cookie::time::Duration as CookieDuration;

// -------------------- Configuration constants --------------------
const MAX_LOGIN_ATTEMPTS: i16 = 5;
const LOCKOUT_DURATION_MINUTES: i64 = 15;
const ACCESS_TOKEN_EXP_HOURS: i64 = 1; // short lived
const CACHE_TTL_SECONDS: u64 = 600; // 10 minutes roles cache (u64 to match redis set_ex expectation)
const REFRESH_TOKEN_LENGTH: usize = 64; // chars for opaque token
const REFRESH_TOKEN_MIN_BYTES: usize = 32;
const RESET_PROOF_AUDIENCE: &str = "identity-reset";
const DEFAULT_PROFILE_AVATAR: &str = "/default-avatar.svg";
// **SECURITY:** Penundaan untuk mitigasi timing attack pada kegagalan login.
const FAILED_LOGIN_DELAY_MS: u64 = 200;
// ----------------------------------------------------------------

// -------------------- Request / Response types --------------------
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub full_name: Option<String>,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct PhoneLoginRequest {
    pub phone: String,
    #[serde(default, alias = "phoneOtpToken")]
    pub phone_otp_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GoogleOAuthRequest {
    pub id_token: String,
    #[serde(default)]
    pub provider_user_id: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64, // seconds
    pub refresh_token: String,
    pub session_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
struct AccessClaims {
    pub sub: String,
    pub exp: usize,
    pub roles: Vec<String>,
    pub perms: Vec<String>,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResetProofClaims {
    pub sub: String,
    pub exp: usize,
    pub purpose: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub aud: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoogleTokenInfo {
    iss: String,
    aud: String,
    sub: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    email_verified: Option<Value>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    picture: Option<String>,
    #[serde(default)]
    exp: Option<String>,
}

#[derive(Debug)]
struct VerifiedGoogleIdentity {
    provider_user_id: String,
    email: String,
    email_verified: bool,
    name: Option<String>,
    picture: Option<String>,
    raw_profile: Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RolesPermissions {
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

// Helper untuk query gabungan roles/permissions
#[derive(Debug, FromRow)]
struct RolesPermissionsRow {
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UserData {
    id: Uuid,
    password_hash: Option<String>,
    is_active: bool,
    failed_login_attempts: i16,
    lockout_expires_at: Option<DateTime<Utc>>,
    username: Option<String>,
}
// ------------------------------------------------------------------

// -------------------- Utility: password hashing & verifying -------
// (Unchanged - Already uses spawn_blocking for performance)
async fn hash_password(password: &str) -> Result<String> {
    let pw = password.to_owned();
    task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut rand::thread_rng());
        let argon2 = Argon2::default();
        argon2
            .hash_password(pw.as_bytes(), &salt)
            .map(|ph| ph.to_string())
            .map_err(|e| anyhow::anyhow!("argon2 hash error: {:?}", e))
    })
    .await?
}

async fn verify_password(hash: &str, password: &str) -> bool {
    let hash = hash.to_owned();
    let password = password.to_owned();
    task::spawn_blocking(move || {
        if hash.starts_with("$2a$") || hash.starts_with("$2b$") || hash.starts_with("$2y$") {
            return verify_bcrypt(&password, &hash).unwrap_or(false);
        }
        PasswordHash::new(&hash)
            .map(|parsed| {
                Argon2::default()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

fn validate_password_strength(password: &str) -> Result<(), &'static str> {
    if password.len() < 10 {
        return Err("new password too short");
    }
    if password.chars().any(char::is_whitespace) {
        return Err("new password cannot contain spaces");
    }
    if !password.chars().any(|ch| ch.is_ascii_uppercase()) {
        return Err("new password must include an uppercase letter");
    }
    if !password.chars().any(|ch| ch.is_ascii_lowercase()) {
        return Err("new password must include a lowercase letter");
    }
    if !password.chars().any(|ch| ch.is_ascii_digit()) {
        return Err("new password must include a number");
    }
    if !password.chars().any(|ch| !ch.is_ascii_alphanumeric()) {
        return Err("new password must include a symbol");
    }
    Ok(())
}
// ------------------------------------------------------------------

// -------------------- Audit log helper ----------------------------
// **SECURITY:** Menambahkan parameter ip_address dan user_agent.
async fn record_audit_log(
    state: Arc<AppState>,
    entity: String, // Owned String, bukan &str
    event: &'static str,
    source_user_id: Option<Uuid>,
    target_user_id: Option<Uuid>,
    metadata: Option<Value>,
    request_context: (Option<String>, Option<String>),
) {
    let (ip_address, user_agent) = request_context;
    let s = state.clone();
    tokio::spawn(async move {
        let _ = sqlx::query(
            r#"
            INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, ip_address, user_agent, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            "#
        )
        .bind(&entity)
        .bind(event)
        .bind(source_user_id)
        .bind(target_user_id)
        .bind(metadata.unwrap_or_else(|| json!({})))
        .bind(ip_address)
        .bind(user_agent)
        .execute(&s.db)
        .await;
    });
}

// ------------------------------------------------------------------

// -------------------- Header / Audit Context Helpers ----------------
fn extract_audit_info(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    // Cari IP dari header X-Real-Ip atau X-Forwarded-For (standar proxy)
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

fn should_secure_cookies(state: &AppState, headers: &HeaderMap) -> bool {
    if state.config.is_dev() {
        return false;
    }

    headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|value| {
            value
                .split(',')
                .next()
                .map(|v| v.trim().eq_ignore_ascii_case("https"))
                .unwrap_or(true)
        })
        .unwrap_or(true)
}

fn normalize_phone_digits(raw: &str) -> String {
    raw.chars().filter(|ch| ch.is_ascii_digit()).collect()
}

fn mask_phone_for_log(raw: &str) -> String {
    let digits = normalize_phone_digits(raw);
    if digits.len() <= 4 {
        return format!("****{}", digits);
    }
    format!("****{}", &digits[digits.len() - 4..])
}

fn normalize_optional_email(raw: Option<&str>) -> Option<String> {
    raw.and_then(|value| {
        let email = value.trim().to_lowercase();
        if email.is_empty() {
            None
        } else {
            Some(email)
        }
    })
}

fn normalize_username(raw: &str) -> String {
    raw.trim()
        .trim_start_matches('@')
        .to_ascii_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '_' || *ch == '.')
        .collect()
}

fn validate_username(username: &str) -> Result<(), &'static str> {
    if username.len() < 3 {
        return Err("username too short");
    }
    if username.len() > 30 {
        return Err("username too long");
    }
    if username.starts_with('.') || username.ends_with('.') || username.contains("..") {
        return Err("username format is invalid");
    }
    if !username
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '.')
    {
        return Err("username contains unsupported characters");
    }
    Ok(())
}

fn mask_identifier_for_log(raw: &str) -> String {
    let trimmed = raw.trim();
    let visible: String = trimmed.chars().take(3).collect();
    if visible.chars().count() < 3 {
        return "***".to_string();
    }
    format!("{}***", visible)
}

async fn verify_google_oauth_schema(state: &Arc<AppState>) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT
            to_regclass('core.users') IS NOT NULL
            AND to_regclass('core.user_profiles') IS NOT NULL
            AND to_regclass('core.user_identities') IS NOT NULL
        "#,
    )
    .fetch_one(&state.db)
    .await
}

fn google_username_base(email: &str, name: Option<&str>) -> String {
    let source = name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| email.split('@').next().unwrap_or("user"));
    let normalized = normalize_username(source);
    let trimmed = normalized.trim_matches('.').to_string();
    if trimmed.len() >= 3 {
        trimmed.chars().take(24).collect()
    } else {
        "user".to_string()
    }
}

async fn generate_google_username(
    state: &Arc<AppState>,
    email: &str,
    name: Option<&str>,
) -> String {
    let base = google_username_base(email, name);
    for attempt in 0..20 {
        let candidate = if attempt == 0 {
            base.clone()
        } else {
            format!(
                "{}{}",
                base.chars().take(20).collect::<String>(),
                attempt + 1
            )
        };
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM core.user_profiles WHERE lower(username::text) = lower($1) LIMIT 1)",
        )
        .bind(&candidate)
        .fetch_one(&state.db)
        .await
        .unwrap_or(true);
        if !exists {
            return candidate;
        }
    }
    format!("user{}", &Uuid::new_v4().simple().to_string()[..10])
}

fn verify_reset_proof(secret: &str, proof: &str, email: &str) -> bool {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.set_audience(&[RESET_PROOF_AUDIENCE]);

    let claims = decode::<ResetProofClaims>(
        proof,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|token| token.claims);

    match claims {
        Ok(claims) => {
            if claims.purpose != "password_reset" {
                return false;
            }

            let email_match_sub = claims.sub.trim().eq_ignore_ascii_case(email);
            let email_match_field = claims
                .email
                .as_deref()
                .map(|value| value.trim().eq_ignore_ascii_case(email))
                .unwrap_or(true);

            email_match_sub && email_match_field
        }
        Err(_) => false,
    }
}

fn json_value_as_bool(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value.eq_ignore_ascii_case("true"),
        _ => false,
    }
}

async fn verify_google_id_token(
    google_client_id: &str,
    id_token: &str,
) -> Result<VerifiedGoogleIdentity, &'static str> {
    let token = id_token.trim();
    if token.is_empty() {
        return Err("missing google id token");
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|_| "google verifier unavailable")?;

    let response = client
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", token)])
        .send()
        .await
        .map_err(|_| "google token verification failed")?;

    if !response.status().is_success() {
        return Err("invalid google id token");
    }

    let token_info = response
        .json::<GoogleTokenInfo>()
        .await
        .map_err(|_| "invalid google token response")?;

    if token_info.iss != "https://accounts.google.com" && token_info.iss != "accounts.google.com" {
        return Err("invalid google token issuer");
    }

    if token_info.aud != google_client_id {
        return Err("invalid google token audience");
    }

    let exp = token_info
        .exp
        .as_deref()
        .and_then(|value| value.parse::<i64>().ok())
        .ok_or("invalid google token expiry")?;
    if exp <= Utc::now().timestamp() {
        return Err("expired google id token");
    }

    let email = token_info
        .email
        .as_deref()
        .map(str::trim)
        .filter(|value| value.contains('@'))
        .map(str::to_lowercase)
        .ok_or("google token email missing")?;
    let email_verified = json_value_as_bool(token_info.email_verified.as_ref());
    if !email_verified {
        return Err("google account email not verified");
    }

    let raw_profile = serde_json::to_value(&token_info).unwrap_or_else(|_| json!({}));

    Ok(VerifiedGoogleIdentity {
        provider_user_id: token_info.sub,
        email,
        email_verified,
        name: token_info
            .name
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        picture: token_info
            .picture
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        raw_profile,
    })
}
// ------------------------------------------------------------------

// -------------------- Redis cache helpers -------------------------
async fn invalidate_roles_cache_for_user(state: Arc<AppState>, user_id: Uuid) {
    if let Ok(mut conn) = state.redis.get().await {
        let key = format!("user:roles:{}", user_id);
        let _ = conn.del::<String, ()>(key).await;
    } else {
        tracing::warn!(
            "Failed to get redis connection to invalidate roles cache for {}",
            user_id
        );
    }
}

// **PERFORMANCE:** Query digabungkan menjadi satu round-trip DB menggunakan ARRAY_AGG.
async fn get_roles_permissions_cached(
    state: &Arc<AppState>,
    user_id: Uuid,
) -> Result<RolesPermissions, sqlx::Error> {
    let cache_key = format!("user:roles:{}", user_id);

    // Try redis first
    if let Ok(mut conn) = state.redis.get().await {
        let redis_result: Result<Option<String>, _> =
            conn.get::<_, Option<String>>(cache_key.clone()).await;
        if let Ok(Some(cached_json)) = redis_result {
            if let Ok(rp) = serde_json::from_str::<RolesPermissions>(&cached_json) {
                return Ok(rp);
            } else {
                tracing::warn!("Failed to parse cached roles json for user {}", user_id);
            }
        }
    }

    // Cache miss -> query DB (single optimized query)
    // Menggunakan LEFT JOIN untuk memastikan user tetap mendapat {[], []} jika tidak punya role/permission.
    let row = sqlx::query_as::<_, RolesPermissionsRow>(
        r#"
        SELECT 
            COALESCE(ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
            COALESCE(ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
        FROM core.user_roles ur
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1
        GROUP BY ur.user_id -- Meskipun hanya 1 baris, GROUP BY memastikan ARRAY_AGG bekerja
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let rp = match row {
        Some(r) => RolesPermissions {
            roles: r.roles,
            permissions: r.permissions,
        },
        None => RolesPermissions {
            roles: vec![],
            permissions: vec![],
        },
    };

    // set cache async (best-effort)
    let json_str = match serde_json::to_string(&rp) {
        Ok(s) => s,
        Err(_) => return Ok(rp), // if serialize fails, just return rp
    };
    let cache_key_clone = cache_key.clone();
    let state_clone = state.clone();
    tokio::spawn(async move {
        if let Ok(mut conn) = state_clone.redis.get().await {
            let _ = conn
                .set_ex::<String, String, ()>(cache_key_clone, json_str, CACHE_TTL_SECONDS)
                .await;
        }
    });

    Ok(rp)
}
// ------------------------------------------------------------------

// -------------------- Refresh token helpers -----------------------
// (Unchanged - Already secure/performant with Argon2 and spawn_blocking)
async fn generate_opaque_refresh_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(REFRESH_TOKEN_LENGTH)
        .map(char::from)
        .collect()
}

async fn hash_refresh_token(token: &str) -> Result<String> {
    let t = token.to_owned();
    task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut rand::thread_rng());
        let argon2 = Argon2::default();
        argon2
            .hash_password(t.as_bytes(), &salt)
            .map(|ph| ph.to_string())
            .map_err(|e| anyhow::anyhow!("argon2 refresh token hash error: {:?}", e))
    })
    .await?
}

async fn verify_refresh_token_hash(hash: &str, token: &str) -> bool {
    let h = hash.to_owned();
    let t = token.to_owned();
    task::spawn_blocking(move || {
        PasswordHash::new(&h)
            .map(|parsed| {
                Argon2::default()
                    .verify_password(t.as_bytes(), &parsed)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

// (Unchanged - Already handles atomic session creation)
async fn store_refresh_session(
    state: &Arc<AppState>,
    user_id: Uuid,
    refresh_token_hash: &str,
    expires_at: DateTime<Utc>,
    rotated_from: Option<Uuid>,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.sessions (id, user_id, refresh_token_hash, expires_at, rotated_from, revoked, created_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW())
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(refresh_token_hash)
    .bind(expires_at)
    .bind(rotated_from)
    .execute(&state.db)
    .await?;
    Ok(id)
}

// (Unchanged - Already uses DB transaction for atomicity/security)
async fn rotate_refresh_token(
    state: &Arc<AppState>,
    old_session_id: Uuid,
    user_id: Uuid,
) -> Result<(String, Uuid), anyhow::Error> {
    let now = Utc::now();
    let new_token = generate_opaque_refresh_token().await;
    let new_hash = hash_refresh_token(&new_token).await?;
    let new_expires = now + chrono::Duration::days(state.config.refresh_token_exp_days);

    let mut tx = state.db.begin().await?;
    let active_user = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT is_active
        FROM core.users
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
        "#,
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if active_user != Some(true) {
        anyhow::bail!("refresh rejected for inactive account");
    }

    let revoked = sqlx::query(
        "UPDATE core.sessions SET revoked = true WHERE id = $1 AND user_id = $2 AND revoked = false",
    )
        .bind(old_session_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    if revoked.rows_affected() != 1 {
        anyhow::bail!("refresh session was already rotated or revoked");
    }

    let new_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.sessions (id, user_id, refresh_token_hash, expires_at, rotated_from, revoked, created_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW())
        "#,
    )
    .bind(new_id)
    .bind(user_id)
    .bind(&new_hash)
    .bind(new_expires)
    .bind(Some(old_session_id))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((new_token, new_id))
}

// (Unchanged)
async fn revoke_refresh_session(state: &Arc<AppState>, session_id: Uuid) {
    let _ = sqlx::query("UPDATE core.sessions SET revoked = true WHERE id = $1")
        .bind(session_id)
        .execute(&state.db)
        .await;
}

// (Unchanged)
async fn find_and_verify_session(
    state: &Arc<AppState>,
    session_id: Uuid,
    provided_token: &str,
) -> Result<Option<(Uuid, DateTime<Utc>)>, sqlx::Error> {
    let row_opt = sqlx::query(
        r#"
        SELECT s.user_id, s.refresh_token_hash, s.expires_at, s.revoked
        FROM core.sessions s
        INNER JOIN core.users u ON u.id = s.user_id
        WHERE s.id = $1
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(session_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(row) = row_opt {
        let revoked: bool = row.get("revoked");
        let expires_at: DateTime<Utc> = row.get("expires_at");
        let user_id: Uuid = row.get("user_id");
        let stored_hash: String = row.get("refresh_token_hash");

        if revoked {
            return Ok(None);
        }
        if Utc::now() > expires_at {
            return Ok(None);
        }
        if verify_refresh_token_hash(&stored_hash, provided_token).await {
            return Ok(Some((user_id, expires_at)));
        } else {
            // **SECURITY:** Revoke the entire session chain if a token is presented but fails verification.
            // This is critical for preventing token replay attacks (e.g., if a user doesn't update their refresh token).
            let _ = sqlx::query(
                "UPDATE core.sessions SET revoked = true WHERE rotated_from = $1 OR id = $1",
            )
            .bind(session_id)
            .execute(&state.db)
            .await;
            return Ok(None);
        }
    }
    Ok(None)
}
// ------------------------------------------------------------------

// -------------------- Helper: create access token -----------------
// (Unchanged)
fn create_access_token(
    secret: &str,
    user_id: Uuid,
    username: String, // Tambahkan parameter ini
    expiry_hours: i64,
    roles: Vec<String>,
    permissions: Vec<String>,
) -> Result<String, anyhow::Error> {
    let exp = (Utc::now() + chrono::Duration::hours(expiry_hours)).timestamp() as usize;
    let claims = AccessClaims {
        sub: user_id.to_string(),
        exp,
        roles,
        perms: permissions,
        username, // Masukkan ke claims
    };
    let header = Header::new(Algorithm::HS256);
    let token = encode(
        &header,
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| anyhow::anyhow!("jwt encode error: {:?}", e))?;
    Ok(token)
}

// (Unchanged)
fn decode_access_token(secret: &str, token: &str) -> Result<AccessClaims, anyhow::Error> {
    let validation = Validation::new(Algorithm::HS256);
    let data = decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| anyhow::anyhow!("jwt decode error: {:?}", e))?;
    Ok(data.claims)
}
// ------------------------------------------------------------------

// -------------------- Handlers: register, login, refresh, logout, me --------------------

pub async fn register(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> impl IntoResponse {
    let state = state.clone();
    let secure_cookie = should_secure_cookies(&state, &headers);
    let (ip_address, user_agent) = extract_audit_info(&headers);

    let phone = payload
        .phone
        .as_deref()
        .map(normalize_phone_digits)
        .filter(|value| !value.is_empty());
    let masked_phone = phone.as_deref().map(mask_phone_for_log);
    let email = normalize_optional_email(payload.email.as_deref());
    let username = normalize_username(&payload.username);
    let username_attempt = mask_identifier_for_log(&username);

    if let Err(reason) = validate_username(&username) {
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "register.conflict",
            None,
            None,
            Some(json!({"username_attempt": username_attempt, "reason": reason})),
            (ip_address.clone(), user_agent.clone()),
        )
        .await;

        return (StatusCode::BAD_REQUEST, Json(json!({"error": reason}))).into_response();
    }

    if let Err(reason) = validate_password_strength(&payload.password) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": reason}))).into_response();
    }

    if let Some(phone_value) = phone.as_ref() {
        if phone_value.len() < 8 {
            record_audit_log(
                state.clone(),
                "user".to_string(),
                "register.conflict",
                None,
                None,
                Some(json!({"phone_attempt": masked_phone.clone(), "reason": "invalid phone"})),
                (ip_address.clone(), user_agent.clone()),
            )
            .await;

            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"invalid phone number"})),
            )
                .into_response();
        }
    }

    if let Some(email_value) = email.as_ref() {
        if email_value.len() < 5 || !email_value.contains('@') {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"invalid email address"})),
            )
                .into_response();
        }
    }

    match sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)
        FROM core.user_profiles up
        INNER JOIN core.users u ON u.id = up.user_id
        WHERE u.deleted_at IS NULL
          AND lower(up.username::text) = lower($1)
        "#,
    )
    .bind(&username)
    .fetch_one(&state.db)
    .await
    {
        Ok(count) if count > 0 => {
            record_audit_log(
                state.clone(),
                "user".to_string(),
                "register.conflict",
                None,
                None,
                Some(json!({"username_attempt": username_attempt, "reason": "duplicate username"})),
                (ip_address.clone(), user_agent.clone()),
            )
            .await;
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "username already registered"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("DB error checking username exists: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
        _ => {}
    }

    if let Some(phone_value) = phone.as_ref() {
        match sqlx::query_scalar::<_, i64>(
            r#"
        SELECT COUNT(1)
        FROM users
        WHERE deleted_at IS NULL
          AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
        "#,
        )
        .bind(phone_value)
        .fetch_one(&state.db)
        .await
        {
            Ok(count) if count > 0 => {
                record_audit_log(
                    state.clone(),
                    "user".to_string(),
                    "register.conflict",
                    None,
                    None,
                    Some(json!({"phone_attempt": masked_phone.clone()})),
                    (ip_address.clone(), user_agent.clone()),
                )
                .await;
                return (
                    StatusCode::CONFLICT,
                    Json(json!({"error": "phone number already registered"})),
                )
                    .into_response();
            }
            Err(e) => {
                tracing::error!("DB error checking phone exists: {:?}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"db error"})),
                )
                    .into_response();
            }
            _ => {}
        }
    }

    if let Some(email_value) = email.as_ref() {
        match sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(1) FROM core.users WHERE deleted_at IS NULL AND email = $1",
        )
        .bind(email_value)
        .fetch_one(&state.db)
        .await
        {
            Ok(count) if count > 0 => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({"error": "email already registered"})),
                )
                    .into_response();
            }
            Err(e) => {
                tracing::error!("DB error checking email exists: {:?}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"db error"})),
                )
                    .into_response();
            }
            _ => {}
        }
    }

    let user_id = Uuid::new_v4();
    let password_hash = match hash_password(&payload.password).await {
        Ok(hash) => hash,
        Err(error) => {
            tracing::error!("hash password error on register: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"password setup failed"})),
            )
                .into_response();
        }
    };

    // Mulai transaksi DB
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("tx begin error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    // Insert user
    let res = sqlx::query(
        r#"INSERT INTO core.users (id, email, email_verified, phone, phone_verified, password_hash, is_active, created_at, updated_at)
            VALUES ($1, $2, FALSE, $3, FALSE, $4, TRUE, NOW(), NOW())"#,
    )
    .bind(user_id)
    .bind(email.clone())
    .bind(phone.clone())
    .bind(&password_hash)
    .execute(&mut *tx)
    .await;

    if let Err(e) = res {
        tracing::error!("insert user error: {:?}", e);
        let _ = tx.rollback().await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"db error"})),
        )
            .into_response();
    }

    if let Err(e) = sqlx::query(
        r#"INSERT INTO core.user_profiles (user_id, full_name, username, created_at)
            VALUES ($1, $2, $3, NOW())"#,
    )
    .bind(user_id)
    .bind(payload.full_name.clone())
    .bind(username.clone())
    .execute(&mut *tx)
    .await
    {
        tracing::error!("insert profile error: {:?}", e);
        let _ = tx.rollback().await;
        let error_text = e.to_string().to_lowercase();
        if error_text.contains("duplicate") || error_text.contains("unique") {
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "username already registered"})),
            )
                .into_response();
        }
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"db error"})),
        )
            .into_response();
    }

    // Commit transaksi
    if let Err(e) = tx.commit().await {
        tracing::error!("tx commit err: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"db error"})),
        )
            .into_response();
    }

    // Assign default role "buyer" jika ada
    match sqlx::query_scalar::<_, Uuid>("SELECT id FROM roles WHERE name = 'buyer' LIMIT 1")
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(role_id)) => {
            let _ = sqlx::query(
                "INSERT INTO core.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(role_id)
            .execute(&state.db)
            .await;
            invalidate_roles_cache_for_user(state.clone(), user_id).await;
        }
        Ok(None) => tracing::warn!("default role buyer not present"),
        Err(e) => tracing::error!("error fetching default role: {:?}", e),
    }

    let rp = get_roles_permissions_cached(&state, user_id)
        .await
        .unwrap_or(RolesPermissions {
            roles: vec![],
            permissions: vec![],
        });
    let access_token = match create_access_token(
        &state.config.jwt_secret,
        user_id,
        username.clone(),
        ACCESS_TOKEN_EXP_HOURS,
        rp.roles.clone(),
        rp.permissions.clone(),
    ) {
        Ok(token) => token,
        Err(error) => {
            tracing::error!("create access token error on register: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"token creation failed"})),
            )
                .into_response();
        }
    };

    let refresh_opaque = generate_opaque_refresh_token().await;
    let refresh_hash = match hash_refresh_token(&refresh_opaque).await {
        Ok(hash) => hash,
        Err(error) => {
            tracing::error!("hash refresh token error on register: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"token creation failed"})),
            )
                .into_response();
        }
    };
    let expires_at = Utc::now() + Duration::days(state.config.refresh_token_exp_days);
    let session_id =
        match store_refresh_session(&state, user_id, &refresh_hash, expires_at, None).await {
            Ok(id) => id,
            Err(error) => {
                tracing::error!("store refresh session error on register: {:?}", error);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"token creation failed"})),
                )
                    .into_response();
            }
        };

    record_audit_log(
        state.clone(),
        "user".to_string(),
        "registered",
        Some(user_id),
        Some(user_id),
        Some(json!({
            "phone": masked_phone,
            "email": email.clone(),
            "username": username_attempt,
            "method": "username_password",
            "verified": false
        })),
        (ip_address, user_agent),
    )
    .await;

    let cookie_access_token = Cookie::build(("access_token", access_token.clone()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();
    let cookie_refresh_token = Cookie::build(("refresh_token", refresh_opaque.clone()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();
    let cookie_session = Cookie::build(("session_id", session_id.to_string()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();
    let jar = jar
        .add(cookie_access_token)
        .add(cookie_refresh_token)
        .add(cookie_session);

    (
        StatusCode::CREATED,
        jar,
        Json(json!({
            "message":"registered",
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_EXP_HOURS * 3600,
            "refresh_token": refresh_opaque,
            "session_id": session_id,
            "user": {
                "id": user_id,
                "phone": phone,
                "email": email,
                "username": username,
                "roles": rp.roles,
                "permissions": rp.permissions,
                "phone_verified": false,
                "email_verified": false
            }
        })),
    )
        .into_response()
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    let secure_cookie = should_secure_cookies(&state, &headers);
    let identifier = payload
        .username
        .as_deref()
        .or(payload.email.as_deref())
        .unwrap_or_default()
        .trim()
        .trim_start_matches('@')
        .to_lowercase();
    let identifier_attempt = mask_identifier_for_log(&identifier);
    let (ip_address, user_agent) = extract_audit_info(&headers);

    // 1. Validasi dasar input
    if identifier.is_empty() || payload.password.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid input"})),
        )
            .into_response();
    }

    // 2. Ambil data user dari DB
    let row = match sqlx::query(
        r#"SELECT u.id, u.password_hash, u.is_active, u.failed_login_attempts, 
                    u.lockout_expires_at, up.username
            FROM core.users u LEFT JOIN core.user_profiles up ON u.id = up.user_id
            WHERE u.deleted_at IS NULL
              AND (
                lower(COALESCE(u.email::text, '')) = lower($1)
                OR lower(COALESCE(up.username::text, '')) = lower($1)
              )
            LIMIT 1"#,
    )
    .bind(&identifier)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            tokio::time::sleep(std::time::Duration::from_millis(FAILED_LOGIN_DELAY_MS)).await;
            // Audit log gagal login email tidak ditemukan
            record_audit_log(
                state.clone(),
                "user".to_string(),
                "login.failed",
                None,
                None,
                Some(json!({"identifier_attempt": identifier_attempt.clone(), "reason": "not found"})),
            (ip_address.clone(), user_agent.clone()),
            )
            .await;

            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid credentials"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("DB Error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"server error"})),
            )
                .into_response();
        }
    };

    // Ambil field dari row
    let user_data = UserData {
        id: row.get::<Uuid, _>("id"),
        password_hash: row.get::<Option<String>, _>("password_hash"),
        is_active: row.get::<bool, _>("is_active"),
        failed_login_attempts: row.get::<i16, _>("failed_login_attempts"),
        lockout_expires_at: row.get::<Option<DateTime<Utc>>, _>("lockout_expires_at"),
        username: row.get::<Option<String>, _>("username"),
    };

    // 3. Cek status dan lockout
    if !user_data.is_active {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"account deactivated"})),
        )
            .into_response();
    }
    if let Some(lock_until) = user_data.lockout_expires_at {
        if lock_until > Utc::now() {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "account locked"})),
            )
                .into_response();
        }
    }

    // 4. Cek password
    let Some(password_hash) = user_data.password_hash.as_deref() else {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"password login is not available for this account"})),
        )
            .into_response();
    };

    if !verify_password(password_hash, &payload.password).await {
        let lock_dt = Utc::now() + Duration::minutes(LOCKOUT_DURATION_MINUTES);

        let _ = sqlx::query(
            "UPDATE core.users SET failed_login_attempts = failed_login_attempts + 1, 
            lockout_expires_at = CASE WHEN failed_login_attempts + 1 >= $1 THEN $2 ELSE NULL END 
            WHERE id = $3",
        )
        .bind(MAX_LOGIN_ATTEMPTS)
        .bind(lock_dt)
        .bind(user_data.id)
        .execute(&state.db)
        .await;

        tokio::time::sleep(std::time::Duration::from_millis(FAILED_LOGIN_DELAY_MS)).await;

        // Audit log gagal login password salah
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "login.failed",
            Some(user_data.id),
            Some(user_data.id),
            Some(json!({"identifier_attempt": identifier_attempt.clone(), "reason": "wrong password"})),
            (ip_address.clone(), user_agent.clone()),
        )
        .await;

        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid credentials"})),
        )
            .into_response();
    }

    // 5. Transactional token issuance
    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"transaction failed"})),
            )
                .into_response()
        }
    };

    let _ = sqlx::query(
        "UPDATE core.users 
            SET failed_login_attempts = 0, 
                lockout_expires_at = NULL, 
                last_login_at = NOW() 
            WHERE id = $1",
    )
    .bind(user_data.id)
    .execute(&mut *tx)
    .await;

    let rp = get_roles_permissions_cached(&state, user_data.id)
        .await
        .unwrap_or(RolesPermissions {
            roles: vec![],
            permissions: vec![],
        });

    let access_token = create_access_token(
        &state.config.jwt_secret,
        user_data.id,
        user_data
            .username
            .clone()
            .unwrap_or_else(|| "user".to_string()),
        ACCESS_TOKEN_EXP_HOURS,
        rp.roles.clone(),
        rp.permissions.clone(),
    )
    .expect("JWT failed");

    let refresh_opaque = generate_opaque_refresh_token().await;
    let refresh_hash = hash_refresh_token(&refresh_opaque)
        .await
        .expect("Hash failed");
    let expires_at = Utc::now() + Duration::days(state.config.refresh_token_exp_days);

    let sid: Uuid =
        match store_refresh_session(&state, user_data.id, &refresh_hash, expires_at, None).await {
            Ok(id) => id,
            Err(e) => {
                tracing::error!("Failed to store refresh session: {:?}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"server error"})),
                )
                    .into_response();
            }
        };

    if tx.commit().await.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"commit failed"})),
        )
            .into_response();
    }

    // Audit log login sukses
    record_audit_log(
        state.clone(),
        "user".to_string(),
        "login.success",
        Some(user_data.id),
        Some(user_data.id),
        Some(json!({"identifier_attempt": identifier_attempt})),
        (ip_address, user_agent),
    )
    .await;

    let cookie_access_token = Cookie::build(("access_token", access_token.clone()))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    // 1. Perbaiki pembuatan cookie (satu per satu)
    let cookie_refresh_token = Cookie::build(("refresh_token", refresh_opaque.clone()))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    let cookie_session = Cookie::build(("session_id", sid.to_string()))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    // 2. Gabungkan ke dalam jar
    let jar = jar
        .add(cookie_access_token)
        .add(cookie_refresh_token)
        .add(cookie_session);

    // 3. Urutan Tuple yang Benar: (Status, Jar, Body)
    (
        StatusCode::OK, // Status PERTAMA
        jar,            // Jar KEDUA
        Json(json!({     // Body TERAKHIR
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_EXP_HOURS * 3600,
            "refresh_token": refresh_opaque,
            "session_id": sid,
            "user": { "id": user_data.id, "roles": rp.roles }
        })),
    )
        .into_response()
}

pub async fn login_phone(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<PhoneLoginRequest>,
) -> impl IntoResponse {
    let secure_cookie = should_secure_cookies(&state, &headers);
    let phone = normalize_phone_digits(&payload.phone);
    let masked_phone = mask_phone_for_log(&phone);
    let (ip_address, user_agent) = extract_audit_info(&headers);

    if phone.len() < 8 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid phone"})),
        )
            .into_response();
    }

    let phone_otp_token = payload
        .phone_otp_token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let otp_verified = match phone_otp_token {
        Some(token) => {
            match validate_phone_otp_proof(&state, token, &phone, &["login", "register"]).await {
                Ok(verified) => verified,
                Err(error) => {
                    tracing::error!("phone login proof verification unavailable: {:?}", error);
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

    if !otp_verified {
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "login.failed",
            None,
            None,
            Some(json!({"phone_attempt": masked_phone, "reason": "invalid phone proof"})),
            (ip_address, user_agent),
        )
        .await;
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid or expired phone login verification"})),
        )
            .into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT
            u.id,
            u.is_active,
            u.failed_login_attempts,
            u.lockout_expires_at,
            up.full_name,
            up.username
        FROM core.users u
        LEFT JOIN core.user_profiles up ON u.id = up.user_id
        WHERE u.deleted_at IS NULL
          AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $1
        LIMIT 2
        "#,
    )
    .bind(&phone)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("phone login query error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"server error"})),
            )
                .into_response();
        }
    };

    if rows.is_empty() {
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "login.failed",
            None,
            None,
            Some(json!({"phone_attempt": masked_phone, "reason": "not found"})),
            (ip_address.clone(), user_agent.clone()),
        )
        .await;

        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"phone login is not available"})),
        )
            .into_response();
    }

    if rows.len() > 1 {
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "login.failed",
            None,
            None,
            Some(json!({"phone_attempt": masked_phone, "reason": "duplicate phone"})),
            (ip_address.clone(), user_agent.clone()),
        )
        .await;

        return (
            StatusCode::CONFLICT,
            Json(json!({"error":"phone number is linked to multiple accounts"})),
        )
            .into_response();
    }

    let row = &rows[0];
    let user_id = row.get::<Uuid, _>("id");
    let is_active = row.get::<bool, _>("is_active");
    let failed_login_attempts = row.get::<i16, _>("failed_login_attempts");
    let lockout_expires_at = row.get::<Option<DateTime<Utc>>, _>("lockout_expires_at");
    let full_name = row.get::<Option<String>, _>("full_name");
    let username = row.get::<Option<String>, _>("username");

    if !is_active {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"account deactivated"})),
        )
            .into_response();
    }

    if let Some(lock_until) = lockout_expires_at {
        if lock_until > Utc::now() {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error":"account locked"})),
            )
                .into_response();
        }
    }

    let proof_consumed = match phone_otp_token {
        Some(token) => {
            match consume_phone_otp_proof(&state, token, &phone, &["login", "register"]).await {
                Ok(consumed) => consumed,
                Err(error) => {
                    tracing::error!("phone login proof consumption unavailable: {:?}", error);
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
    if !proof_consumed {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid or expired phone login verification"})),
        )
            .into_response();
    }

    let user_data = UserData {
        id: user_id,
        password_hash: None,
        is_active,
        failed_login_attempts,
        lockout_expires_at,
        username,
    };

    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"transaction failed"})),
            )
                .into_response()
        }
    };

    let _ = sqlx::query(
        "UPDATE users
            SET failed_login_attempts = 0,
                lockout_expires_at = NULL,
                last_login_at = NOW(),
                phone_verified = TRUE
            WHERE id = $1",
    )
    .bind(user_data.id)
    .execute(&mut *tx)
    .await;

    let rp = get_roles_permissions_cached(&state, user_data.id)
        .await
        .unwrap_or(RolesPermissions {
            roles: vec![],
            permissions: vec![],
        });

    let access_token = create_access_token(
        &state.config.jwt_secret,
        user_data.id,
        user_data
            .username
            .clone()
            .unwrap_or_else(|| "user".to_string()),
        ACCESS_TOKEN_EXP_HOURS,
        rp.roles.clone(),
        rp.permissions.clone(),
    )
    .expect("JWT failed");

    let refresh_opaque = generate_opaque_refresh_token().await;
    let refresh_hash = hash_refresh_token(&refresh_opaque)
        .await
        .expect("Hash failed");
    let expires_at = Utc::now() + Duration::days(state.config.refresh_token_exp_days);

    let sid: Uuid =
        match store_refresh_session(&state, user_data.id, &refresh_hash, expires_at, None).await {
            Ok(id) => id,
            Err(error) => {
                tracing::error!(
                    "Failed to store refresh session for phone login: {:?}",
                    error
                );
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"server error"})),
                )
                    .into_response();
            }
        };

    if tx.commit().await.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"commit failed"})),
        )
            .into_response();
    }

    record_audit_log(
        state.clone(),
        "user".to_string(),
        "login.success",
        Some(user_data.id),
        Some(user_data.id),
        Some(json!({"phone_attempt": masked_phone, "method": "phone_otp"})),
        (ip_address, user_agent),
    )
    .await;

    let cookie_access_token = Cookie::build(("access_token", access_token.clone()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    let cookie_refresh_token = Cookie::build(("refresh_token", refresh_opaque.clone()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    let cookie_session = Cookie::build(("session_id", sid.to_string()))
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(30))
        .build();

    let jar = jar
        .add(cookie_access_token)
        .add(cookie_refresh_token)
        .add(cookie_session);

    (
        StatusCode::OK,
        jar,
        Json(json!({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_EXP_HOURS * 3600,
            "refresh_token": refresh_opaque,
            "session_id": sid,
            "user": {
                "id": user_data.id,
                "phone": phone,
                "full_name": full_name,
                "roles": rp.roles
            }
        })),
    )
        .into_response()
}

pub async fn oauth_google(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<GoogleOAuthRequest>,
) -> impl IntoResponse {
    let state = state.clone();
    let (ip_address, user_agent) = extract_audit_info(&headers);

    let google_client_id = match state.config.google_client_id.as_deref() {
        Some(value) => value,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error":"google oauth not configured"})),
            )
                .into_response();
        }
    };

    let google_identity = match verify_google_id_token(google_client_id, &payload.id_token).await {
        Ok(identity) => identity,
        Err(error) => {
            tracing::warn!("oauth google id token rejected: {}", error);
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": error}))).into_response();
        }
    };

    let provider_user_id = google_identity.provider_user_id.clone();
    let email = google_identity.email.clone();
    let full_name = google_identity.name.clone();
    let avatar_url = google_identity
        .picture
        .clone()
        .or_else(|| Some(DEFAULT_PROFILE_AVATAR.to_string()));

    if provider_user_id.is_empty() || email.len() < 5 || !email.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid oauth payload"})),
        )
            .into_response();
    }

    match verify_google_oauth_schema(&state).await {
        Ok(true) => {}
        Ok(false) => {
            tracing::error!(
                "oauth google schema is incomplete; migrations must run before traffic"
            );
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error":"database schema unavailable"})),
            )
                .into_response();
        }
        Err(error) => {
            tracing::error!("oauth google schema verification failed: {:?}", error);
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error":"database schema unavailable"})),
            )
                .into_response();
        }
    }

    let existing_identity_user_id = match sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT user_id
        FROM core.user_identities
        WHERE provider = 'google' AND provider_user_id = $1
        LIMIT 1
        "#,
    )
    .bind(&provider_user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("oauth google lookup identity failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response();
        }
    };

    let user_row = match existing_identity_user_id {
        Some(user_id) => {
            match sqlx::query(
                r#"
                UPDATE core.users
                SET
                    email_verified = email_verified OR $2,
                    last_login_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id, is_active
                "#,
            )
            .bind(user_id)
            .bind(google_identity.email_verified)
            .fetch_one(&state.db)
            .await
            {
                Ok(row) => row,
                Err(error) => {
                    tracing::error!("oauth google update linked user failed: {:?}", error);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error":"database error"})),
                    )
                        .into_response();
                }
            }
        }
        None => {
            match sqlx::query(
                r#"
                INSERT INTO core.users (
                    id, email, email_verified, password_hash, is_active, last_login_at, created_at, updated_at
                )
                VALUES ($1, $2, $3, NULL, TRUE, NOW(), NOW(), NOW())
                ON CONFLICT (email) DO UPDATE
                SET
                    email_verified = users.email_verified OR EXCLUDED.email_verified,
                    last_login_at = NOW(),
                    updated_at = NOW()
                RETURNING id, is_active
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(&email)
            .bind(google_identity.email_verified)
            .fetch_one(&state.db)
            .await
            {
                Ok(row) => row,
                Err(error) => {
                    tracing::error!("oauth google upsert user failed: {:?}", error);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error":"database error"})),
                    )
                        .into_response();
                }
            }
        }
    };

    let user_id: Uuid = user_row.get("id");
    let is_active: bool = user_row.get("is_active");
    if !is_active {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"account deactivated"})),
        )
            .into_response();
    }

    let generated_username = generate_google_username(&state, &email, full_name.as_deref()).await;
    let profile_metadata = json!({
        "avatar_url": avatar_url.clone(),
        "auth_provider": "google",
        "google": {
            "provider_user_id": provider_user_id.clone(),
            "email": email.clone(),
            "email_verified": google_identity.email_verified,
            "name": full_name.clone(),
            "picture": avatar_url.clone(),
        }
    });

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO core.user_identities (
            user_id, provider, provider_user_id, email, email_verified, raw_profile, last_login_at, created_at, updated_at
        )
        VALUES ($1, 'google', $2, $3, $4, $5, NOW(), NOW(), NOW())
        ON CONFLICT (provider, provider_user_id) DO UPDATE
        SET
            email = EXCLUDED.email,
            email_verified = EXCLUDED.email_verified,
            raw_profile = EXCLUDED.raw_profile,
            last_login_at = NOW(),
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&provider_user_id)
    .bind(&email)
    .bind(google_identity.email_verified)
    .bind(google_identity.raw_profile.clone())
    .execute(&state.db)
    .await
    {
        tracing::error!("oauth google upsert identity failed: {:?}", error);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO core.user_profiles (user_id, full_name, username, picture, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
            full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
            username = COALESCE(user_profiles.username, EXCLUDED.username),
            picture = COALESCE(EXCLUDED.picture, user_profiles.picture),
            metadata = COALESCE(user_profiles.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(full_name.clone())
    .bind(generated_username.clone())
    .bind(avatar_url.clone())
    .bind(profile_metadata)
    .execute(&state.db)
    .await
    {
        tracing::error!("oauth google upsert profile failed: {:?}", error);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    let mut rp = get_roles_permissions_cached(&state, user_id)
        .await
        .unwrap_or(RolesPermissions {
            roles: vec![],
            permissions: vec![],
        });

    if rp.roles.is_empty() {
        if let Err(error) = sqlx::query(
            "INSERT INTO roles (name, description, system, role_type) VALUES ('buyer', 'Default marketplace buyer', true, 'global') ON CONFLICT (name) DO NOTHING",
        )
        .execute(&state.db)
        .await
        {
            tracing::error!("ensure default buyer role failed: {:?}", error);
        }

        match sqlx::query_scalar::<_, Uuid>("SELECT id FROM roles WHERE name = 'buyer' LIMIT 1")
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(role_id)) => {
                let _ = sqlx::query(
                    "INSERT INTO core.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(user_id)
                .bind(role_id)
                .execute(&state.db)
                .await;
                invalidate_roles_cache_for_user(state.clone(), user_id).await;
                rp = get_roles_permissions_cached(&state, user_id)
                    .await
                    .unwrap_or(RolesPermissions {
                        roles: vec![],
                        permissions: vec![],
                    });
            }
            Ok(None) => {
                tracing::warn!("default role buyer not present during oauth google login");
            }
            Err(error) => {
                tracing::error!("fetch default role buyer failed: {:?}", error);
            }
        }
    }

    let username: String = match sqlx::query_scalar::<_, String>(
        "SELECT username FROM core.user_profiles WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(value)) if !value.trim().is_empty() => value,
        _ => email
            .split('@')
            .next()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("user")
            .to_string(),
    };

    let access_token = match create_access_token(
        &state.config.jwt_secret,
        user_id,
        username,
        ACCESS_TOKEN_EXP_HOURS,
        rp.roles.clone(),
        rp.permissions.clone(),
    ) {
        Ok(token) => token,
        Err(error) => {
            tracing::error!("oauth google create access token failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"token creation failed"})),
            )
                .into_response();
        }
    };

    let refresh_opaque = generate_opaque_refresh_token().await;
    let refresh_hash = match hash_refresh_token(&refresh_opaque).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("oauth google hash refresh token failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"token creation failed"})),
            )
                .into_response();
        }
    };
    let expires_at = Utc::now() + Duration::days(state.config.refresh_token_exp_days);
    let session_id =
        match store_refresh_session(&state, user_id, &refresh_hash, expires_at, None).await {
            Ok(id) => id,
            Err(error) => {
                tracing::error!("oauth google store refresh session failed: {:?}", error);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error":"token creation failed"})),
                )
                    .into_response();
            }
        };

    record_audit_log(
        state.clone(),
        "user".to_string(),
        "oauth.google.login.success",
        Some(user_id),
        Some(user_id),
        Some(json!({
            "provider": "google",
            "provider_user_id": provider_user_id,
            "email": email
        })),
        (ip_address, user_agent),
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_EXP_HOURS * 3600,
            "refresh_token": refresh_opaque,
            "session_id": session_id,
            "user": {
                "id": user_id,
                "email": email,
                "roles": rp.roles,
                "permissions": rp.permissions
            }
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub session_id: Uuid,
    pub refresh_token: String,
}
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<RefreshRequest>,
) -> impl IntoResponse {
    let secure_cookie = should_secure_cookies(&state, &headers);
    let state = state.clone();
    let (ip_address, user_agent) = extract_audit_info(&headers);

    // Validasi format refresh token
    if payload.refresh_token.len() < REFRESH_TOKEN_MIN_BYTES {
        record_audit_log(
            state.clone(),
            "user".to_string(),
            "token.refresh_invalid_format",
            None,
            None,
            Some(json!({"session": payload.session_id})),
            (ip_address.clone(), user_agent.clone()),
        )
        .await;

        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid refresh token"})),
        )
            .into_response();
    }

    // Verifikasi session dan refresh token
    match find_and_verify_session(&state, payload.session_id, &payload.refresh_token).await {
        Ok(Some((user_id, _expires_at))) => {
            // Ambil roles dan permissions user
            let rp = match get_roles_permissions_cached(&state, user_id).await {
                Ok(rp) => rp,
                Err(e) => {
                    tracing::error!("error fetching roles permissions: {:?}", e);
                    RolesPermissions {
                        roles: vec![],
                        permissions: vec![],
                    }
                }
            };

            // Rotate refresh token untuk sesi baru
            match rotate_refresh_token(&state, payload.session_id, user_id).await {
                Ok((new_opaque, new_session_id)) => {
                    // Ambil username user, fallback ke "user"
                    let username: String = match sqlx::query_scalar(
                        "SELECT username FROM core.user_profiles WHERE user_id = $1",
                    )
                    .bind(user_id)
                    .fetch_optional(&state.db)
                    .await
                    {
                        Ok(Some(name)) => name,
                        _ => "user".to_string(),
                    };

                    // Buat access token JWT
                    match create_access_token(
                        &state.config.jwt_secret,
                        user_id,
                        username,
                        ACCESS_TOKEN_EXP_HOURS,
                        rp.roles.clone(),
                        rp.permissions.clone(),
                    ) {
                        Ok(access_token) => {
                            // Audit log sukses rotate token
                            record_audit_log(
                                state.clone(),
                                "user".to_string(),
                                "token.rotate",
                                Some(user_id),
                                Some(user_id),
                                Some(json!({
                                    "old_session": payload.session_id,
                                    "new_session": new_session_id
                                })),
                                (ip_address, user_agent),
                            )
                            .await;

                            let resp = json!({
                                "access_token": access_token,
                                "token_type": "Bearer",
                                "expires_in": ACCESS_TOKEN_EXP_HOURS * 3600,
                                // Optionally tetap kirim refresh token dan session_id di body jika client perlu
                                // "refresh_token": new_opaque,
                                // "session_id": new_session_id
                            });

                            // Build cookie refresh token
                            let cookie_access_token = Cookie::build(("access_token", access_token.clone()))
                                    // .domain("localhost")
                                    .path("/")
                                    .http_only(true)
                                    .secure(secure_cookie)
                                    .same_site(SameSite::Lax)
                                    .max_age(CookieDuration::days(30))
                                    .build();

                            let cookie_refresh_token = Cookie::build(("refresh_token", new_opaque.clone()))
                                    // .domain("localhost")
                                    .path("/")
                                    .http_only(true)
                                    .secure(secure_cookie)
                                    .same_site(SameSite::Lax)
                                    .max_age(CookieDuration::days(30))
                                    .build();

                            // Build session cookie
                            let cookie_session = Cookie::build(("session_id", new_session_id.to_string()))
                                    // .domain("localhost")
                                    .path("/")
                                    .http_only(true)
                                    .secure(secure_cookie)
                                    .same_site(SameSite::Lax)
                                    .max_age(CookieDuration::days(30))
                                    .build();

                            let jar = jar
                                .add(cookie_access_token)
                                .add(cookie_refresh_token)
                                .add(cookie_session);

                            (StatusCode::OK, jar, Json(resp)).into_response()
                        }
                        Err(e) => {
                            tracing::error!("create access token error: {:?}", e);
                            (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(json!({"error":"token creation failed"})),
                            )
                                .into_response()
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("rotate refresh token error: {:?}", e);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error":"internal server error"})),
                    )
                        .into_response()
                }
            }
        }
        Ok(None) => {
            // Audit log kegagalan refresh token
            record_audit_log(
                state.clone(),
                "user".to_string(),
                "token.refresh_failed",
                None,
                None,
                Some(json!({"session": payload.session_id})),
                (ip_address, user_agent),
            )
            .await;

            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid refresh token"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("session lookup error: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"internal server error"})),
            )
                .into_response()
        }
    }
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
) -> impl IntoResponse {
    let secure_cookie = should_secure_cookies(&state, &headers);
    // Ambil session_id dari cookie
    let session_id = jar.get("session_id").map(|c| c.value().to_string());

    let (ip_address, user_agent) = extract_audit_info(&headers);

    if let Some(sid_str) = session_id {
        if let Ok(sid) = sid_str.parse::<Uuid>() {
            // Revoke session async
            revoke_refresh_session(&state, sid).await;

            // Audit log
            record_audit_log(
                state.clone(),
                "user".to_string(),
                "logout",
                None,
                None,
                Some(json!({ "session": sid })),
                (ip_address, user_agent),
            )
            .await;
        }
    }

    // Hapus cookie
    let cookie_access_token = Cookie::build(("access_token", ""))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::seconds(0))
        .build();

    let cookie_refresh_token = Cookie::build(("refresh_token", ""))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::seconds(0))
        .build();

    let cookie_session = Cookie::build(("session_id", ""))
        // .domain("localhost")
        .path("/")
        .http_only(true)
        .secure(secure_cookie)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::seconds(0))
        .build();

    let jar = jar
        .add(cookie_access_token)
        .add(cookie_refresh_token)
        .add(cookie_session);

    (StatusCode::OK, jar, Json(json!({"message": "logged out"}))).into_response()
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: Option<String>,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
    pub password: String,
    pub reset_proof: String,
}

pub async fn change_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> impl IntoResponse {
    if let Err(error) = validate_password_strength(&payload.new_password) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": error}))).into_response();
    }

    let auth_header = match headers.get(header::AUTHORIZATION) {
        Some(v) => v.to_str().unwrap_or_default(),
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"missing authorization header"})),
            )
                .into_response();
        }
    };

    if !auth_header.starts_with("Bearer ") {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid authorization scheme"})),
        )
            .into_response();
    }

    let token = auth_header.trim_start_matches("Bearer ").trim();
    let claims = match decode_access_token(&state.config.jwt_secret, token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid or expired token"})),
            )
                .into_response();
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"invalid token subject"})),
            )
                .into_response();
        }
    };

    let existing_hash = match sqlx::query_scalar::<_, Option<String>>(
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
                .into_response();
        }
        Err(e) => {
            tracing::error!("change password fetch user failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response();
        }
    };

    if let Some(existing_hash) = existing_hash.as_deref() {
        let provided_current = payload
            .current_password
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(current_password) = provided_current else {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"current password is required"})),
            )
                .into_response();
        };

        if !verify_password(existing_hash, current_password).await {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error":"current password is invalid"})),
            )
                .into_response();
        }
    }

    let new_hash = match hash_password(&payload.new_password).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("change password hash failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to hash password"})),
            )
                .into_response();
        }
    };

    let mut tx = match state.db.begin().await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("change password begin tx failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response();
        }
    };

    if let Err(e) = sqlx::query(
        "UPDATE core.users SET password_hash = $1, failed_login_attempts = 0, lockout_expires_at = NULL WHERE id = $2",
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("change password update user failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    if let Err(e) = sqlx::query("UPDATE core.sessions SET revoked = true WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        tracing::error!("change password revoke core.sessions failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("change password commit failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    (
        StatusCode::OK,
        Json(json!({"message":"password changed successfully"})),
    )
        .into_response()
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ResetPasswordRequest>,
) -> impl IntoResponse {
    let email = payload.email.trim().to_lowercase();
    if email.len() < 5 || !email.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid email"})),
        )
            .into_response();
    }
    if let Err(error) = validate_password_strength(&payload.password) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": error}))).into_response();
    }

    if payload.reset_proof.trim().is_empty()
        || !verify_reset_proof(&state.config.jwt_secret, &payload.reset_proof, &email)
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid reset proof"})),
        )
            .into_response();
    }

    let user_id = match sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM core.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(v)) => v,
        Ok(None) => {
            return (
                StatusCode::OK,
                Json(json!({"message":"password reset processed"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("reset password fetch user failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response();
        }
    };

    let new_hash = match hash_password(&payload.password).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("reset password hash failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to hash password"})),
            )
                .into_response();
        }
    };

    let mut tx = match state.db.begin().await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("reset password begin tx failed: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response();
        }
    };

    if let Err(e) = sqlx::query(
        "UPDATE core.users SET password_hash = $1, failed_login_attempts = 0, lockout_expires_at = NULL WHERE id = $2",
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("reset password update user failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    if let Err(e) = sqlx::query("UPDATE core.sessions SET revoked = true WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        tracing::error!("reset password revoke core.sessions failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("reset password commit failed: {:?}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"database error"})),
        )
            .into_response();
    }

    (
        StatusCode::OK,
        Json(json!({"message":"password reset processed"})),
    )
        .into_response()
}

pub async fn me(State(state): State<Arc<AppState>>, headers: HeaderMap) -> impl IntoResponse {
    // Clone untuk memudahkan pemakaian
    let state = state.clone();

    // Ambil token Bearer dari header Authorization dengan handling error yang jelas
    let auth_header = match headers.get(header::AUTHORIZATION) {
        Some(v) => v.to_str().unwrap_or_default(),
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "missing authorization header"})),
            )
                .into_response();
        }
    };
    if !auth_header.starts_with("Bearer ") {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "invalid authorization scheme"})),
        )
            .into_response();
    }
    let token = auth_header.trim_start_matches("Bearer ").trim();

    // Decode dan validasi JWT
    let secret = state.config.jwt_secret.clone();
    let claims = match decode_access_token(&secret, token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "invalid or expired token"})),
            )
                .into_response();
        }
    };

    // Parsing user_id dari sub claim JWT
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(uuid) => uuid,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "invalid token subject"})),
            )
                .into_response();
        }
    };

    // Query user lengkap dengan join profil, pastikan user belum dihapus (deleted_at IS NULL)
    let user_row = match sqlx::query_as::<
        _,
        (
            Uuid,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            bool,
            bool,
            bool,
            Option<Value>,
        ),
    >(
        r#"
        SELECT
          u.id,
          u.email::text,
          u.phone,
          up.full_name,
          up.username,
          up.bio,
          up.location,
          u.is_active,
          u.email_verified,
          u.phone_verified,
          (u.password_hash IS NOT NULL) AS has_password,
          up.metadata
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
        Ok(opt) => opt,
        Err(e) => {
            tracing::error!("DB error fetching user profile: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    // Jika user tidak ditemukan
    let (
        id,
        email,
        phone,
        full_name,
        username,
        bio,
        location,
        is_active,
        email_verified,
        phone_verified,
        has_password,
        metadata,
    ) = match user_row {
        Some(data) => data,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "user not found"})),
            )
                .into_response();
        }
    };

    let email = email.unwrap_or_default();
    let metadata = metadata.unwrap_or_else(|| json!({}));
    let metadata_media = metadata.get("media").and_then(|value| value.as_object());
    let metadata_extended = metadata.get("extended").and_then(|value| value.as_object());
    let avatar_url = metadata
        .get("avatar_url")
        .and_then(|value| value.as_str())
        .or_else(|| {
            metadata_media
                .and_then(|media| media.get("avatar_url").and_then(|value| value.as_str()))
        })
        .map(|value| value.to_string());
    let avatar_style = metadata
        .get("avatar_style")
        .cloned()
        .or_else(|| metadata_extended.and_then(|extended| extended.get("avatar_style").cloned()));
    let verification_state = derive_verification_state(
        Some(&metadata),
        is_active,
        Some(email.as_str()),
        phone.as_deref(),
        email_verified,
        phone_verified,
    );
    let verification = merged_verification_payload(Some(&metadata), &verification_state);

    // --- Optional: Jika ingin mengaktifkan caching roles/permissions ---
    // Uncomment dan gunakan jika ingin sertakan roles & permissions di response
    /*
    let rp = match get_roles_permissions_cached(&state, user_id).await {
        Ok(rp) => rp,
        Err(e) => {
            tracing::error!("error fetching roles and permissions: {:?}", e);
            RolesPermissions {
                roles: vec![],
                permissions: vec![],
            }
        }
    };
    */

    // Bentuk response JSON yang bersih dan jelas
    let result = json!({
        "id": id,
        "email": email,
        "phone": phone,
        "email_verified": verification_state.email_verified,
        "phone_verified": verification_state.phone_verified,
        "document_verified": verification_state.document_verified,
        "liveness_verified": verification_state.liveness_verified,
        "identity_verified": verification_state.identity_verified,
        "transaction_eligible": verification_state.transaction_eligible,
        "kyc_status": verification_state.kyc_status,
        "is_verified": verification_state.identity_verified,
        "has_password": has_password,
        "hasPassword": has_password,
        "verification": verification,
        "full_name": full_name,
        "username": username,
        "bio": bio,
        "location": location,
        "avatar_url": avatar_url.clone(),
        "avatarUrl": avatar_url,
        "avatar_style": avatar_style.clone(),
        "avatarStyle": avatar_style,
        "metadata": metadata,
        "is_active": is_active,
        "roles": claims.roles,
        "permissions": claims.perms,
    });

    (StatusCode::OK, Json(result)).into_response()
}

// ------------------------------------------------------------------

// Helper untuk bulk invalidasi cache roles pengguna di Redis dengan pipeline, async fire-and-forget
// -------------------------------------------------------------------------------------
