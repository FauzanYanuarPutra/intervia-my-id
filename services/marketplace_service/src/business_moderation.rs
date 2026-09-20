use super::*;

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
use sqlx::Row;
use uuid::Uuid;

const BUSINESS_MAX_QUERY_LEN: usize = 120;
const BUSINESS_MAX_LIMIT: i64 = 100;
const BUSINESS_MAX_REASON_LEN: usize = 4_000;

#[derive(Debug, Deserialize, Default)]
pub struct ListCrmBusinessesQuery {
    pub q: Option<String>,
    pub city: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BusinessModerationRequest {
    pub action: String,
    pub reason_code: String,
    pub reason_note: Option<String>,
    #[serde(default)]
    pub missing_fields: Vec<String>,
    pub severity: Option<String>,
    pub legal_hold: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CrmBusinessRow {
    pub id: Uuid,
    pub owner_user_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub city: String,
    pub address: String,
    pub lat: f64,
    pub lng: f64,
    pub phone: Option<String>,
    pub is_active: bool,
    pub online_order_enabled: bool,
    pub offline_order_enabled: bool,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub review_state: String,
    pub current_action: Option<String>,
    pub current_reason_code: Option<String>,
    pub current_reason_note: Option<String>,
    pub moderation_status: Option<String>,
    pub moderation_severity: Option<String>,
    pub missing_fields: Vec<String>,
    pub completeness_percent: i32,
    pub image_urls: Vec<String>,
}

fn has_business_moderation_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|role| {
        matches!(
            role.trim().to_ascii_lowercase().as_str(),
            "moderator" | "admin" | "super_admin"
        )
    }) || claims
        .perms
        .iter()
        .any(|permission| permission.eq_ignore_ascii_case("content:moderate"))
}

fn normalize_text(value: Option<String>, max_len: usize) -> Option<String> {
    let value = value?.trim().to_string();
    if value.is_empty() {
        return None;
    }
    Some(value.chars().take(max_len).collect())
}

fn normalize_action(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "approve" => Some("approve"),
        "restore" => Some("restore"),
        "request_completion" | "needs_completion" | "needs_revision" => Some("request_completion"),
        "hide" | "restrict" => Some("hide"),
        "reject" | "remove" => Some("reject"),
        "escalate" => Some("escalate"),
        _ => None,
    }
}

fn normalize_reason(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "missing_required_info" => Some("missing_required_info"),
        "missing_image" => Some("missing_image"),
        "missing_contact" => Some("missing_contact"),
        "policy_violation" => Some("policy_violation"),
        "unverifiable_business" => Some("unverifiable_business"),
        "duplicate_business" => Some("duplicate_business"),
        "fraud_misleading" => Some("fraud_misleading"),
        "inaccurate_information" => Some("inaccurate_information"),
        "privacy_personal_data" => Some("privacy_personal_data"),
        "owner_request" => Some("owner_request"),
        "quality" => Some("quality"),
        "not_eligible" => Some("not_eligible"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_severity(raw: Option<&str>) -> &'static str {
    match raw.unwrap_or("medium").trim().to_ascii_lowercase().as_str() {
        "low" => "low",
        "high" => "high",
        "critical" => "critical",
        _ => "medium",
    }
}

fn collect_metadata_images(metadata: &Value) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = std::collections::HashSet::new();

    fn collect(value: &Value, urls: &mut Vec<String>, seen: &mut std::collections::HashSet<String>) {
        match value {
            Value::String(raw) => {
                let candidate = raw.trim();
                if candidate.is_empty() {
                    return;
                }
                let lower = candidate.to_ascii_lowercase();
                let likely = lower.starts_with("http://")
                    || lower.starts_with("https://")
                    || lower.starts_with("/uploads/")
                    || lower.starts_with("/media/")
                    || lower.starts_with("/images/");
                if likely && seen.insert(candidate.to_string()) {
                    urls.push(candidate.to_string());
                }
            }
            Value::Array(items) => {
                for item in items.iter().take(20) {
                    collect(item, urls, seen);
                }
            }
            Value::Object(map) => {
                for key in [
                    "cover_image",
                    "coverImage",
                    "image",
                    "image_url",
                    "imageUrl",
                    "image_urls",
                    "imageUrls",
                    "images",
                    "gallery",
                    "gallery_images",
                    "galleryImages",
                    "media",
                    "media_urls",
                    "mediaUrls",
                    "photos",
                    "logo",
                    "logo_url",
                    "logoUrl",
                    "thumbnail",
                    "thumbnail_url",
                    "thumbnailUrl",
                ] {
                    if let Some(value) = map.get(key) {
                        collect(value, urls, seen);
                    }
                }
            }
            _ => {}
        }
    }

    collect(metadata, &mut urls, &mut seen);
    urls.truncate(12);
    urls
}

