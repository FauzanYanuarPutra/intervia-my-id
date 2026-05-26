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
    pub email: String,
    pub phone: Option<String>,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DiscoverUserResponse {
    pub id: Uuid,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
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

    let user = match sqlx::query_as::<_, LookupUserResponse>(
        r#"
        SELECT
            u.id,
            COALESCE(u.email::text, '') AS email,
            u.phone,
            up.username::text AS username,
            up.full_name,
            up.metadata->>'avatar_url' AS avatar_url
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $1
        LIMIT 1
        "#,
    )
    .bind(normalized_phone)
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

    let user = match sqlx::query_as::<_, LookupUserResponse>(
        r#"
        SELECT
            u.id,
            COALESCE(u.email::text, '') AS email,
            u.phone,
            up.username::text AS username,
            up.full_name,
            up.metadata->>'avatar_url' AS avatar_url
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND lower(u.email::text) = lower($1)
        LIMIT 1
        "#,
    )
    .bind(email)
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

    (StatusCode::OK, Json(user)).into_response()
}

pub async fn discover_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<DiscoverUsersQuery>,
) -> impl IntoResponse {
    let claims = optional_auth_claims(&state, &headers);

    let search = query.q.unwrap_or_default().trim().to_string();
    let limit = query.limit.unwrap_or(8).clamp(1, 25);
    let has_search = !search.is_empty();

    let current_user_id = claims
        .as_ref()
        .and_then(|candidate| Uuid::parse_str(&candidate.sub).ok());
    let include_private_contacts = current_user_id.is_some();
    let normalized_phone_query = normalize_phone(&search);

    let users = match sqlx::query_as::<_, DiscoverUserResponse>(
        r#"
        SELECT
            u.id,
            CASE WHEN $6 THEN u.email::text ELSE NULL END AS email,
            CASE WHEN $6 THEN u.phone ELSE NULL END AS phone,
            up.username::text AS username,
            up.full_name,
            up.metadata->>'avatar_url' AS avatar_url,
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.deleted_at IS NULL
          AND ($1::uuid IS NULL OR u.id <> $1)
          AND (
            $2 = '' OR
            u.email::text ILIKE '%' || $2 || '%' OR
            COALESCE(up.username::text, '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.full_name, '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.location, '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.bio, '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'freelancer_profile'->>'professional_title', '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'freelancer_profile'->>'tagline', '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'provider_profile'->>'headline', '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'buyer_profile'->>'intent', '') ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'freelancer_profile'->'skills', '[]'::jsonb)::text ILIKE '%' || $2 || '%' OR
            COALESCE(up.metadata->'provider_profile'->'skills', '[]'::jsonb)::text ILIKE '%' || $2 || '%' OR
            ($3 <> '' AND regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') LIKE '%' || $3 || '%')
          )
        GROUP BY
            u.id,
            u.email,
            u.phone,
            up.username,
            up.full_name,
            up.metadata,
            up.location,
            up.bio,
            u.created_at
        ORDER BY
          CASE WHEN $4 THEN 0 ELSE 1 END,
          u.created_at DESC
        LIMIT $5
        "#,
    )
    .bind(current_user_id)
    .bind(search)
    .bind(normalized_phone_query)
    .bind(has_search)
    .bind(limit)
    .bind(include_private_contacts)
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
            up.metadata->>'avatar_url' AS avatar_url,
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
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.deleted_at IS NULL
          AND u.id = $1
        GROUP BY
            u.id,
            up.username,
            up.full_name,
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

    let user = PublicUserProfileResponse {
        id,
        username,
        full_name,
        avatar_url,
        bio,
        location,
        headline,
        roles,
        metadata_roles,
        level,
        rating,
        completed_jobs,
        hourly_rate,
        freelancer_profile,
        provider_profile,
        buyer_profile,
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
