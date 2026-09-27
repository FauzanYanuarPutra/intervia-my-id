use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use std::{collections::HashSet, sync::Arc};
use uuid::Uuid;

use crate::{
    auth::{auth_claims_from_headers, user_id_from_auth},
    content_projection::is_public_reference_response_metadata,
    has_agent_access, AppState,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct DataSourceRow {
    id: Uuid,
    source_key: String,
    provider_name: String,
    source_kind: String,
    source_url: String,
    api_url: Option<String>,
    terms_url: Option<String>,
    license_name: Option<String>,
    license_url: Option<String>,
    attribution_text: Option<String>,
    reuse_mode: String,
    storage_allowed: bool,
    media_storage_allowed: bool,
    pii_import_allowed: bool,
    enabled: bool,
    refresh_interval_hours: Option<i32>,
    last_checked_at: Option<DateTime<Utc>>,
    last_success_at: Option<DateTime<Utc>>,
    last_error_at: Option<DateTime<Utc>>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct ImportJobRow {
    id: Uuid,
    source_id: Uuid,
    job_key: String,
    mode: String,
    status: String,
    requested_by: Option<Uuid>,
    started_at: Option<DateTime<Utc>>,
    finished_at: Option<DateTime<Utc>>,
    discovered_count: i32,
    accepted_count: i32,
    rejected_count: i32,
    updated_count: i32,
    archived_count: i32,
    error_count: i32,
    error_summary: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct ClaimRow {
    id: Uuid,
    content_id: Uuid,
    claimant_user_id: Uuid,
    claimant_role: String,
    status: String,
    claim_message: Option<String>,
    reviewed_by: Option<Uuid>,
    reviewed_at: Option<DateTime<Utc>>,
    review_note: Option<String>,
    ownership_granted_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct ClaimEvidenceRow {
    id: Uuid,
    claim_id: Uuid,
    evidence_type: String,
    storage_key: Option<String>,
    external_url: Option<String>,
    description: Option<String>,
    is_sensitive: bool,
    reviewed: bool,
    review_note: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateClaimRequest {
    claimant_role: Option<String>,
    claim_message: Option<String>,
    evidence: Option<Vec<CreateEvidenceRequest>>,
}

#[derive(Debug, Deserialize)]
struct CreateEvidenceRequest {
    evidence_type: String,
    storage_key: Option<String>,
    external_url: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReviewClaimRequest {
    decision: String,
    review_note: Option<String>,
    grant_role: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListClaimsQuery {
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaimDetailResponse {
    claim: ClaimRow,
    evidence: Vec<ClaimEvidenceRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaimStatusResponse {
    content_id: Uuid,
    is_reference: bool,
    claimable: bool,
    claimed: bool,
    active_owner_user_id: Option<Uuid>,
    pending_claim_count: i64,
}

fn clean(value: Option<String>, max: usize) -> Option<String> {
    value
        .map(|v| v.trim().chars().take(max).collect::<String>())
        .filter(|v| !v.is_empty())
}

fn normalize_role(value: Option<String>) -> Option<String> {
    match clean(value, 40)?.to_ascii_lowercase().as_str() {
        "owner" => Some("owner".to_string()),
        "manager" => Some("manager".to_string()),
        "authorized_representative" | "authorized-representative" | "representative" => {
            Some("authorized_representative".to_string())
        }
        "employee" => Some("employee".to_string()),
        _ => None,
    }
}

fn normalize_evidence_type(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().replace(['-', ' '], "_").as_str() {
        "nib" => Some("nib"),
        "npwp" => Some("npwp"),
        "business_license" | "izin_usaha" => Some("business_license"),
        "business_certificate" | "surat_keterangan_usaha" => Some("business_certificate"),
        "tax_document" => Some("tax_document"),
        "brand_ownership" => Some("brand_ownership"),
        "official_domain" => Some("official_domain"),
        "official_social_account" | "official_social" => Some("official_social_account"),
        "utility_bill" => Some("utility_bill"),
        "storefront_photo" | "foto_toko" => Some("storefront_photo"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_grant_role(value: Option<String>) -> &'static str {
    match clean(value, 30).as_deref() {
        Some("manager") => "manager",
        Some("editor") => "editor",
        _ => "owner",
    }
}

fn claimable_reference(metadata: &Value) -> bool {
    is_public_reference_response_metadata(metadata)
        || matches!(
            metadata.get("record_kind").and_then(Value::as_str),
            Some(
                "real_openstreetmap_reference"
                    | "government_reference"
                    | "licensed_reference"
                    | "open_data_reference"
                    | "external_content_reference"
            )
        )
}

async fn load_claim(
    db: &PgPool,
    claim_id: Uuid,
) -> Result<Option<ClaimRow>, sqlx::Error> {
    sqlx::query_as::<_, ClaimRow>(
        r#"
        SELECT id, content_id, claimant_user_id, claimant_role, status, claim_message,
               reviewed_by, reviewed_at, review_note, ownership_granted_at, created_at, updated_at
        FROM business_claims
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(claim_id)
    .fetch_optional(db)
    .await
}

async fn load_claim_evidence(
    db: &PgPool,
    claim_id: Uuid,
) -> Result<Vec<ClaimEvidenceRow>, sqlx::Error> {
    sqlx::query_as::<_, ClaimEvidenceRow>(
        r#"
        SELECT id, claim_id, evidence_type, storage_key, external_url, description,
               is_sensitive, reviewed, review_note, created_at
        FROM business_claim_evidence
        WHERE claim_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(claim_id)
    .fetch_all(db)
    .await
}

async fn claim_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(content_ref): Path<String>,
) -> impl IntoResponse {
    let content = match sqlx::query_as::<_, (Uuid, Option<Uuid>, Value)>(
        "SELECT id, owner_id, metadata FROM content_items WHERE id::text = $1 OR slug = $1 LIMIT 1",
    )
    .bind(content_ref.trim())
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"business reference not found"}))).into_response(),
        Err(error) => {
            tracing::error!("claim_status content lookup failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load business"}))).into_response();
        }
    };

    let pending_claim_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM business_claims WHERE content_id = $1 AND status IN ('pending','under_review')",
    )
    .bind(content.0)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM business_ownership_grants WHERE content_id = $1 AND role = 'owner' AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1",
    )
    .bind(content.0)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let actor = user_id_from_auth(&headers, &state.jwt_secret);
    let claimed = owner.is_some();
    let claimable = claimable_reference(&content.2) && !claimed;

    (
        StatusCode::OK,
        Json(ClaimStatusResponse {
            content_id: content.0,
            is_reference: claimable_reference(&content.2),
            claimable,
            claimed,
            active_owner_user_id: if actor.is_some() || !claimed { owner } else { None },
            pending_claim_count,
        }),
    )
        .into_response()
}

async fn create_claim(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(content_ref): Path<String>,
    Json(payload): Json<CreateClaimRequest>,
) -> impl IntoResponse {
    let claimant_user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };

    let (content_id, owner_id, metadata) = match sqlx::query_as::<_, (Uuid, Option<Uuid>, Value)>(
        "SELECT id, owner_id, metadata FROM content_items WHERE id::text = $1 OR slug = $1 LIMIT 1",
    )
    .bind(content_ref.trim())
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"business reference not found"}))).into_response(),
        Err(error) => {
            tracing::error!("create_claim content lookup failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load business"}))).into_response();
        }
    };

    if !claimable_reference(&metadata) {
        return (StatusCode::CONFLICT, Json(json!({
            "error":"business is not an unclaimed reference",
            "code":"not_claimable"
        }))).into_response();
    }

    let active_owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM business_ownership_grants WHERE content_id = $1 AND role = 'owner' AND revoked_at IS NULL LIMIT 1",
    )
    .bind(content_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    if active_owner.is_some() || owner_id == Some(claimant_user_id) {
        return (StatusCode::CONFLICT, Json(json!({"error":"business is already claimed","code":"already_claimed"}))).into_response();
    }

    let role = normalize_role(payload.claimant_role).unwrap_or_else(|| "owner".to_string());
    let message = clean(payload.claim_message, 4_000);

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("create_claim begin failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to create claim"}))).into_response();
        }
    };

    let claim = match sqlx::query_as::<_, ClaimRow>(
        r#"
        INSERT INTO business_claims (content_id, claimant_user_id, claimant_role, status, claim_message)
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING id, content_id, claimant_user_id, claimant_role, status, claim_message,
                  reviewed_by, reviewed_at, review_note, ownership_granted_at, created_at, updated_at
        "#,
    )
    .bind(content_id)
    .bind(claimant_user_id)
    .bind(role)
    .bind(message)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(sqlx::Error::Database(db_error)) if db_error.code().as_deref() == Some("23505") => {
            let _ = tx.rollback().await;
            return (StatusCode::CONFLICT, Json(json!({"error":"you already have an open claim for this business","code":"duplicate_claim"}))).into_response();
        }
        Err(error) => {
            let _ = tx.rollback().await;
            tracing::error!("create_claim insert failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to create claim"}))).into_response();
        }
    };

    let evidence = payload.evidence.unwrap_or_default();
    let mut seen = HashSet::new();
    for item in evidence.into_iter().take(10) {
        let Some(evidence_type) = normalize_evidence_type(&item.evidence_type) else {
            let _ = tx.rollback().await;
            return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid evidence_type"}))).into_response();
        };
        let storage_key = clean(item.storage_key, 700);
        let external_url = clean(item.external_url, 2_000);
        if storage_key.is_none() && external_url.is_none() {
            let _ = tx.rollback().await;
            return (StatusCode::BAD_REQUEST, Json(json!({"error":"each evidence item needs storage_key or external_url"}))).into_response();
        }
        let dedup_key = format!("{}|{}|{}", evidence_type, storage_key.as_deref().unwrap_or(""), external_url.as_deref().unwrap_or(""));
        if !seen.insert(dedup_key) {
            continue;
        }
        if let Err(error) = sqlx::query(
            r#"
            INSERT INTO business_claim_evidence (
                claim_id, evidence_type, storage_key, external_url, description, is_sensitive
            ) VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(claim.id)
        .bind(evidence_type)
        .bind(storage_key)
        .bind(external_url)
        .bind(clean(item.description, 1_000))
        .bind(!matches!(evidence_type, "official_domain" | "official_social_account" | "storefront_photo"))
        .execute(&mut *tx)
        .await
        {
            let _ = tx.rollback().await;
            tracing::error!("create_claim evidence insert failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to save claim evidence"}))).into_response();
        }
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("create_claim commit failed: {:?}", error);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to create claim"}))).into_response();
    }

    let evidence = load_claim_evidence(&state.db, claim.id).await.unwrap_or_default();
    (
        StatusCode::CREATED,
        Json(ClaimDetailResponse { claim, evidence }),
    )
        .into_response()
}