fn metadata_text(metadata: &Value, keys: &[&str]) -> Option<String> {
    let object = metadata.as_object()?;
    for key in keys {
        if let Some(value) = object.get(*key).and_then(Value::as_str) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn derive_missing_fields(
    name: &str,
    description: Option<&str>,
    city: &str,
    address: &str,
    phone: Option<&str>,
    lat: f64,
    lng: f64,
    metadata: &Value,
) -> Vec<String> {
    let mut missing = Vec::new();
    if name.trim().is_empty() {
        missing.push("Nama usaha".to_string());
    }
    if metadata_text(metadata, &["category", "category_label", "business_category"]).is_none() {
        missing.push("Kategori usaha".to_string());
    }
    if description.map(str::trim).filter(|v| !v.is_empty()).is_none() {
        missing.push("Deskripsi usaha".to_string());
    }
    if city.trim().is_empty() {
        missing.push("Kota".to_string());
    }
    if address.trim().is_empty() {
        missing.push("Alamat".to_string());
    }
    if phone.map(str::trim).filter(|v| !v.is_empty()).is_none() {
        missing.push("Nomor kontak".to_string());
    }
    if !lat.is_finite() || !lng.is_finite() || lat.abs() > 90.0 || lng.abs() > 180.0 {
        missing.push("Lokasi peta".to_string());
    }
    if collect_metadata_images(metadata).is_empty() {
        missing.push("Foto/logo usaha".to_string());
    }
    missing
}

fn completeness_percent(missing: &[String]) -> i32 {
    let total = 8i32;
    let missing_count = missing.len().min(total as usize) as i32;
    (((total - missing_count) * 100) / total).clamp(0, 100)
}

fn review_state(current_action: Option<&str>, status: Option<&str>, is_active: bool) -> String {
    match (current_action, status) {
        (Some("hide") | Some("reject"), _) => "hidden".to_string(),
        (Some("request_completion"), Some("awaiting_owner")) => "needs_completion".to_string(),
        (Some("approve") | Some("restore"), Some("resolved")) if is_active => "approved".to_string(),
        (Some("escalate"), Some("escalated")) => "escalated".to_string(),
        (None, _) => "unreviewed".to_string(),
        _ if !is_active => "hidden".to_string(),
        _ => "under_review".to_string(),
    }
}

fn business_snapshot(row: &CrmBusinessRow) -> Value {
    json!({
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "organization_id": row.organization_id,
        "name": row.name,
        "slug": row.slug,
        "description": row.description,
        "city": row.city,
        "address": row.address,
        "phone": row.phone,
        "is_active": row.is_active,
        "online_order_enabled": row.online_order_enabled,
        "offline_order_enabled": row.offline_order_enabled,
        "metadata": row.metadata,
        "completeness_percent": row.completeness_percent,
        "missing_fields": row.missing_fields
    })
}

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/crm/businesses", get(list_crm_businesses))
        .route("/v1/crm/businesses/{id}/moderation/history", get(get_business_moderation_history))
        .route("/v1/crm/businesses/{id}/moderate", post(moderate_business))
}

async fn list_crm_businesses(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListCrmBusinessesQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business moderation permission required").into_response();
    }

    let q = normalize_text(query.q, BUSINESS_MAX_QUERY_LEN);
    let city = normalize_text(query.city, 80);
    let limit = query.limit.unwrap_or(50).clamp(1, BUSINESS_MAX_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = match sqlx::query(
        r#"
        SELECT
          s.id, s.owner_user_id, s.organization_id, s.name, s.slug, s.description,
          s.city, s.address, s.lat, s.lng, s.phone, s.is_active,
          s.online_order_enabled, s.offline_order_enabled, s.metadata,
          s.created_at, s.updated_at,
          c.status AS moderation_status,
          c.current_action,
          c.current_reason_code,
          c.current_reason_note,
          c.severity AS moderation_severity,
          c.missing_fields,
          c.updated_at AS moderation_updated_at
        FROM umkm_stores s
        LEFT JOIN LATERAL (
          SELECT status, current_action, current_reason_code, current_reason_note,
                 severity, missing_fields, updated_at
          FROM internal_moderation.business_moderation_cases
          WHERE business_id = s.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) c ON TRUE
        WHERE ($1::text IS NULL OR
               s.name ILIKE '%' || $1 || '%' OR
               s.slug ILIKE '%' || $1 || '%' OR
               COALESCE(s.description, '') ILIKE '%' || $1 || '%' OR
               COALESCE(s.city, '') ILIKE '%' || $1 || '%' OR
               COALESCE(s.address, '') ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR s.city ILIKE '%' || $2 || '%')
        ORDER BY
          CASE
            WHEN c.status IN ('open','reviewing','awaiting_owner','escalated') THEN 0
            WHEN c.current_action IN ('hide','reject') THEN 1
            ELSE 2
          END,
          s.updated_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(&q)
    .bind(&city)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("list_crm_businesses error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load businesses").into_response();
        }
    };

    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let metadata: Value = row.get("metadata");
        let name: String = row.get("name");
        let description: Option<String> = row.get("description");
        let city: String = row.get("city");
        let address: String = row.get("address");
        let phone: Option<String> = row.get("phone");
        let lat: f64 = row.get("lat");
        let lng: f64 = row.get("lng");
        let images = collect_metadata_images(&metadata);
        let missing = derive_missing_fields(
            &name,
            description.as_deref(),
            &city,
            &address,
            phone.as_deref(),
            lat,
            lng,
            &metadata,
        );
        let current_action: Option<String> = row.get("current_action");
        let moderation_status: Option<String> = row.get("moderation_status");
        let is_active: bool = row.get("is_active");
        let review = review_state(
            current_action.as_deref(),
            moderation_status.as_deref(),
            is_active,
        );
        items.push(CrmBusinessRow {
            id: row.get("id"),
            owner_user_id: row.get("owner_user_id"),
            organization_id: row.get("organization_id"),
            name,
            slug: row.get("slug"),
            description,
            city,
            address,
            lat,
            lng,
            phone,
            is_active,
            online_order_enabled: row.get("online_order_enabled"),
            offline_order_enabled: row.get("offline_order_enabled"),
            metadata,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            review_state: review,
            current_action,
            current_reason_code: row.get("current_reason_code"),
            current_reason_note: row.get("current_reason_note"),
            moderation_status,
            moderation_severity: row.get("moderation_severity"),
            missing_fields: missing,
            completeness_percent: completeness_percent(&missing),
            image_urls: images,
        });
    }

    (
        StatusCode::OK,
        Json(json!({
            "items": items,
            "limit": limit,
            "offset": offset,
            "has_more": items.len() as i64 == limit
        })),
    )
        .into_response()
}

