use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::config::AppState;
use crate::routes::verification::{derive_verification_state, public_verification_payload};

const DEFAULT_PROFILE_AVATAR: &str = "/default-avatar.svg";

const PUBLIC_PROFILE_KEYS: &[&str] = &[
    "headline", "bio", "roles", "portfolio_url", "website", "linkedin_url", "github_url",
    "links", "avatar_url", "cover_image",
];
const PUBLIC_FREELANCER_KEYS: &[&str] = &[
    "professional_title", "tagline", "bio", "summary", "skills", "skill_set", "languages",
    "hourly_rate", "experience_years", "portfolio_urls", "certifications", "certificates",
    "experiences", "experience", "work_history", "work_experience", "education", "links",
];
const PUBLIC_PROVIDER_KEYS: &[&str] = &[
    "headline", "tagline", "bio", "summary", "skills", "expertise", "languages",
    "service_coverage", "work_mode", "response_time", "price_min", "price_max", "experience",
    "education", "certifications", "links",
];
const PUBLIC_BUYER_KEYS: &[&str] = &[
    "intent", "budget_min", "budget_max", "preferred_sector", "preferred_sub_sector",
    "preferred_location",
];
const PUBLIC_MEDIA_KEYS: &[&str] = &[
    "avatar_url", "photo_url", "cover_image", "cover_url", "gallery_images", "gallery_videos",
];

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

fn is_sensitive_public_key(raw: &str) -> bool {
    let key = normalize_metadata_key(raw);
    matches!(
        key.as_str(),
        "email"
            | "email_address"
            | "phone"
            | "phone_number"
            | "whatsapp"
            | "whatsapp_number"
            | "contact"
            | "contacts"
            | "document"
            | "documents"
            | "document_url"
            | "document_urls"
            | "document_name"
            | "document_type"
            | "document_country"
            | "nik"
            | "nik_hash"
            | "nik_masked"
            | "nik_last4"
            | "verification"
            | "kyc_status"
            | "trust_score"
            | "liveness_score"
            | "face_coverage"
            | "risk_flags"
            | "reviewed_by"
            | "reviewed_at"
    ) || key.contains("email")
        || key.contains("phone")
        || key.contains("whatsapp")
        || key.contains("contact")
        || key.contains("document")
        || key.contains("nik")
        || key.contains("verification")
        || key.contains("kyc")
        || key.contains("trust")
        || key.contains("liveness")
        || key.starts_with("verification_")
        || key.starts_with("kyc_")
        || key.starts_with("trust_")
        || key.starts_with("document_")
        || key.starts_with("nik_")
}

fn project_display_value(value: &Value, depth: usize) -> Option<Value> {
    if depth > 5 {
        return None;
    }
    match value {
        Value::Null => None,
        Value::Bool(value) => Some(Value::Bool(*value)),
        Value::Number(value) => Some(Value::Number(value.clone())),
        Value::String(value) => Some(Value::String(value.chars().take(2048).collect())),
        Value::Array(values) => Some(Value::Array(
            values
                .iter()
                .take(32)
                .filter_map(|value| project_display_value(value, depth + 1))
                .collect(),
        )),
        Value::Object(values) => {
            let projected = values
                .iter()
                .filter(|(key, _)| !is_sensitive_public_key(key))
                .take(32)
                .filter_map(|(key, value)| {
                    project_display_value(value, depth + 1)
                        .map(|value| (key.clone(), value))
                })
                .collect::<serde_json::Map<String, Value>>();
            Some(Value::Object(projected))
        }
    }
}

fn project_section(value: Option<&Value>, allowed_keys: &[&str]) -> Option<Value> {
    let object = value?.as_object()?;
    let mut projected = serde_json::Map::new();
    for key in allowed_keys {
        if let Some(value) = object
            .get(*key)
            .and_then(|value| project_display_value(value, 0))
        {
            projected.insert((*key).to_string(), value);
        }
    }
    (!projected.is_empty()).then_some(Value::Object(projected))
}