async fn get_claim(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(claim_id): Path<Uuid>,
) -> impl IntoResponse {
    let actor_claims = auth_claims_from_headers(&headers, &state.jwt_secret);
    let actor_id = actor_claims.as_ref().and_then(|c| Uuid::parse_str(&c.sub).ok());
    let is_agent = actor_claims.as_ref().is_some_and(has_agent_access);
    let claim = match load_claim(&state.db, claim_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"claim not found"}))).into_response(),
        Err(error) => {
            tracing::error!("get_claim failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load claim"}))).into_response();
        }
    };
    if !is_agent && actor_id != Some(claim.claimant_user_id) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"forbidden"}))).into_response();
    }
    let evidence = load_claim_evidence(&state.db, claim.id).await.unwrap_or_default();
    (StatusCode::OK, Json(ClaimDetailResponse { claim, evidence })).into_response()
}

async fn list_my_claims(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListClaimsQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    let limit = query.limit.unwrap_or(30).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);
    let status = clean(query.status, 40);

    let rows = sqlx::query_as::<_, ClaimRow>(
        r#"
        SELECT id, content_id, claimant_user_id, claimant_role, status, claim_message,
               reviewed_by, reviewed_at, review_note, ownership_granted_at, created_at, updated_at
        FROM business_claims
        WHERE claimant_user_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(user_id)
    .bind(status)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more { items.truncate(limit as usize); }
            (StatusCode::OK, Json(json!({"items":items,"limit":limit,"offset":offset,"has_more":has_more}))).into_response()
        }
        Err(error) => {
            tracing::error!("list_my_claims failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load claims"}))).into_response()
        }
    }
}