async fn load_business(state: &AppState, business_id: Uuid) -> Result<CrmBusinessRow, Response> {
    let row = sqlx::query(
        r#"
        SELECT
          s.id, s.owner_user_id, s.organization_id, s.name, s.slug, s.description,
          s.city, s.address, s.lat, s.lng, s.phone, s.is_active,
          s.online_order_enabled, s.offline_order_enabled, s.metadata,
          s.created_at, s.updated_at,
          c.status AS moderation_status,
          c.current_action,
          c.current_reason_code,
          c.current_reason_note,
          c.severity AS moderation_severity,
          c.missing_fields
        FROM umkm_stores s
        LEFT JOIN LATERAL (
          SELECT status, current_action, current_reason_code, current_reason_note,
                 severity, missing_fields
          FROM internal_moderation.business_moderation_cases
          WHERE business_id = s.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) c ON TRUE
        WHERE s.id = $1
        "#,
    )
    .bind(business_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business").into_response())?
    .ok_or_else(|| err(StatusCode::NOT_FOUND, "business not found").into_response())?;

    let metadata: Value = row.get("metadata");
    let name: String = row.get("name");
    let description: Option<String> = row.get("description");
    let city: String = row.get("city");
    let address: String = row.get("address");
    let phone: Option<String> = row.get("phone");
    let lat: f64 = row.get("lat");
    let lng: f64 = row.get("lng");
    let missing = derive_missing_fields(
        &name,
        description.as_deref(),
        &city,
        &address,
        phone.as_deref(),
        lat,
        lng,
        &metadata,
    );
    let current_action: Option<String> = row.get("current_action");
    let moderation_status: Option<String> = row.get("moderation_status");
    let is_active: bool = row.get("is_active");

    Ok(CrmBusinessRow {
        id: row.get("id"),
        owner_user_id: row.get("owner_user_id"),
        organization_id: row.get("organization_id"),
        name,
        slug: row.get("slug"),
        description,
        city,
        address,
        lat,
        lng,
        phone,
        is_active,
        online_order_enabled: row.get("online_order_enabled"),
        offline_order_enabled: row.get("offline_order_enabled"),
        metadata,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        review_state: review_state(current_action.as_deref(), moderation_status.as_deref(), is_active),
        current_action,
        current_reason_code: row.get("current_reason_code"),
        current_reason_note: row.get("current_reason_note"),
        moderation_status,
        moderation_severity: row.get("moderation_severity"),
        missing_fields: missing.clone(),
        completeness_percent: completeness_percent(&missing),
        image_urls: collect_metadata_images(&row.get::<Value,_>("metadata")),
    })
}

async fn moderate_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<BusinessModerationRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business moderation permission required").into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };

    let action = match normalize_action(&payload.action) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "unsupported business moderation action").into_response(),
    };
    let reason_code = match normalize_reason(&payload.reason_code) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "unsupported business moderation reason").into_response(),
    };
    let reason_note = normalize_text(payload.reason_note, BUSINESS_MAX_REASON_LEN);
    if matches!(action, "request_completion" | "hide" | "reject" | "escalate")
        && reason_note.is_none()
    {
        return err(StatusCode::BAD_REQUEST, "reason note is required for this action").into_response();
    }
    if reason_code == "other" && reason_note.is_none() {
        return err(StatusCode::BAD_REQUEST, "reason note is required when reason is other").into_response();
    }

    let mut business = match load_business(&state, id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let missing_fields = if action == "request_completion" {
        if payload.missing_fields.is_empty() {
            business.missing_fields.clone()
        } else {
            payload.missing_fields
                .into_iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .take(20)
                .collect()
        }
    } else {
        Vec::new()
    };

    if action == "request_completion" && missing_fields.is_empty() {
        return err(StatusCode::CONFLICT, "business is already complete").into_response();
    }

    if matches!(action, "approve" | "restore") && !business.missing_fields.is_empty() {
        return err(
            StatusCode::CONFLICT,
            "business still has missing required data",
        )
        .into_response();
    }

    let severity = normalize_severity(payload.severity.as_deref());
    let legal_hold = payload
        .legal_hold
        .unwrap_or(matches!(severity, "high" | "critical"));

    let previous_action = business.current_action.clone().unwrap_or_else(|| "none".to_string());
    let previous_status = business
        .moderation_status
        .clone()
        .unwrap_or_else(|| "new".to_string());

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to open transaction").into_response(),
    };

    let new_status = match action {
        "request_completion" => "awaiting_owner",
        "escalate" => "escalated",
        _ => "resolved",
    };

    let new_is_active = match action {
        "hide" | "reject" => false,
        "approve" | "restore" => true,
        _ => business.is_active,
    };

    if new_is_active != business.is_active {
        if sqlx::query(
            "UPDATE umkm_stores SET is_active = $2, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .bind(new_is_active)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            let _ = tx.rollback().await;
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update business visibility").into_response();
        }
        business.is_active = new_is_active;
    }

    let case_id: Uuid = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_cases
          (business_id, owner_user_id, opened_by, assigned_to, source, status, severity,
           current_action, current_reason_code, current_reason_note, missing_fields, legal_hold,
           opened_at, updated_at, resolved_at)
        VALUES ($1,$2,$3,$3,'proactive',$4,$5,$6,$7,$8,$9::jsonb,$10,NOW(),NOW(),
                CASE WHEN $4 = 'resolved' THEN NOW() ELSE NULL END)
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(business.owner_user_id)
    .bind(actor_id)
    .bind(new_status)
    .bind(severity)
    .bind(action)
    .bind(reason_code)
    .bind(reason_note.as_deref())
    .bind(serde_json::to_value(&missing_fields).unwrap_or_else(|_| json!([])))
    .bind(legal_hold)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row.get("id"),
        Err(error) => {
            let _ = tx.rollback().await;
            tracing::error!("create business moderation case error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create business moderation case").into_response();
        }
    };

    let snapshot = business_snapshot(&business);

    if sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, missing_fields, business_snapshot, legal_hold)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
        "#,
    )
    .bind(case_id)
    .bind(actor_id)
    .bind(action)
    .bind(reason_code)
    .bind(reason_note.as_deref())
    .bind(severity)
    .bind(previous_status)
    .bind(new_status)
    .bind(serde_json::to_value(&missing_fields).unwrap_or_else(|_| json!([])))
    .bind(snapshot)
    .bind(legal_hold)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to write business moderation history").into_response();
    }

    if tx.commit().await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to commit business moderation").into_response();
    }

    let (title, message) = match action {
        "request_completion" => (
            "Data usaha perlu dilengkapi",
            format!(
                "Usaha {} perlu dilengkapi sebelum penayangan dapat ditinjau kembali. Data yang belum lengkap: {}.",
                business.name,
                missing_fields.join(", ")
            ),
        ),
        "hide" => (
            "Usaha disembunyikan sementara",
            format!("Usaha {} sementara tidak ditampilkan ke publik. Buka detail notifikasi untuk melihat alasannya.", business.name),
        ),
        "reject" => (
            "Penayangan usaha ditolak",
            format!("Usaha {} belum dapat ditampilkan ke publik. Buka detail notifikasi untuk melihat alasannya.", business.name),
        ),
        "restore" | "approve" => (
            "Usaha kembali ditampilkan",
            format!("Usaha {} telah ditinjau dan kembali dapat ditampilkan ke publik.", business.name),
        ),
        "escalate" => (
            "Usaha masuk peninjauan lanjutan",
            format!("Usaha {} sedang ditinjau lebih lanjut oleh tim Lajukan.", business.name),
        ),
        _ => ("Pembaruan status usaha", format!("Status usaha {} diperbarui.", business.name)),
    };

    push_notification_best_effort(
        &state,
        business.owner_user_id,
        "business",
        &format!("business_moderation_{}", action),
        title,
        &message,
        json!({
            "business_id": business.id,
            "action": action,
            "reason_code": reason_code,
            "reason_note": reason_note,
            "missing_fields": missing_fields,
            "severity": severity
        }),
    )
    .await;

    push_notification_best_effort(
        &state,
        actor_id,
        "crm",
        &format!("crm_business_moderation_{}", action),
        "Aktivitas moderasi usaha tersimpan",
        &format!("{} — {}.", business.name, title),
        json!({
            "business_id": business.id,
            "action": action,
            "reason_code": reason_code,
            "missing_fields": missing_fields
        }),
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "business": load_business(&state, id).await.ok(),
            "case_id": case_id,
            "action": action,
            "reason_code": reason_code,
            "reason_note": reason_note,
            "missing_fields": missing_fields,
            "severity": severity,
            "legal_hold": legal_hold,
            "visibility": if business.is_active { "public_candidate" } else { "hidden" }
        })),
    )
        .into_response()
}