fn read_bool(value: Option<&Value>) -> Option<bool> {
    match value? {
        Value::Bool(value) => Some(*value),
        Value::Number(value) => value.as_i64().map(|value| value == 1),
        Value::String(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn read_string_from(
    objects: &[Option<&serde_json::Map<String, Value>>],
    keys: &[&str],
) -> Option<String> {
    for object in objects.iter().flatten() {
        for key in keys {
            if let Some(value) = object.get(*key).and_then(Value::as_str) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn project_public_contact(metadata: &serde_json::Map<String, Value>) -> Option<Value> {
    let nested = metadata.get("public_contact").and_then(Value::as_object);
    let objects = [nested, Some(metadata)];
    let consent = objects.iter().flatten().any(|object| {
        [
            "public_contact_enabled",
            "contact_public",
            "phone_public",
            "show_public_phone",
            "whatsapp_public",
        ]
        .iter()
        .any(|key| read_bool(object.get(*key)) == Some(true))
    });
    if !consent {
        return None;
    }

    let source = read_string_from(
        &objects,
        &["contact_source", "phone_source", "whatsapp_source"],
    )?
    .replace([' ', '-'], "_")
    .to_ascii_lowercase();
    if !matches!(
        source.as_str(),
        "owner"
            | "owner_metadata"
            | "owner_published"
            | "business_owner"
            | "user"
            | "user_submitted"
            | "public_profile"
            | "usaha_portal_public"
            | "verified_provider"
    ) {
        return None;
    }

    let policy = read_string_from(&objects, &["contact_policy", "phone_policy"])
        .unwrap_or_else(|| "public_contact".to_string())
        .replace([' ', '-'], "_")
        .to_ascii_lowercase();
    if !matches!(
        policy.as_str(),
        "public" | "public_contact" | "owner_published" | "user_controlled_contact"
    ) {
        return None;
    }

    let phone_raw = read_string_from(
        &objects,
        &[
            "whatsapp_phone",
            "whatsapp_number",
            "whatsapp_contact",
            "phone",
            "phone_number",
        ],
    )?;
    let phone: String = phone_raw
        .chars()
        .filter(|character| character.is_ascii_digit())
        .take(20)
        .collect();
    if phone.len() < 8 {
        return None;
    }
    let message = read_string_from(
        &objects,
        &["whatsapp_message", "whatsapp_text", "contact_message"],
    );

    let mut projected = serde_json::Map::from_iter([
        ("public_contact_enabled".to_string(), Value::Bool(true)),
        ("contact_source".to_string(), Value::String(source)),
        ("contact_policy".to_string(), Value::String(policy)),
        ("phone".to_string(), Value::String(phone.clone())),
        ("whatsapp".to_string(), Value::String(phone)),
    ]);
    if let Some(message) = message {
        projected.insert(
            "contact_message".to_string(),
            Value::String(message.chars().take(500).collect()),
        );
    }
    Some(Value::Object(projected))
}

fn project_public_metadata(metadata: Option<&Value>) -> Value {
    let Some(root) = metadata.and_then(Value::as_object) else {
        return json!({});
    };
    let extended = root.get("extended").and_then(Value::as_object);
    let sources = [Some(root), extended];
    let mut projected = serde_json::Map::new();

    for key in [
        "avatar_url",
        "avatar_style",
        "avatar_source",
        "cover_image",
        "gallery_images",
        "roles",
        "profile_level",
        "headline",
        "about",
        "skills",
        "languages",
        "experience",
        "education",
        "certifications",
    ] {
        if let Some(value) = sources
            .iter()
            .flatten()
            .find_map(|source| source.get(key))
            .and_then(|value| project_display_value(value, 0))
        {
            projected.insert(key.to_string(), value);
        }
    }

    for (key, allowed_keys) in [
        ("profile", PUBLIC_PROFILE_KEYS),
        ("freelancer_profile", PUBLIC_FREELANCER_KEYS),
        ("provider_profile", PUBLIC_PROVIDER_KEYS),
        ("buyer_profile", PUBLIC_BUYER_KEYS),
        ("media", PUBLIC_MEDIA_KEYS),
    ] {
        let value = sources
            .iter()
            .flatten()
            .find_map(|source| source.get(key));
        if let Some(value) = project_section(value, allowed_keys) {
            projected.insert(key.to_string(), value);
        }
    }

    if let Some(contact) = project_public_contact(root) {
        projected.insert("public_contact".to_string(), contact);
    }

    Value::Object(projected)
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
struct AccessClaims {
    sub: String,
    exp: usize,
    #[serde(default)]
    roles: Vec<String>,
    #[serde(default)]
    perms: Vec<String>,
    #[serde(default)]
    username: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct LookupUserResponse {
    pub id: Uuid,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub avatar_style: Option<Value>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DiscoverUserResponse {
    pub id: Uuid,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub avatar_style: Option<Value>,
    pub metadata: Option<Value>,
    pub location: Option<String>,
    pub bio: Option<String>,
    pub headline: Option<String>,
    pub roles: Vec<String>,
    pub metadata_roles: Value,
    pub level: Option<String>,
    pub rating: Option<f64>,
    pub completed_jobs: Option<i32>,
    pub hourly_rate: Option<i32>,
    pub freelancer_profile: Option<Value>,
    pub provider_profile: Option<Value>,
    pub buyer_profile: Option<Value>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PublicUserProfileResponse {
    pub id: Uuid,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub avatar_style: Option<Value>,
    pub metadata: Value,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub headline: Option<String>,
    pub roles: Vec<String>,
    pub metadata_roles: Value,
    pub level: Option<String>,
    pub rating: Option<f64>,
    pub completed_jobs: Option<i32>,
    pub hourly_rate: Option<i32>,
    pub freelancer_profile: Option<Value>,
    pub provider_profile: Option<Value>,
    pub buyer_profile: Option<Value>,
    pub email_verified: bool,
    pub phone_verified: bool,
    pub document_verified: bool,
    pub liveness_verified: bool,
    pub identity_verified: bool,
    pub transaction_eligible: bool,
    pub kyc_status: String,
    pub verification: Value,
}

#[derive(Debug, Deserialize)]
pub struct DiscoverUsersQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(|value| value.trim().to_string())
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

fn normalize_phone(raw: &str) -> String {
    raw.chars().filter(|c| c.is_ascii_digit()).collect()
}

fn require_auth_claims(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<AccessClaims, (StatusCode, Json<serde_json::Value>)> {
    let token = extract_bearer_token(headers).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"missing token"})),
        )
    })?;

    decode_access_token(&state.config.jwt_secret, &token).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid token"})),
        )
    })
}

fn optional_auth_claims(state: &AppState, headers: &HeaderMap) -> Option<AccessClaims> {
    let token = extract_bearer_token(headers)?;
    decode_access_token(&state.config.jwt_secret, &token).ok()
}

pub async fn get_user_by_phone(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(phone): Path<String>,
) -> impl IntoResponse {
    if let Err(err) = require_auth_claims(&state, &headers) {
        return err.into_response();
    }

    let normalized_phone = normalize_phone(&phone);
    if normalized_phone.len() < 6 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid phone number"})),
        )
            .into_response();
    }

    let mut user = match sqlx::query_as::<_, LookupUserResponse>(
        r#"
        SELECT
            u.id,
            up.username::text AS username,
            up.full_name,
            COALESCE(
                NULLIF(up.metadata->>'avatar_url', ''),
                NULLIF(up.metadata->'media'->>'avatar_url', ''),
                NULLIF(up.picture, ''),
                $2::text
            )::text AS avatar_url,
            COALESCE(up.metadata->'avatar_style', up.metadata->'extended'->'avatar_style') AS avatar_style
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND u.is_active = TRUE
          AND u.status = 'active'
          AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $1
        LIMIT 1
        "#,
    )
    .bind(normalized_phone)
    .bind(DEFAULT_PROFILE_AVATAR)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("get_user_by_phone db error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    user.avatar_style = user
        .avatar_style
        .as_ref()
        .and_then(|value| project_display_value(value, 0));

    (StatusCode::OK, Json(user)).into_response()
}

pub async fn get_user_by_email(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(email): Path<String>,
) -> impl IntoResponse {
    if let Err(err) = require_auth_claims(&state, &headers) {
        return err.into_response();
    }

    let email = email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid email"})),
        )
            .into_response();
    }

    let mut user = match sqlx::query_as::<_, LookupUserResponse>(
        r#"
        SELECT
            u.id,
            up.username::text AS username,
            up.full_name,
            COALESCE(
                NULLIF(up.metadata->>'avatar_url', ''),
                NULLIF(up.metadata->'media'->>'avatar_url', ''),
                NULLIF(up.picture, ''),
                $2::text
            )::text AS avatar_url,
            COALESCE(up.metadata->'avatar_style', up.metadata->'extended'->'avatar_style') AS avatar_style
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND u.is_active = TRUE
          AND lower(u.email::text) = lower($1)
        LIMIT 1
        "#,
    )
    .bind(email)
    .bind(DEFAULT_PROFILE_AVATAR)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("get_user_by_email db error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    user.avatar_style = user
        .avatar_style
        .as_ref()
        .and_then(|value| project_display_value(value, 0));

    (StatusCode::OK, Json(user)).into_response()
}