async fn list_claim_queue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListClaimsQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }

    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let status = clean(query.status, 40).or_else(|| Some("pending".to_string()));

    let rows = sqlx::query_as::<_, ClaimRow>(
        r#"
        SELECT id, content_id, claimant_user_id, claimant_role, status, claim_message,
               reviewed_by, reviewed_at, review_note, ownership_granted_at, created_at, updated_at
        FROM business_claims
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(status)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more { items.truncate(limit as usize); }
            (StatusCode::OK, Json(json!({"items":items,"limit":limit,"offset":offset,"has_more":has_more}))).into_response()
        }
        Err(error) => {
            tracing::error!("list_claim_queue failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load claim queue"}))).into_response()
        }
    }
}

async fn review_claim(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(claim_id): Path<Uuid>,
    Json(payload): Json<ReviewClaimRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }
    let reviewer_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid reviewer"}))).into_response(),
    };

    let decision = clean(Some(payload.decision), 30)
        .map(|v| v.to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(decision.as_str(), "approve" | "reject" | "under_review") {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"decision must be approve, reject, or under_review"}))).into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("review_claim begin failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to review claim"}))).into_response();
        }
    };

    let claim = match sqlx::query_as::<_, ClaimRow>(
        r#"
        SELECT id, content_id, claimant_user_id, claimant_role, status, claim_message,
               reviewed_by, reviewed_at, review_note, ownership_granted_at, created_at, updated_at
        FROM business_claims
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(claim_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"claim not found"}))).into_response(),
        Err(error) => {
            tracing::error!("review_claim lookup failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load claim"}))).into_response();
        }
    };

    if !matches!(claim.status.as_str(), "pending" | "under_review") {
        return (StatusCode::CONFLICT, Json(json!({"error":"claim is already finalized"}))).into_response();
    }

    if decision == "approve" {
        let grant_role = normalize_grant_role(payload.grant_role);
        if grant_role == "owner" {
            let active_owner = match sqlx::query_scalar::<_, Uuid>(
                "SELECT user_id FROM business_ownership_grants WHERE content_id = $1 AND role = 'owner' AND revoked_at IS NULL FOR UPDATE",
            )
            .bind(claim.content_id)
            .fetch_optional(&mut *tx)
            .await {
                Ok(value) => value,
                Err(error) => {
                    let _ = tx.rollback().await;
                    tracing::error!("review_claim owner lookup failed: {:?}", error);
                    return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to verify current owner"}))).into_response();
                }
            };
            if active_owner.is_some() {
                return (StatusCode::CONFLICT, Json(json!({"error":"business already has an active owner"}))).into_response();
            }

            sqlx::query(
                r#"
                UPDATE content_items
                SET owner_id = $2,
                    metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(claim.content_id)
            .bind(claim.claimant_user_id)
            .bind(json!({
                "claim_status":"claimed",
                "claimed_at":Utc::now(),
                "claimed_by":claim.claimant_user_id,
                "claim_source":"business_claim"
            }))
            .execute(&mut *tx)
            .await {
                Ok(_) => {}
                Err(error) => {
                    let _ = tx.rollback().await;
                    tracing::error!("review_claim content ownership update failed: {:?}", error);
                    return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to transfer business access"}))).into_response();
                }
            };
        }

        sqlx::query(
            r#"
            INSERT INTO business_ownership_grants (content_id, user_id, claim_id, role, granted_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (content_id, user_id, role) WHERE revoked_at IS NULL
            DO UPDATE SET claim_id = EXCLUDED.claim_id, granted_by = EXCLUDED.granted_by, granted_at = NOW()
            "#,
        )
        .bind(claim.content_id)
        .bind(claim.claimant_user_id)
        .bind(claim.id)
        .bind(grant_role)
        .bind(reviewer_id)
        .execute(&mut *tx)
        .await {
            Ok(_) => {}
            Err(error) => {
                let _ = tx.rollback().await;
                tracing::error!("review_claim grant insert failed: {:?}", error);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to grant business access"}))).into_response();
            }
        }

        sqlx::query(
            r#"
            UPDATE business_claims
            SET status = 'approved',
                reviewed_by = $2,
                reviewed_at = NOW(),
                review_note = $3,
                ownership_granted_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(claim.id)
        .bind(reviewer_id)
        .bind(clean(payload.review_note, 4_000))
        .execute(&mut *tx)
        .await {
            Ok(_) => {}
            Err(error) => {
                let _ = tx.rollback().await;
                tracing::error!("review_claim approval update failed: {:?}", error);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to finalize claim"}))).into_response();
            }
        }
    } else {
        let next_status = if decision == "under_review" { "under_review" } else { "rejected" };
        sqlx::query(
            r#"
            UPDATE business_claims
            SET status = $2,
                reviewed_by = $3,
                reviewed_at = CASE WHEN $2 = 'rejected' THEN NOW() ELSE reviewed_at END,
                review_note = $4,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(claim.id)
        .bind(next_status)
        .bind(reviewer_id)
        .bind(clean(payload.review_note, 4_000))
        .execute(&mut *tx)
        .await {
            Ok(_) => {}
            Err(error) => {
                let _ = tx.rollback().await;
                tracing::error!("review_claim update failed: {:?}", error);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to update claim"}))).into_response();
            }
        }
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("review_claim commit failed: {:?}", error);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to finalize claim"}))).into_response();
    }

    let updated = match load_claim(&state.db, claim.id).await {
        Ok(Some(row)) => row,
        _ => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"claim finalized but could not be reloaded"}))).into_response(),
    };
    let evidence = load_claim_evidence(&state.db, claim.id).await.unwrap_or_default();
    (
        StatusCode::OK,
        Json(ClaimDetailResponse { claim: updated, evidence }),
    )
        .into_response()
}