async fn get_business_moderation_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business moderation permission required").into_response();
    }

    if let Err(response) = load_business(&state, id).await {
        return response.into_response();
    }

    let cases = match sqlx::query(
        r#"
        SELECT id, status, source, assigned_to, current_action, current_reason_code,
               current_reason_note, severity, missing_fields, legal_hold,
               opened_at, updated_at, resolved_at
        FROM internal_moderation.business_moderation_cases
        WHERE business_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows
            .into_iter()
            .map(|row| {
                json!({
                    "id": row.get::<Uuid,_>("id"),
                    "status": row.get::<String,_>("status"),
                    "source": row.get::<String,_>("source"),
                    "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                    "current_action": row.get::<Option<String>,_>("current_action"),
                    "current_reason_code": row.get::<Option<String>,_>("current_reason_code"),
                    "current_reason_note": row.get::<Option<String>,_>("current_reason_note"),
                    "severity": row.get::<String,_>("severity"),
                    "missing_fields": row.get::<Value,_>("missing_fields"),
                    "legal_hold": row.get::<bool,_>("legal_hold"),
                    "opened_at": row.get::<DateTime<Utc>,_>("opened_at"),
                    "updated_at": row.get::<DateTime<Utc>,_>("updated_at"),
                    "resolved_at": row.get::<Option<DateTime<Utc>>,_>("resolved_at")
                })
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            tracing::error!("business moderation cases history error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business history").into_response();
        }
    };

    let events = match sqlx::query(
        r#"
        SELECT id, case_id, actor_id, action, reason_code, reason_note, severity,
               previous_status, new_status, missing_fields, business_snapshot,
               legal_hold, created_at
        FROM internal_moderation.business_moderation_events
        WHERE case_id IN (
          SELECT id
          FROM internal_moderation.business_moderation_cases
          WHERE business_id = $1
        )
        ORDER BY created_at DESC
        LIMIT 300
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows
            .into_iter()
            .map(|row| {
                json!({
                    "id": row.get::<Uuid,_>("id"),
                    "case_id": row.get::<Uuid,_>("case_id"),
                    "actor_id": row.get::<Option<Uuid>,_>("actor_id"),
                    "action": row.get::<String,_>("action"),
                    "reason_code": row.get::<String,_>("reason_code"),
                    "reason_note": row.get::<Option<String>,_>("reason_note"),
                    "severity": row.get::<String,_>("severity"),
                    "previous_status": row.get::<Option<String>,_>("previous_status"),
                    "new_status": row.get::<Option<String>,_>("new_status"),
                    "missing_fields": row.get::<Value,_>("missing_fields"),
                    "business_snapshot": row.get::<Value,_>("business_snapshot"),
                    "legal_hold": row.get::<bool,_>("legal_hold"),
                    "created_at": row.get::<DateTime<Utc>,_>("created_at")
                })
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            tracing::error!("business moderation events history error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business history events").into_response();
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "cases": cases,
            "events": events
        })),
    )
        .into_response()
}