pub async fn discover_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<DiscoverUsersQuery>,
) -> impl IntoResponse {
    let claims = optional_auth_claims(&state, &headers);

    let search = query
        .q
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(160)
        .collect::<String>();
    let limit = query.limit.unwrap_or(8).clamp(1, 25);
    let has_search = !search.is_empty();

    let current_user_id = claims
        .as_ref()
        .and_then(|candidate| Uuid::parse_str(&candidate.sub).ok());

    let mut users = match sqlx::query_as::<_, DiscoverUserResponse>(
        r#"
        SELECT
            u.id,
            up.username::text AS username,
            up.full_name,
            COALESCE(
                NULLIF(up.metadata->>'avatar_url', ''),
                NULLIF(up.metadata->'media'->>'avatar_url', ''),
                NULLIF(up.picture, ''),
                '/default-avatar.svg'
            )::text AS avatar_url,
            COALESCE(up.metadata->'avatar_style', up.metadata->'extended'->'avatar_style') AS avatar_style,
            COALESCE(up.metadata, '{}'::jsonb) AS metadata,
            up.location,
            up.bio,
            COALESCE(
                up.metadata->'freelancer_profile'->>'professional_title',
                up.metadata->'freelancer_profile'->>'tagline',
                up.bio
            ) AS headline,
            COALESCE(
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT lower(r.name::text)), NULL),
                ARRAY[]::text[]
            ) AS roles,
            COALESCE(up.metadata->'roles', '[]'::jsonb) AS metadata_roles,
            COALESCE(
                NULLIF(up.metadata->>'profile_level', ''),
                NULLIF(up.metadata->'freelancer_profile'->>'level', ''),
                CASE
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'freelancer' THEN 'freelancer'
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'employer' THEN 'employer'
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'agent' THEN 'agent'
                    ELSE NULL
                END
            ) AS level,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'rating', '') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN (up.metadata->'freelancer_profile'->>'rating')::double precision
                ELSE NULL
            END AS rating,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'completed_jobs', '') ~ '^[0-9]+$'
                THEN (up.metadata->'freelancer_profile'->>'completed_jobs')::integer
                ELSE NULL
            END AS completed_jobs,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'hourly_rate', '') ~ '^[0-9]+$'
                THEN (up.metadata->'freelancer_profile'->>'hourly_rate')::integer
                ELSE NULL
            END AS hourly_rate,
            up.metadata->'freelancer_profile' AS freelancer_profile,
            up.metadata->'provider_profile' AS provider_profile,
            up.metadata->'buyer_profile' AS buyer_profile,
            u.created_at::text AS created_at
        FROM core.users u
        JOIN core.user_profiles up ON up.user_id = u.id
        LEFT JOIN core.user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.deleted_at IS NULL
          AND u.is_active = TRUE
          AND (
            NULLIF(btrim(up.full_name), '') IS NOT NULL OR
            NULLIF(btrim(up.username::text), '') IS NOT NULL
          )
          AND COALESCE(lower(NULLIF(up.metadata->>'profile_visibility', '')), 'public') IN ('public', 'visible')
          AND COALESCE(lower(NULLIF(up.metadata->>'discoverable', '')), 'true') NOT IN ('false', '0', 'no', 'off')
          AND ($1::uuid IS NULL OR u.id <> $1)
          AND (
            $2 = '' OR
            (
              COALESCE(up.username::text, '') || ' ' ||
              COALESCE(up.full_name, '') || ' ' ||
              COALESCE(up.location, '') || ' ' ||
              COALESCE(up.bio, '') || ' ' ||
              COALESCE(up.metadata->'freelancer_profile'->>'professional_title', '') || ' ' ||
              COALESCE(up.metadata->'freelancer_profile'->>'tagline', '') || ' ' ||
              COALESCE(up.metadata->'provider_profile'->>'headline', '') || ' ' ||
              COALESCE(up.metadata->'buyer_profile'->>'intent', '') || ' ' ||
              COALESCE(up.metadata->'freelancer_profile'->'skills', '[]'::jsonb)::text || ' ' ||
              COALESCE(up.metadata->'provider_profile'->'skills', '[]'::jsonb)::text
            ) ILIKE '%' || $2 || '%'
          )
        GROUP BY
            u.id,
            up.username,
            up.full_name,
            up.picture,
            up.metadata,
            up.location,
            up.bio,
            u.created_at
        ORDER BY
          CASE
            WHEN NOT $3 THEN 0
            WHEN lower(COALESCE(up.username::text, '')) = lower($2) THEN 0
            WHEN lower(COALESCE(up.full_name, '')) = lower($2) THEN 1
            WHEN COALESCE(up.username::text, '') ILIKE $2 || '%' THEN 2
            WHEN COALESCE(up.full_name, '') ILIKE $2 || '%' THEN 3
            ELSE 4
          END,
          u.created_at DESC
        LIMIT $4
        "#,
    )
    .bind(current_user_id)
    .bind(search)
    .bind(has_search)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    {
        Ok(users) => users,
        Err(error) => {
            tracing::error!("discover_users db error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    for user in &mut users {
        user.avatar_style = user
            .avatar_style
            .as_ref()
            .and_then(|value| project_display_value(value, 0));
        user.metadata_roles = match project_display_value(&user.metadata_roles, 0) {
            Some(Value::Array(values)) => Value::Array(values),
            _ => json!([]),
        };
        user.freelancer_profile =
            project_section(user.freelancer_profile.as_ref(), PUBLIC_FREELANCER_KEYS);
        user.provider_profile =
            project_section(user.provider_profile.as_ref(), PUBLIC_PROVIDER_KEYS);
        user.buyer_profile = project_section(user.buyer_profile.as_ref(), PUBLIC_BUYER_KEYS);
        user.metadata = Some(project_public_metadata(user.metadata.as_ref()));
    }

    (StatusCode::OK, Json(json!({ "data": users }))).into_response()
}

pub async fn get_public_user_profile(
    State(state): State<Arc<AppState>>,
    Path(user_id_raw): Path<String>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(user_id_raw.trim()) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"invalid user id"})),
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
            up.username::text AS username,
            up.full_name,
            COALESCE(
                NULLIF(up.metadata->>'avatar_url', ''),
                NULLIF(up.metadata->'media'->>'avatar_url', ''),
                NULLIF(up.picture, ''),
                '/default-avatar.svg'
            )::text AS avatar_url,
            COALESCE(up.metadata->'avatar_style', up.metadata->'extended'->'avatar_style') AS avatar_style,
            up.bio,
            up.location,
            COALESCE(
                up.metadata->'freelancer_profile'->>'professional_title',
                up.metadata->'freelancer_profile'->>'tagline',
                up.bio
            ) AS headline,
            COALESCE(
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT lower(r.name::text)), NULL),
                ARRAY[]::text[]
            ) AS roles,
            COALESCE(up.metadata->'roles', '[]'::jsonb) AS metadata_roles,
            COALESCE(
                NULLIF(up.metadata->>'profile_level', ''),
                NULLIF(up.metadata->'freelancer_profile'->>'level', ''),
                CASE
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'freelancer' THEN 'freelancer'
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'employer' THEN 'employer'
                    WHEN COALESCE(up.metadata->'roles', '[]'::jsonb) ? 'agent' THEN 'agent'
                    ELSE NULL
                END
            ) AS level,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'rating', '') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN (up.metadata->'freelancer_profile'->>'rating')::double precision
                ELSE NULL
            END AS rating,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'completed_jobs', '') ~ '^[0-9]+$'
                THEN (up.metadata->'freelancer_profile'->>'completed_jobs')::integer
                ELSE NULL
            END AS completed_jobs,
            CASE
                WHEN COALESCE(up.metadata->'freelancer_profile'->>'hourly_rate', '') ~ '^[0-9]+$'
                THEN (up.metadata->'freelancer_profile'->>'hourly_rate')::integer
                ELSE NULL
            END AS hourly_rate,
            up.metadata->'freelancer_profile' AS freelancer_profile,
            up.metadata->'provider_profile' AS provider_profile,
            up.metadata->'buyer_profile' AS buyer_profile,
            u.is_active,
            u.email_verified,
            u.phone_verified,
            COALESCE(up.metadata, '{}'::jsonb) AS metadata
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        LEFT JOIN core.user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.deleted_at IS NULL
          AND u.is_active = TRUE
          AND u.id = $1
        GROUP BY
            u.id,
            up.username,
            up.full_name,
            up.picture,
            up.metadata,
            up.bio,
            up.location,
            u.email,
            u.phone,
            u.is_active,
            u.email_verified,
            u.phone_verified
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error":"user not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("get_public_user_profile db error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let id = row.get::<Uuid, _>("id");
    let email = row.get::<String, _>("email");
    let phone = row.get::<Option<String>, _>("phone");
    let username = row.get::<Option<String>, _>("username");
    let full_name = row.get::<Option<String>, _>("full_name");
    let avatar_url = row.get::<Option<String>, _>("avatar_url");
    let avatar_style = row.get::<Option<Value>, _>("avatar_style");
    let bio = row.get::<Option<String>, _>("bio");
    let location = row.get::<Option<String>, _>("location");
    let headline = row.get::<Option<String>, _>("headline");
    let roles = row.get::<Vec<String>, _>("roles");
    let metadata_roles = row.get::<Value, _>("metadata_roles");
    let level = row.get::<Option<String>, _>("level");
    let rating = row.get::<Option<f64>, _>("rating");
    let completed_jobs = row.get::<Option<i32>, _>("completed_jobs");
    let hourly_rate = row.get::<Option<i32>, _>("hourly_rate");
    let freelancer_profile = row.get::<Option<Value>, _>("freelancer_profile");
    let provider_profile = row.get::<Option<Value>, _>("provider_profile");
    let buyer_profile = row.get::<Option<Value>, _>("buyer_profile");
    let metadata = row.get::<Value, _>("metadata");
    let verification_state = derive_verification_state(
        Some(&metadata),
        row.get::<bool, _>("is_active"),
        Some(email.as_str()),
        phone.as_deref(),
        row.get::<bool, _>("email_verified"),
        row.get::<bool, _>("phone_verified"),
    );
    let verification = public_verification_payload(Some(&metadata), &verification_state);
    let kyc_status = verification_state.kyc_status;
    let public_metadata = project_public_metadata(Some(&metadata));
    let public_avatar_style = avatar_style
        .as_ref()
        .and_then(|value| project_display_value(value, 0));
    let public_metadata_roles = match project_display_value(&metadata_roles, 0) {
        Some(Value::Array(values)) => Value::Array(values),
        _ => json!([]),
    };
    let public_freelancer_profile =
        project_section(freelancer_profile.as_ref(), PUBLIC_FREELANCER_KEYS);
    let public_provider_profile =
        project_section(provider_profile.as_ref(), PUBLIC_PROVIDER_KEYS);
    let public_buyer_profile = project_section(buyer_profile.as_ref(), PUBLIC_BUYER_KEYS);

    let user = PublicUserProfileResponse {
        id,
        username,
        full_name,
        avatar_url,
        avatar_style: public_avatar_style,
        metadata: public_metadata,
        bio,
        location,
        headline,
        roles,
        metadata_roles: public_metadata_roles,
        level,
        rating,
        completed_jobs,
        hourly_rate,
        freelancer_profile: public_freelancer_profile,
        provider_profile: public_provider_profile,
        buyer_profile: public_buyer_profile,
        email_verified: verification_state.email_verified,
        phone_verified: verification_state.phone_verified,
        document_verified: verification_state.document_verified,
        liveness_verified: verification_state.liveness_verified,
        identity_verified: verification_state.identity_verified,
        transaction_eligible: verification_state.transaction_eligible,
        kyc_status,
        verification,
    };

    (StatusCode::OK, Json(user)).into_response()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::project_public_metadata;

    #[test]
    fn public_metadata_projection_drops_kyc_documents_and_private_contacts() {
        let metadata = json!({
            "avatar_url": "/avatar.png",
            "documents": ["https://files.example/ktp.pdf"],
            "verification": {
                "nik_hash": "secret-hash",
                "document_name": "Sensitive Name",
                "identity_verified": true
            },
            "contact": { "phone": "081234567890" },
            "freelancer_profile": {
                "professional_title": "Pengrajin",
                "skills": ["Anyaman"],
                "phone": "081234567890",
                "certifications": [{
                    "title": "Pelatihan",
                    "document_url": "https://files.example/certificate.pdf"
                }]
            },
            "extended": {
                "verification": { "kyc_status": "enhanced" },
                "languages": ["Indonesia"]
            }
        });

        let projected = project_public_metadata(Some(&metadata));
        assert_eq!(projected["avatar_url"].as_str(), Some("/avatar.png"));
        assert_eq!(projected["languages"][0].as_str(), Some("Indonesia"));
        assert_eq!(
            projected["freelancer_profile"]["professional_title"].as_str(),
            Some("Pengrajin")
        );
        assert!(projected.get("documents").is_none());
        assert!(projected.get("verification").is_none());
        assert!(projected.get("contact").is_none());
        assert!(projected["freelancer_profile"].get("phone").is_none());
        assert!(projected["freelancer_profile"]["certifications"][0]
            .get("document_url")
            .is_none());
    }

    #[test]
    fn public_contact_requires_explicit_consent_source_and_policy() {
        let private = json!({
            "public_contact": {
                "phone": "081234567890",
                "contact_source": "owner"
            }
        });
        assert!(project_public_metadata(Some(&private))
            .get("public_contact")
            .is_none());

        let public = json!({
            "public_contact": {
                "phone": "081234567890",
                "public_contact_enabled": true,
                "contact_source": "owner",
                "contact_policy": "public_contact"
            }
        });
        let projected = project_public_metadata(Some(&public));
        assert_eq!(
            projected["public_contact"]["phone"].as_str(),
            Some("081234567890")
        );
    }
}