async fn list_sources(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, DataSourceRow>(
        r#"
        SELECT id, source_key, provider_name, source_kind, source_url, api_url, terms_url,
               license_name, license_url, attribution_text, reuse_mode, storage_allowed,
               media_storage_allowed, pii_import_allowed, enabled, refresh_interval_hours,
               last_checked_at, last_success_at, last_error_at, notes, created_at, updated_at
        FROM data_source_registry
        WHERE enabled = TRUE
        ORDER BY provider_name ASC, source_key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(items) => (StatusCode::OK, Json(json!({"items":items}))).into_response(),
        Err(error) => {
            tracing::error!("list_sources failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load data sources"}))).into_response()
        }
    }
}

async fn list_import_jobs(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListClaimsQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    match sqlx::query_as::<_, ImportJobRow>(
        r#"
        SELECT id, source_id, job_key, mode, status, requested_by, started_at, finished_at,
               discovered_count, accepted_count, rejected_count, updated_count, archived_count,
               error_count, error_summary, created_at
        FROM data_import_jobs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(items) => (StatusCode::OK, Json(json!({"items":items,"limit":limit,"offset":offset}))).into_response(),
        Err(error) => {
            tracing::error!("list_import_jobs failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load import jobs"}))).into_response()
        }
    }
}

async fn inspect_source(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(source_key): Path<String>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }

    let source = match sqlx::query_as::<_, DataSourceRow>(
        r#"SELECT id, source_key, provider_name, source_kind, source_url, api_url, terms_url,
            license_name, license_url, attribution_text, reuse_mode, storage_allowed,
            media_storage_allowed, pii_import_allowed, enabled, refresh_interval_hours,
            last_checked_at, last_success_at, last_error_at, notes, created_at, updated_at
            FROM data_source_registry WHERE source_key = $1 LIMIT 1"#,
    )
    .bind(source_key.trim())
    .fetch_optional(&state.db)
    .await {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"source not found"}))).into_response(),
        Err(error) => {
            tracing::error!("inspect_source lookup failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load source"}))).into_response();
        }
    };

    let Some(api_url) = source.api_url.clone() else {
        return (StatusCode::CONFLICT, Json(json!({
            "error":"source has no machine-readable catalog endpoint",
            "source_key":source.source_key
        }))).into_response();
    };

    let response = match state.http_client.get(&api_url).send().await {
        Ok(response) => response,
        Err(error) => {
            tracing::error!("inspect_source request failed: {:?}", error);
            return (StatusCode::BAD_GATEWAY, Json(json!({"error":"source catalog request failed"}))).into_response();
        }
    };

    let status = response.status();
    if !status.is_success() {
        return (StatusCode::BAD_GATEWAY, Json(json!({
            "error":"source catalog returned non-success status",
            "upstream_status":status.as_u16()
        }))).into_response();
    }

    let body = match response.json::<Value>().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("inspect_source JSON decode failed: {:?}", error);
            return (StatusCode::BAD_GATEWAY, Json(json!({"error":"source catalog returned invalid JSON"}))).into_response();
        }
    };

    let package = body.get("result").cloned().unwrap_or_else(|| body.clone());
    let resources = package.get("resources").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut resource_report = Vec::with_capacity(resources.len());
    let mut redistributable_candidates = 0usize;

    for resource in resources.iter().take(500) {
        let license = resource.get("license").or_else(|| resource.get("license_title"));
        let license_text = license.and_then(Value::as_str).unwrap_or("").trim();
        let format = resource.get("format").and_then(Value::as_str).unwrap_or("").trim();
        let datastore_active = resource.get("datastore_active").and_then(Value::as_bool).unwrap_or(false);
        let has_url = resource.get("url").and_then(Value::as_str).is_some_and(|value| !value.trim().is_empty());
        let license_known = !license_text.is_empty()
            || source.license_name.as_deref().is_some_and(|value| !value.trim().is_empty());
        if license_known && has_url {
            redistributable_candidates += 1;
        }
        resource_report.push(json!({
            "id": resource.get("id"),
            "name": resource.get("name"),
            "format": format,
            "mimetype": resource.get("mimetype"),
            "url": resource.get("url"),
            "license": license,
            "datastore_active": datastore_active,
            "license_known": license_known,
            "has_url": has_url
        }));
    }

    let dataset_license = package.get("license_title")
        .or_else(|| package.get("license_id"))
        .or_else(|| package.get("license_url"));

    let can_enable_persistent_import = source.reuse_mode == "persistent_import"
        && source.storage_allowed
        && redistributable_candidates > 0;

    let _ = sqlx::query(
        "UPDATE data_source_registry SET last_checked_at = NOW(), last_error_at = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(source.id)
    .execute(&state.db)
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "source": {
                "source_key":source.source_key,
                "provider":source.provider_name,
                "reuse_mode":source.reuse_mode,
                "storage_allowed":source.storage_allowed,
                "configured_license":source.license_name
            },
            "dataset_license":dataset_license,
            "resource_count":resources.len(),
            "resource_limit_applied":resources.len() > 500,
            "redistributable_candidates":redistributable_candidates,
            "can_enable_persistent_import":can_enable_persistent_import,
            "resources":resource_report,
            "note":"This is a metadata inspection only. It does not copy dataset rows into Lajukan."
        }))
    ).into_response()
}

async fn create_import_job(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(source_key): Path<String>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response(),
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }
    let requester_id = Uuid::parse_str(&claims.sub).ok();
    let source = match sqlx::query_as::<_, DataSourceRow>(
        r#"
        SELECT id, source_key, provider_name, source_kind, source_url, api_url, terms_url,
               license_name, license_url, attribution_text, reuse_mode, storage_allowed,
               media_storage_allowed, pii_import_allowed, enabled, refresh_interval_hours,
               last_checked_at, last_success_at, last_error_at, notes, created_at, updated_at
        FROM data_source_registry WHERE source_key = $1 LIMIT 1
        "#,
    )
    .bind(source_key.trim())
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"error":"source not found"}))).into_response(),
        Err(error) => {
            tracing::error!("create_import_job source lookup failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load source"}))).into_response();
        }
    };

    let requested_mode = payload.get("mode").and_then(Value::as_str).unwrap_or("dry_run");
    let mode = match requested_mode {
        "dry_run" => "dry_run",
        "import" if source.storage_allowed && source.reuse_mode == "persistent_import" => "import",
        "refresh" if source.storage_allowed && source.reuse_mode == "persistent_import" => "refresh",
        "archive" => "archive",
        _ => {
            return (StatusCode::CONFLICT, Json(json!({
                "error":"source policy does not permit this import mode",
                "reuse_mode":source.reuse_mode,
                "storage_allowed":source.storage_allowed
            }))).into_response();
        }
    };

    if source.source_kind == "commercial_api" || source.reuse_mode == "live_only" {
        return (StatusCode::CONFLICT, Json(json!({
            "error":"this source is live-only and cannot be bulk imported",
            "source_key":source.source_key
        }))).into_response();
    }

    let job_key = format!("{}:{}:{}", source.source_key, mode, Uuid::new_v4().simple());
    match sqlx::query_as::<_, ImportJobRow>(
        r#"
        INSERT INTO data_import_jobs (source_id, job_key, mode, status, requested_by)
        VALUES ($1, $2, $3, 'queued', $4)
        RETURNING id, source_id, job_key, mode, status, requested_by, started_at, finished_at,
                  discovered_count, accepted_count, rejected_count, updated_count, archived_count,
                  error_count, error_summary, created_at
        "#,
    )
    .bind(source.id)
    .bind(job_key)
    .bind(mode)
    .bind(requester_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(job) => {
            let state_for_job = state.clone();
            tokio::spawn(async move {
                if let Err(error) = crate::data_importer::run(state_for_job, job.id).await {
                    tracing::error!("data importer job {} failed: {:?}", job.id, error);
                }
            });
            (StatusCode::ACCEPTED, Json(json!({
                "job": job,
                "note": "Job queued and staged only. No public business is created automatically."
            }))).into_response()
        },
        Err(error) => {
            tracing::error!("create_import_job insert failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to create import job"}))).into_response()
        }
    }
}


pub async fn sync_static_source_registry(db: &PgPool) -> Result<(), sqlx::Error> {
    #[derive(Deserialize)]
    struct Registry { sources: Vec<SourceSeed> }
    #[derive(Deserialize)]
    struct SourceSeed {
        id: String, provider: String, kind: String, url: String,
        #[serde(default)] dataset_id: Option<String>,
        #[serde(default)] reuse_mode: Option<String>,
        #[serde(default)] license: Option<String>,
        #[serde(default)] attribution: Option<String>,
        #[serde(default)] notes: Option<String>,
    }

    let registry: Registry = serde_json::from_str(
        include_str!("../../../config/lajukan_data_source_registry.json")
    ).map_err(|error| sqlx::Error::Protocol(format!("invalid static source registry: {}", error)))?;

    for source in registry.sources {
        let requested_mode = source.reuse_mode.as_deref().unwrap_or("review_required");
        let reuse_mode = match requested_mode {
            "persistent_import" => "persistent_import",
            "derived_only" => "derived_only",
            "live_only" => "live_only",
            "link_only" => "link_only",
            _ => "review_required",
        };
        let storage_allowed = reuse_mode == "persistent_import";
        let api_url = source.dataset_id.as_ref().map(|dataset_id| format!("https://data.go.id/api/action/package_show?id={}", dataset_id));
        let notes = match (source.dataset_id, source.notes) {
            (Some(dataset_id), Some(notes)) => Some(format!("{} dataset_id={}", notes, dataset_id)),
            (Some(dataset_id), None) => Some(format!("dataset_id={}", dataset_id)),
            (None, notes) => notes,
        };
        sqlx::query(
            r#"INSERT INTO data_source_registry (
                source_key, provider_name, source_kind, source_url, api_url, license_name, attribution_text,
                reuse_mode, storage_allowed, media_storage_allowed, pii_import_allowed, enabled, notes, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,FALSE,TRUE,$10,NOW())
            ON CONFLICT (source_key) DO UPDATE SET
                provider_name=EXCLUDED.provider_name, source_kind=EXCLUDED.source_kind, source_url=EXCLUDED.source_url,
                api_url=EXCLUDED.api_url, license_name=EXCLUDED.license_name, attribution_text=EXCLUDED.attribution_text,
                reuse_mode=EXCLUDED.reuse_mode, storage_allowed=EXCLUDED.storage_allowed,
                media_storage_allowed=EXCLUDED.media_storage_allowed, pii_import_allowed=EXCLUDED.pii_import_allowed,
                enabled=EXCLUDED.enabled, notes=EXCLUDED.notes, updated_at=NOW()"#
        )
        .bind(source.id).bind(source.provider).bind(source.kind).bind(source.url).bind(api_url)
        .bind(source.license).bind(source.attribution).bind(reuse_mode).bind(storage_allowed).bind(notes)
        .execute(db).await?;
    }
    Ok(())
}
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/data/sources", get(list_sources))
        .route("/v1/data/import-jobs", get(list_import_jobs))
        .route("/v1/data/import-jobs/{source_key}", post(create_import_job))
        .route("/v1/data/sources/{source_key}/inspect", post(inspect_source))
        .route("/v1/businesses/{content_ref}/claim", get(claim_status).post(create_claim))
        .route("/v1/businesses/{content_ref}/claims", get(claim_status).post(create_claim))
        .route("/v1/business-claims", get(list_my_claims))
        .route("/v1/business-claims/queue", get(list_claim_queue))
        .route("/v1/business-claims/{claim_id}", get(get_claim))
        .route("/v1/business-claims/{claim_id}/review", post(review_claim))
}
