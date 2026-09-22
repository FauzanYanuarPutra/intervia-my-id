use super::*;

use crate::moderation;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
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
pub struct CrmBusinessReferenceRow {
    pub id: Uuid,
    pub slug: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub cover_image: Option<String>,
    pub city: Option<String>,
    pub address: Option<String>,
    pub source_url: Option<String>,
    pub source_dataset: Option<String>,
    pub source_title: Option<String>,
    pub source_license: Option<String>,
    pub source_license_url: Option<String>,
    pub source_accessed_at: Option<String>,
    pub content_status: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListCrmBusinessReferencesQuery {
    pub q: Option<String>,
    pub city: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CrmBusinessRow {
    /// The moderation identity is the legacy/public-store UUID. Keep this stable because
    /// moderation cases, reports and verification rows reference umkm_stores(id).
    pub id: Uuid,
    pub store_id: Uuid,
    /// Canonical Business OS identity for this store, when the store is linked.
    pub canonical_business_id: Option<Uuid>,
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
    pub source_type: String,
    pub report_count: i64,
    pub latest_report_reason: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub due_at: Option<DateTime<Utc>>,
    pub verification_status: String,
    pub verification_method: Option<String>,
}

fn has_business_read_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|role| {
        matches!(
            role.trim().to_ascii_lowercase().as_str(),
            "moderator" | "admin" | "super_admin"
        )
    }) || claims.perms.iter().any(|permission| {
        permission.eq_ignore_ascii_case("business:read")
            || permission.eq_ignore_ascii_case("business:moderate")
            || permission.eq_ignore_ascii_case("content:moderate")
    })
}

fn has_business_moderation_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|role| {
        matches!(
            role.trim().to_ascii_lowercase().as_str(),
            "moderator" | "admin" | "super_admin"
        )
    }) || claims.perms.iter().any(|permission| {
        permission.eq_ignore_ascii_case("business:moderate")
            || permission.eq_ignore_ascii_case("content:moderate")
    })
}

fn has_business_case_access(claims: &AccessClaims) -> bool {
    has_business_moderation_access(claims)
        || claims
            .perms
            .iter()
            .any(|permission| permission.eq_ignore_ascii_case("business:case:manage"))
}

fn has_business_verification_access(claims: &AccessClaims) -> bool {
    has_business_moderation_access(claims)
        || claims
            .perms
            .iter()
            .any(|permission| permission.eq_ignore_ascii_case("business:verify"))
}

fn has_business_appeal_access(claims: &AccessClaims) -> bool {
    has_business_moderation_access(claims)
        || claims
            .perms
            .iter()
            .any(|permission| permission.eq_ignore_ascii_case("business:appeal:review"))
}

fn has_business_notification_access(claims: &AccessClaims) -> bool {
    has_business_read_access(claims)
        || claims
            .perms
            .iter()
            .any(|permission| permission.eq_ignore_ascii_case("business:notifications:read"))
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
        "verification_complete" => Some("verification_complete"),
        "restored_after_review" => Some("restored_after_review"),
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

    fn collect(
        value: &Value,
        urls: &mut Vec<String>,
        seen: &mut std::collections::HashSet<String>,
    ) {
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
                    || lower.starts_with("/images/")
                    || lower.starts_with("/api/forum/media/");
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
                    "cover_image_url",
                    "coverImageUrl",
                    "cover_url",
                    "coverUrl",
                    "logo",
                    "logo_url",
                    "logoUrl",
                    "banner_url",
                    "bannerUrl",
                    "store_photo_url",
                    "storePhotoUrl",
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
                    "thumbnail",
                    "thumbnail_url",
                    "thumbnailUrl",
                ] {
                    if let Some(value) = map.get(key) {
                        collect(value, urls, seen);
                    }
                }
                // Business OS stores canonical public media under nested
                // objects such as metadata.public. Recurse only into known
                // presentation containers so unrelated website/social URLs
                // are not misclassified as business photos.
                for key in [
                    "public",
                    "storefront",
                    "profile",
                    "presentation",
                    "business_media",
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
    let sources = [
        metadata.as_object(),
        metadata.get("public").and_then(Value::as_object),
        metadata.get("storefront").and_then(Value::as_object),
        metadata.get("profile").and_then(Value::as_object),
        metadata.get("presentation").and_then(Value::as_object),
        metadata.get("business_media").and_then(Value::as_object),
    ];
    for object in sources.into_iter().flatten() {
        for key in keys {
            if let Some(value) = object.get(*key).and_then(Value::as_str) {
                let value = value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

#[allow(clippy::too_many_arguments)]
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
    if metadata_text(
        metadata,
        &["category", "category_label", "business_category"],
    )
    .is_none()
    {
        missing.push("Kategori usaha".to_string());
    }
    if description
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .is_none()
    {
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
        (Some("approve") | Some("restore"), Some("resolved")) if is_active => {
            "approved".to_string()
        }
        (Some("escalate"), Some("escalated")) => "escalated".to_string(),
        (None, _) => "unreviewed".to_string(),
        _ if !is_active => "hidden".to_string(),
        _ => "under_review".to_string(),
    }
}

fn business_snapshot(row: &CrmBusinessRow) -> Value {
    json!({
        "id": row.id,
        "store_id": row.store_id,
        "canonical_business_id": row.canonical_business_id,
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
        .route(
            "/v1/crm/business-references",
            get(list_crm_business_references),
        )
        .route(
            "/v1/crm/business-references/{id}/moderate",
            post(moderate_business_reference),
        )
        .route(
            "/v1/crm/businesses/{id}/moderation/history",
            get(get_business_moderation_history),
        )
        .route("/v1/crm/businesses/{id}/moderate", post(moderate_business))
        .route(
            "/v1/crm/businesses/{id}/moderation/assign",
            post(assign_business_case),
        )
        .route(
            "/v1/crm/businesses/{id}/moderation/evidence",
            post(add_business_evidence),
        )
        .route(
            "/v1/crm/businesses/{id}/verification/review",
            post(review_business_verification),
        )
        .route(
            "/v1/crm/appeals/{appeal_id}/review",
            post(review_business_appeal),
        )
        .route("/v1/crm/notifications", get(list_crm_notifications))
        .route(
            "/v1/crm/notifications/{id}/read",
            post(mark_crm_notification_read),
        )
        .route(
            "/v1/crm/notifications/read-all",
            post(mark_all_crm_notifications_read),
        )
        .route("/v1/umkm/stores/{store_ref}/report", post(report_business))
        .route(
            "/v1/umkm/stores/{store_ref}/appeal",
            post(request_business_appeal),
        )
        .route(
            "/v1/umkm/stores/{store_ref}/verification",
            get(get_business_verification),
        )
        .route(
            "/v1/umkm/stores/{store_ref}/verification/request",
            post(request_business_verification),
        )
}

async fn list_crm_business_references(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListCrmBusinessReferencesQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_read_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "business reference moderation permission required",
        )
        .into_response();
    }

    let q = normalize_text(query.q, BUSINESS_MAX_QUERY_LEN);
    let city = normalize_text(query.city, 80);
    let status =
        normalize_text(query.status, 30).filter(|value| !value.eq_ignore_ascii_case("all"));
    let limit = query.limit.unwrap_or(50).clamp(1, BUSINESS_MAX_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = match sqlx::query(
        r#"
        SELECT
          id,
          slug,
          title,
          summary,
          cover_image,
          content_status,
          updated_at,
          metadata->>'city' AS city,
          metadata->>'address' AS address,
          metadata->>'source_url' AS source_url,
          metadata->>'source_dataset' AS source_dataset,
          metadata->>'source_title' AS source_title,
          metadata->>'source_license' AS source_license,
          metadata->>'source_license_url' AS source_license_url,
          metadata->>'source_accessed_at' AS source_accessed_at
        FROM content_items
        WHERE metadata->>'record_kind' = 'real_openstreetmap_reference'
          AND metadata->>'source_dataset' = 'openstreetmap'
          AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
          AND ($1::text IS NULL OR content_status = $1)
          AND (
            $2::text IS NULL OR
            title ILIKE '%' || $2 || '%' OR
            COALESCE(metadata->>'city','') ILIKE '%' || $2 || '%' OR
            COALESCE(metadata->>'address','') ILIKE '%' || $2 || '%'
          )
          AND ($3::text IS NULL OR COALESCE(metadata->>'city','') ILIKE '%' || $3 || '%')
        ORDER BY updated_at DESC, id ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&status)
    .bind(&q)
    .bind(&city)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("list_crm_business_references error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business references",
            )
            .into_response();
        }
    };

    let items = rows
        .into_iter()
        .map(|row| CrmBusinessReferenceRow {
            id: row.get("id"),
            slug: row.get("slug"),
            title: row.get("title"),
            summary: row.get("summary"),
            cover_image: row.get("cover_image"),
            city: row.get("city"),
            address: row.get("address"),
            source_url: row.get("source_url"),
            source_dataset: row.get("source_dataset"),
            source_title: row.get("source_title"),
            source_license: row.get("source_license"),
            source_license_url: row.get("source_license_url"),
            source_accessed_at: row.get("source_accessed_at"),
            content_status: row.get("content_status"),
            updated_at: row.get("updated_at"),
        })
        .collect::<Vec<_>>();

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

async fn moderate_business_reference(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<BusinessModerationRequest>,
) -> impl IntoResponse {
    let action = normalize_action(&payload.action);
    let Some(action) = action else {
        return err(
            StatusCode::BAD_REQUEST,
            "unsupported business reference moderation action",
        )
        .into_response();
    };
    let content_action = match action {
        "hide" => "restrict",
        "reject" => "remove",
        "request_completion" => "needs_revision",
        other => other,
    };
    let content_reason = match payload.reason_code.trim().to_ascii_lowercase().as_str() {
        "inaccurate_information" | "inaccurate" => "quality",
        "not_found" => "irrelevant",
        "duplicate_business" => "duplicate",
        "policy_violation" => "legal_violation",
        "unverifiable_business" => "unverifiable_information",
        "fraud_misleading" => "fraud_misleading",
        "privacy_personal_data" => "privacy_personal_data",
        "copyright" => "copyright",
        "quality" => "quality",
        "other" => "other",
        _ => {
            return err(
                StatusCode::BAD_REQUEST,
                "unsupported business reference moderation reason",
            )
            .into_response()
        }
    };

    moderation::moderate_content(
        State(state),
        headers,
        Path(id.to_string()),
        Json(moderation::ContentModerationRequest {
            action: content_action.to_string(),
            reason_code: content_reason.to_string(),
            reason_note: payload.reason_note,
            severity: payload.severity,
            legal_hold: payload.legal_hold,
        }),
    )
    .await
    .into_response()
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
    if !has_business_read_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business read permission required").into_response();
    }

    let q = normalize_text(query.q, BUSINESS_MAX_QUERY_LEN);
    let city = normalize_text(query.city, 80);
    let limit = query.limit.unwrap_or(50).clamp(1, BUSINESS_MAX_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = match sqlx::query(
        r#"
        SELECT
          s.id, s.id AS store_id, canonical.business_id AS canonical_business_id,
          s.owner_user_id, s.organization_id, s.name, s.slug, s.description,
          s.city, s.address, s.lat, s.lng, s.phone, s.is_active,
          s.online_order_enabled, s.offline_order_enabled, s.metadata,
          s.created_at, s.updated_at,
          c.status AS moderation_status,
          c.current_action,
          c.current_reason_code,
          c.current_reason_note,
          c.severity AS moderation_severity,
          c.missing_fields,
          c.updated_at AS moderation_updated_at,
          c.assigned_to,
          c.due_at,
          COALESCE((
            SELECT COUNT(*)::BIGINT
            FROM internal_moderation.business_reports br
            WHERE br.business_id = s.id
              AND br.status IN ('open','reviewing')
          ), 0)::BIGINT AS report_count,
          (
            SELECT br.reason_code
            FROM internal_moderation.business_reports br
            WHERE br.business_id = s.id
            ORDER BY br.created_at DESC
            LIMIT 1
          ) AS latest_report_reason,
          COALESCE((
            SELECT bv.status
            FROM internal_moderation.business_verifications bv
            WHERE bv.business_id = s.id
            ORDER BY bv.updated_at DESC
            LIMIT 1
          ), 'unverified') AS verification_status,
          (
            SELECT bv.method
            FROM internal_moderation.business_verifications bv
            WHERE bv.business_id = s.id
            ORDER BY bv.updated_at DESC
            LIMIT 1
          ) AS verification_method
        FROM umkm_stores s
        LEFT JOIN LATERAL (
          SELECT l.business_id
          FROM business_store_links l
          JOIN businesses b ON b.id = l.business_id AND b.status <> 'archived'
          WHERE l.store_id = s.id
            AND l.link_type = 'primary'
          ORDER BY b.updated_at DESC
          LIMIT 1
        ) canonical ON TRUE
        LEFT JOIN LATERAL (
          SELECT status, current_action, current_reason_code, current_reason_note,
                 severity, missing_fields, updated_at, assigned_to, due_at
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
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load businesses",
            )
            .into_response();
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
        let source_type = public_business_source_type(&metadata);
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
        let completeness = completeness_percent(&missing);
        items.push(CrmBusinessRow {
            id: row.get("id"),
            store_id: row.get("store_id"),
            canonical_business_id: row.get("canonical_business_id"),
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
            metadata: metadata.clone(),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            review_state: review,
            current_action,
            current_reason_code: row.get("current_reason_code"),
            current_reason_note: row.get("current_reason_note"),
            moderation_status,
            moderation_severity: row.get("moderation_severity"),
            missing_fields: missing,
            completeness_percent: completeness,
            image_urls: images,
            source_type,
            report_count: row.get::<i64, _>("report_count"),
            latest_report_reason: row.get::<Option<String>, _>("latest_report_reason"),
            assigned_to: row.get::<Option<Uuid>, _>("assigned_to"),
            due_at: row.get::<Option<DateTime<Utc>>, _>("due_at"),
            verification_status: row.get::<String, _>("verification_status"),
            verification_method: row.get::<Option<String>, _>("verification_method"),
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
          s.id, s.id AS store_id, canonical.business_id AS canonical_business_id,
          s.owner_user_id, s.organization_id, s.name, s.slug, s.description,
          s.city, s.address, s.lat, s.lng, s.phone, s.is_active,
          s.online_order_enabled, s.offline_order_enabled, s.metadata,
          s.created_at, s.updated_at,
          c.status AS moderation_status,
          c.current_action,
          c.current_reason_code,
          c.current_reason_note,
          c.severity AS moderation_severity,
          c.missing_fields,
          c.assigned_to,
          c.due_at,
          COALESCE((
            SELECT COUNT(*)::BIGINT
            FROM internal_moderation.business_reports br
            WHERE br.business_id = s.id
              AND br.status IN ('open','reviewing')
          ), 0)::BIGINT AS report_count,
          (
            SELECT br.reason_code
            FROM internal_moderation.business_reports br
            WHERE br.business_id = s.id
            ORDER BY br.created_at DESC
            LIMIT 1
          ) AS latest_report_reason,
          COALESCE((
            SELECT bv.status
            FROM internal_moderation.business_verifications bv
            WHERE bv.business_id = s.id
            ORDER BY bv.updated_at DESC
            LIMIT 1
          ), 'unverified') AS verification_status,
          (
            SELECT bv.method
            FROM internal_moderation.business_verifications bv
            WHERE bv.business_id = s.id
            ORDER BY bv.updated_at DESC
            LIMIT 1
          ) AS verification_method
        FROM umkm_stores s
        LEFT JOIN LATERAL (
          SELECT l.business_id
          FROM business_store_links l
          JOIN businesses b ON b.id = l.business_id AND b.status <> 'archived'
          WHERE l.store_id = s.id
            AND l.link_type = 'primary'
          ORDER BY b.updated_at DESC
          LIMIT 1
        ) canonical ON TRUE
        LEFT JOIN LATERAL (
          SELECT status, current_action, current_reason_code, current_reason_note,
                 severity, missing_fields, assigned_to, due_at
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
    let source_type = public_business_source_type(&metadata);
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
        store_id: row.get("store_id"),
        canonical_business_id: row.get("canonical_business_id"),
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
        metadata: metadata.clone(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        review_state: review_state(
            current_action.as_deref(),
            moderation_status.as_deref(),
            is_active,
        ),
        current_action,
        current_reason_code: row.get("current_reason_code"),
        current_reason_note: row.get("current_reason_note"),
        moderation_status,
        moderation_severity: row.get("moderation_severity"),
        missing_fields: missing.clone(),
        completeness_percent: completeness_percent(&missing),
        image_urls: collect_metadata_images(&metadata),
        source_type,
        report_count: row.get::<i64, _>("report_count"),
        latest_report_reason: row.get::<Option<String>, _>("latest_report_reason"),
        assigned_to: row.get::<Option<Uuid>, _>("assigned_to"),
        due_at: row.get::<Option<DateTime<Utc>>, _>("due_at"),
        verification_status: row.get::<String, _>("verification_status"),
        verification_method: row.get::<Option<String>, _>("verification_method"),
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
        return err(
            StatusCode::FORBIDDEN,
            "business moderation permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };

    let action = match normalize_action(&payload.action) {
        Some(value) => value,
        None => {
            return err(
                StatusCode::BAD_REQUEST,
                "unsupported business moderation action",
            )
            .into_response()
        }
    };
    let reason_code = match normalize_reason(&payload.reason_code) {
        Some(value) => value,
        None => {
            return err(
                StatusCode::BAD_REQUEST,
                "unsupported business moderation reason",
            )
            .into_response()
        }
    };
    let reason_note = normalize_text(payload.reason_note, BUSINESS_MAX_REASON_LEN);
    if matches!(
        action,
        "request_completion" | "hide" | "reject" | "escalate"
    ) && reason_note.is_none()
    {
        return err(
            StatusCode::BAD_REQUEST,
            "reason note is required for this action",
        )
        .into_response();
    }
    if reason_code == "other" && reason_note.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "reason note is required when reason is other",
        )
        .into_response();
    }

    let mut business = match load_business(&state, id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let missing_fields = if action == "request_completion" {
        if payload.missing_fields.is_empty() {
            business.missing_fields.clone()
        } else {
            payload
                .missing_fields
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

    if matches!(action, "approve" | "restore") {
        if business.verification_status != "verified" {
            return err(
                StatusCode::CONFLICT,
                "business verification must be completed before publication",
            )
            .into_response();
        }
        if business.image_urls.is_empty() {
            return err(
                StatusCode::CONFLICT,
                "business must have at least one verified business image before publication",
            )
            .into_response();
        }
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

    let previous_status = business
        .moderation_status
        .clone()
        .unwrap_or_else(|| "new".to_string());

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to open transaction",
            )
            .into_response()
        }
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
        if sqlx::query("UPDATE umkm_stores SET is_active = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(new_is_active)
            .execute(&mut *tx)
            .await
            .is_err()
        {
            let _ = tx.rollback().await;
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update business visibility",
            )
            .into_response();
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
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create business moderation case",
            )
            .into_response();
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
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write business moderation history",
        )
        .into_response();
    }

    if tx.commit().await.is_err() {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to commit business moderation",
        )
        .into_response();
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
    if !has_business_read_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business read permission required").into_response();
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
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business history",
            )
            .into_response();
        }
    };

    let reports = match sqlx::query(
        r#"
        SELECT id, reporter_user_id, reason_code, details, status, created_at, updated_at
        FROM internal_moderation.business_reports
        WHERE business_id = $1
        ORDER BY created_at DESC
        LIMIT 100
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
                    "reporter_user_id": row.get::<Uuid,_>("reporter_user_id"),
                    "reason_code": row.get::<String,_>("reason_code"),
                    "details": row.get::<Option<String>,_>("details"),
                    "status": row.get::<String,_>("status"),
                    "created_at": row.get::<DateTime<Utc>,_>("created_at"),
                    "updated_at": row.get::<DateTime<Utc>,_>("updated_at")
                })
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            tracing::error!("business reports history error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business reports",
            )
            .into_response();
        }
    };

    let appeals = match sqlx::query(
        r#"
        SELECT id, case_id, appellant_user_id, reason, evidence, status,
               reviewer_id, reviewer_note, created_at, updated_at, resolved_at
        FROM internal_moderation.business_appeals
        WHERE business_id = $1
        ORDER BY created_at DESC
        LIMIT 100
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
                    "appellant_user_id": row.get::<Uuid,_>("appellant_user_id"),
                    "reason": row.get::<String,_>("reason"),
                    "evidence": row.get::<Value,_>("evidence"),
                    "status": row.get::<String,_>("status"),
                    "reviewer_id": row.get::<Option<Uuid>,_>("reviewer_id"),
                    "reviewer_note": row.get::<Option<String>,_>("reviewer_note"),
                    "created_at": row.get::<DateTime<Utc>,_>("created_at"),
                    "updated_at": row.get::<DateTime<Utc>,_>("updated_at"),
                    "resolved_at": row.get::<Option<DateTime<Utc>>,_>("resolved_at")
                })
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            tracing::error!("business appeals history error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business appeals",
            )
            .into_response();
        }
    };

    let evidence = match sqlx::query(
        r#"
        SELECT e.id, e.case_id, e.added_by, e.evidence_type, e.label,
               e.source_url, e.note, e.metadata, e.created_at
        FROM internal_moderation.business_moderation_evidence e
        JOIN internal_moderation.business_moderation_cases c ON c.id=e.case_id
        WHERE c.business_id = $1
        ORDER BY e.created_at DESC
        LIMIT 200
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
                    "added_by": row.get::<Uuid,_>("added_by"),
                    "evidence_type": row.get::<String,_>("evidence_type"),
                    "label": row.get::<String,_>("label"),
                    "source_url": row.get::<Option<String>,_>("source_url"),
                    "note": row.get::<Option<String>,_>("note"),
                    "metadata": row.get::<Value,_>("metadata"),
                    "created_at": row.get::<DateTime<Utc>,_>("created_at")
                })
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            tracing::error!("business evidence history error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business evidence",
            )
            .into_response();
        }
    };

    let verification = match sqlx::query(
        r#"
        SELECT id, status, method, requested_at, reviewed_at, reviewed_by,
               review_reason, evidence, metadata, updated_at
        FROM internal_moderation.business_verifications
        WHERE business_id=$1
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(row) => row.map(|row| {
            json!({
                "id": row.get::<Uuid,_>("id"),
                "status": row.get::<String,_>("status"),
                "method": row.get::<Option<String>,_>("method"),
                "requested_at": row.get::<Option<DateTime<Utc>>,_>("requested_at"),
                "reviewed_at": row.get::<Option<DateTime<Utc>>,_>("reviewed_at"),
                "reviewed_by": row.get::<Option<Uuid>,_>("reviewed_by"),
                "review_reason": row.get::<Option<String>,_>("review_reason"),
                "evidence": row.get::<Value,_>("evidence"),
                "metadata": row.get::<Value,_>("metadata"),
                "updated_at": row.get::<DateTime<Utc>, _>("updated_at")
            })
        }),
        Err(error) => {
            tracing::error!("business verification history error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business verification",
            )
            .into_response();
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
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load business history events",
            )
            .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "cases": cases,
            "events": events,
            "reports": reports,
            "appeals": appeals,
            "evidence": evidence,
            "verification": verification
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
pub struct BusinessReportRequest {
    pub reason_code: String,
    pub details: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BusinessAppealRequest {
    pub reason: String,
    #[serde(default)]
    pub evidence: Value,
}

#[derive(Debug, Deserialize)]
pub struct BusinessVerificationRequest {
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub evidence: Value,
}

#[derive(Debug, Deserialize)]
pub struct BusinessVerificationReviewRequest {
    pub status: String,
    pub reason_note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BusinessModerationAssignmentRequest {
    pub assigned_to: Option<Uuid>,
    pub due_hours: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BusinessAppealReviewRequest {
    pub action: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BusinessModerationEvidenceRequest {
    pub evidence_type: String,
    pub label: String,
    pub source_url: Option<String>,
    pub note: Option<String>,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListCrmNotificationsQuery {
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
}

fn normalize_business_report_reason(raw: &str) -> Option<&'static str> {
    match raw
        .trim()
        .to_ascii_lowercase()
        .replace(['-', ' '], "_")
        .as_str()
    {
        "inaccurate_information" | "inaccurate" => Some("inaccurate_information"),
        "not_found" | "closed" | "no_longer_exists" => Some("not_found"),
        "duplicate_business" | "duplicate" => Some("duplicate_business"),
        "fraud_misleading" | "fraud" | "scam" => Some("fraud_misleading"),
        "policy_violation" | "policy" => Some("policy_violation"),
        "privacy_personal_data" | "privacy" => Some("privacy_personal_data"),
        "copyright" => Some("copyright"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_business_verification_method(raw: Option<&str>) -> Option<&'static str> {
    match raw
        .unwrap_or("owner_claim")
        .trim()
        .to_ascii_lowercase()
        .replace(['-', ' '], "_")
        .as_str()
    {
        "owner_claim" | "claim" => Some("owner_claim"),
        "manual" => Some("manual"),
        "document" | "documents" => Some("document"),
        "reference" => Some("reference"),
        _ => None,
    }
}

fn normalize_business_evidence_type(raw: &str) -> Option<&'static str> {
    match raw
        .trim()
        .to_ascii_lowercase()
        .replace(['-', ' '], "_")
        .as_str()
    {
        "photo" | "image" => Some("photo"),
        "document" | "file" => Some("document"),
        "url" | "link" => Some("url"),
        "note" => Some("note"),
        "screenshot" => Some("screenshot"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_business_evidence_url(value: Option<String>) -> Option<String> {
    let value = value?.trim().to_string();
    if value.is_empty() || value.len() > 1000 {
        return None;
    }
    if value.starts_with("/api/forum/media/")
        || value.starts_with("https://")
        || value.starts_with("http://")
    {
        Some(value)
    } else {
        None
    }
}

fn business_report_severity(reason_code: &str) -> &'static str {
    match reason_code {
        "fraud_misleading" | "policy_violation" | "privacy_personal_data" => "high",
        "copyright" | "duplicate_business" => "medium",
        _ => "low",
    }
}

async fn push_crm_notification(
    state: &Arc<AppState>,
    event_type: &str,
    business_id: Option<Uuid>,
    title: &str,
    message: &str,
    data: Value,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO internal_moderation.crm_notifications
          (category, event_type, business_id, title, message, data)
        VALUES ('business',$1,$2,$3,$4,$5)
        "#,
    )
    .bind(event_type)
    .bind(business_id)
    .bind(title)
    .bind(message)
    .bind(data)
    .execute(&state.db)
    .await;
    if let Err(error) = result {
        tracing::warn!("push_crm_notification error: {:?}", error);
    }
}

pub(crate) fn public_business_source_type(metadata: &Value) -> String {
    let object = match metadata.as_object() {
        Some(value) => value,
        None => return "owner_managed".to_string(),
    };
    let record_kind = object
        .get("record_kind")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    let source_dataset = object
        .get("source_dataset")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if record_kind.contains("reference")
        || !source_dataset.is_empty()
        || object.get("source_url").and_then(Value::as_str).is_some()
    {
        "reference".to_string()
    } else {
        "owner_managed".to_string()
    }
}

async fn report_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
    Json(payload): Json<BusinessReportRequest>,
) -> impl IntoResponse {
    let reporter_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(error) => {
            tracing::error!("report_business store load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business")
                .into_response();
        }
    };
    let reason_code = match normalize_business_report_reason(&payload.reason_code) {
        Some(value) => value,
        None => {
            return err(
                StatusCode::BAD_REQUEST,
                "unsupported business report reason",
            )
            .into_response()
        }
    };
    let details = normalize_text(payload.details, 4000);
    let report_id: Uuid = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_reports
          (business_id, reporter_user_id, reason_code, details, status)
        VALUES ($1,$2,$3,$4,'open')
        ON CONFLICT (business_id, reporter_user_id)
        WHERE status IN ('open','reviewing')
        DO UPDATE SET reason_code=EXCLUDED.reason_code, details=EXCLUDED.details, updated_at=NOW()
        RETURNING id
        "#,
    )
    .bind(store.id)
    .bind(reporter_id)
    .bind(reason_code)
    .bind(details.as_deref())
    .fetch_one(&state.db)
    .await
    {
        Ok(row) => row.get("id"),
        Err(error) => {
            tracing::error!("report_business insert error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to submit business report",
            )
            .into_response();
        }
    };

    let severity = business_report_severity(reason_code);
    let existing_case = match sqlx::query(
        r#"
        SELECT id
        FROM internal_moderation.business_moderation_cases
        WHERE business_id = $1
          AND status IN ('open','reviewing','awaiting_owner','escalated','appealed')
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(store.id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(row) => row.map(|value| value.get::<Uuid, _>("id")),
        Err(error) => {
            tracing::error!("report_business case lookup error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to open business review case",
            )
            .into_response();
        }
    };

    let case_id = if let Some(case_id) = existing_case {
        let _ = sqlx::query(
            r#"
            INSERT INTO internal_moderation.business_moderation_events
              (case_id, actor_id, action, reason_code, reason_note, severity,
               previous_status, new_status, missing_fields, business_snapshot)
            VALUES ($1,$2,'report_received',$3,$4,$5,'open','reviewing','[]'::jsonb,$6)
            "#,
        )
        .bind(case_id)
        .bind(reporter_id)
        .bind(reason_code)
        .bind(details.as_deref())
        .bind(severity)
        .bind(json!({"business_id": store.id, "report_id": report_id}))
        .execute(&state.db)
        .await;
        case_id
    } else {
        match sqlx::query(
            r#"
            INSERT INTO internal_moderation.business_moderation_cases
              (business_id, owner_user_id, opened_by, source, status, severity,
               current_action, current_reason_code, current_reason_note, missing_fields,
               due_at, opened_at, updated_at)
            VALUES ($1,$2,$3,'user_report','open',$4,NULL,$5,$6,'[]'::jsonb,
                    NOW() + INTERVAL '24 hours',NOW(),NOW())
            RETURNING id
            "#,
        )
        .bind(store.id)
        .bind(store.owner_user_id)
        .bind(reporter_id)
        .bind(severity)
        .bind(reason_code)
        .bind(details.as_deref())
        .fetch_one(&state.db)
        .await
        {
            Ok(row) => {
                let case_id: Uuid = row.get("id");
                let _ = sqlx::query(
                    r#"
                    INSERT INTO internal_moderation.business_moderation_events
                      (case_id, actor_id, action, reason_code, reason_note, severity,
                       previous_status, new_status, missing_fields, business_snapshot)
                    VALUES ($1,$2,'report_received',$3,$4,$5,NULL,'open','[]'::jsonb,$6)
                    "#,
                )
                .bind(case_id)
                .bind(reporter_id)
                .bind(reason_code)
                .bind(details.as_deref())
                .bind(severity)
                .bind(json!({"business_id": store.id, "report_id": report_id}))
                .execute(&state.db)
                .await;
                case_id
            }
            Err(error) => {
                tracing::error!("report_business case create error: {:?}", error);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to open business review case",
                )
                .into_response();
            }
        }
    };

    push_notification_best_effort(
        &state,
        store.owner_user_id,
        "business",
        "business_report_received",
        "Ada laporan tentang usaha",
        "Usaha Anda menerima laporan dan sedang ditinjau oleh tim Lajukan.",
        json!({"business_id": store.id, "case_id": case_id}),
    )
    .await;
    push_crm_notification(
        &state,
        "business_report_received",
        Some(store.id),
        "Laporan usaha baru",
        &format!("{} menerima laporan baru: {}.", store.name, reason_code),
        json!({"business_id": store.id, "case_id": case_id, "report_id": report_id, "reason_code": reason_code}),
    )
    .await;

    (
        StatusCode::CREATED,
        Json(json!({"report_id": report_id, "case_id": case_id, "status": "open"})),
    )
        .into_response()
}

async fn request_business_appeal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
    Json(payload): Json<BusinessAppealRequest>,
) -> impl IntoResponse {
    let appellant_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business")
                .into_response()
        }
    };
    if store.owner_user_id != appellant_id {
        return err(StatusCode::FORBIDDEN, "only the business owner can appeal").into_response();
    }
    let reason = match normalize_text(Some(payload.reason), 4000) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "appeal reason is required").into_response(),
    };
    let case = match sqlx::query(
        r#"
        SELECT id, current_action, status
        FROM internal_moderation.business_moderation_cases
        WHERE business_id = $1
          AND current_action IN ('hide','reject')
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(store.id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return err(
                StatusCode::CONFLICT,
                "there is no appealable moderation decision",
            )
            .into_response()
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation case",
            )
            .into_response()
        }
    };
    let case_id: Uuid = case.get("id");
    if case.get::<String, _>("status") != "resolved" {
        return err(
            StatusCode::CONFLICT,
            "moderation case is not ready for appeal",
        )
        .into_response();
    }

    let evidence = if payload.evidence.is_array() {
        payload.evidence
    } else {
        json!([])
    };
    let appeal_id: Uuid = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_appeals
          (case_id, business_id, appellant_user_id, reason, evidence,
           status, submitted_by_ip, submitted_user_agent)
        VALUES ($1,$2,$3,$4,$5,'pending',$6::inet,$7)
        RETURNING id
        "#,
    )
    .bind(case_id)
    .bind(store.id)
    .bind(appellant_id)
    .bind(&reason)
    .bind(evidence)
    .bind(
        headers
            .get("x-real-ip")
            .or_else(|| headers.get("x-forwarded-for"))
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.split(',').next())
            .map(str::trim),
    )
    .bind(headers.get("user-agent").and_then(|v| v.to_str().ok()))
    .fetch_one(&state.db)
    .await
    {
        Ok(row) => row.get("id"),
        Err(error) => {
            tracing::error!("request_business_appeal insert error: {:?}", error);
            return err(StatusCode::CONFLICT, "an appeal is already pending").into_response();
        }
    };

    let _ = sqlx::query(
        "UPDATE internal_moderation.business_moderation_cases SET status='appealed', updated_at=NOW() WHERE id=$1",
    )
    .bind(case_id)
    .execute(&state.db)
    .await;

    let _ = sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, missing_fields, business_snapshot)
        SELECT id,$2,'appeal_submitted','other',$3,severity,status,'appealed','[]'::jsonb,
               jsonb_build_object('business_id',$1,'appeal_id',$4)
        FROM internal_moderation.business_moderation_cases
        WHERE id=$5
        "#,
    )
    .bind(store.id)
    .bind(appellant_id)
    .bind(&reason)
    .bind(appeal_id)
    .bind(case_id)
    .execute(&state.db)
    .await;

    push_crm_notification(
        &state,
        "business_appeal_received",
        Some(store.id),
        "Banding usaha baru",
        &format!(
            "{} mengajukan banding atas keputusan penayangan.",
            store.name
        ),
        json!({"business_id": store.id, "case_id": case_id, "appeal_id": appeal_id}),
    )
    .await;

    (
        StatusCode::CREATED,
        Json(json!({"appeal_id": appeal_id, "case_id": case_id, "status": "pending"})),
    )
        .into_response()
}

async fn get_business_verification(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business")
                .into_response()
        }
    };
    if store.owner_user_id != owner_id {
        return err(
            StatusCode::FORBIDDEN,
            "only the business owner can view verification",
        )
        .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, status, method, requested_at, reviewed_at, reviewed_by, review_reason, evidence, updated_at
        FROM internal_moderation.business_verifications
        WHERE business_id=$1
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(store.id)
    .fetch_optional(&state.db)
    .await {
        Ok(value) => value,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load verification").into_response(),
    };

    match row {
        Some(row) => (
            StatusCode::OK,
            Json(json!({
                "verification": {
                    "id": row.get::<Uuid, _>("id"),
                    "status": row.get::<String, _>("status"),
                    "method": row.get::<String, _>("method"),
                    "requested_at": row.get::<DateTime<Utc>, _>("requested_at"),
                    "reviewed_at": row.get::<Option<DateTime<Utc>>, _>("reviewed_at"),
                    "reviewed_by": row.get::<Option<Uuid>, _>("reviewed_by"),
                    "review_reason": row.get::<Option<String>, _>("review_reason"),
                    "evidence": row.get::<Value, _>("evidence"),
                    "updated_at": row.get::<DateTime<Utc>, _>("updated_at")
                }
            })),
        )
            .into_response(),
        None => (StatusCode::OK, Json(json!({ "verification": null }))).into_response(),
    }
}

async fn request_business_verification(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
    Json(payload): Json<BusinessVerificationRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load business")
                .into_response()
        }
    };
    if store.owner_user_id != owner_id {
        return err(
            StatusCode::FORBIDDEN,
            "only the business owner can request verification",
        )
        .into_response();
    }
    let method = match normalize_business_verification_method(payload.method.as_deref()) {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "unsupported verification method").into_response()
        }
    };
    let evidence = if payload.evidence.is_array() {
        payload.evidence
    } else {
        json!([])
    };

    let row = sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_verifications
          (business_id, owner_user_id, status, method, requested_at, evidence, updated_at)
        VALUES ($1,$2,'pending',$3,NOW(),$4,NOW())
        ON CONFLICT (business_id)
        WHERE status IN ('unverified','pending','verified')
        DO UPDATE SET
          status='pending',
          method=EXCLUDED.method,
          requested_at=NOW(),
          reviewed_at=NULL,
          reviewed_by=NULL,
          review_reason=NULL,
          evidence=EXCLUDED.evidence,
          updated_at=NOW()
        RETURNING id
        "#,
    )
    .bind(store.id)
    .bind(owner_id)
    .bind(method)
    .bind(evidence)
    .fetch_one(&state.db)
    .await;

    let verification_id: Uuid = match row {
        Ok(row) => row.get("id"),
        Err(error) => {
            tracing::error!("request_business_verification error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to request verification",
            )
            .into_response();
        }
    };

    push_crm_notification(
        &state,
        "business_verification_requested",
        Some(store.id),
        "Permintaan verifikasi usaha",
        &format!("{} meminta verifikasi profil usaha.", store.name),
        json!({"business_id": store.id, "verification_id": verification_id, "method": method}),
    )
    .await;

    (
        StatusCode::CREATED,
        Json(json!({"verification_id": verification_id, "status": "pending"})),
    )
        .into_response()
}

async fn review_business_verification(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<BusinessVerificationReviewRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_verification_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "business verification permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let status = match payload.status.trim().to_ascii_lowercase().as_str() {
        "verified" => "verified",
        "rejected" => "rejected",
        _ => {
            return err(
                StatusCode::BAD_REQUEST,
                "verification status must be verified or rejected",
            )
            .into_response()
        }
    };
    let note = normalize_text(payload.reason_note, 4000);
    if note.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "verification review note is required",
        )
        .into_response();
    }

    if status == "verified" {
        let business = match load_business(&state, id).await {
            Ok(value) => value,
            Err(response) => return response.into_response(),
        };
        if !business.missing_fields.is_empty() {
            return err(
                StatusCode::CONFLICT,
                "business profile must be complete before verification",
            )
            .into_response();
        }
        if business.image_urls.is_empty() {
            return err(
                StatusCode::CONFLICT,
                "at least one business image is required before verification",
            )
            .into_response();
        }
    }

    let row = match sqlx::query(
        r#"
        SELECT id, business_id, owner_user_id, status
        FROM internal_moderation.business_verifications
        WHERE business_id=$1
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return err(StatusCode::NOT_FOUND, "verification request not found").into_response()
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load verification",
            )
            .into_response()
        }
    };
    if row.get::<String, _>("status") != "pending" {
        return err(StatusCode::CONFLICT, "verification request is not pending").into_response();
    }
    let verification_id: Uuid = row.get("id");
    let owner_id: Uuid = row.get("owner_user_id");

    if sqlx::query(
        r#"
        UPDATE internal_moderation.business_verifications
        SET status=$2, reviewed_at=NOW(), reviewed_by=$3, review_reason=$4, updated_at=NOW()
        WHERE id=$1
        "#,
    )
    .bind(verification_id)
    .bind(status)
    .bind(actor_id)
    .bind(note.as_deref())
    .execute(&state.db)
    .await
    .is_err()
    {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to save verification decision",
        )
        .into_response();
    }

    push_notification_best_effort(
        &state,
        owner_id,
        "business",
        "business_verification_reviewed",
        if status == "verified" { "Usaha terverifikasi" } else { "Verifikasi usaha belum disetujui" },
        if status == "verified" {
            "Profil usaha Anda sudah diverifikasi oleh tim Lajukan."
        } else {
            "Permintaan verifikasi usaha belum disetujui. Buka detail untuk melihat alasan dan melengkapi bukti."
        },
        json!({"business_id": id, "verification_id": verification_id, "status": status, "reason_note": note}),
    )
    .await;

    push_crm_notification(
        &state,
        "business_verification_reviewed",
        Some(id),
        "Verifikasi usaha diproses",
        &format!("Keputusan verifikasi usaha: {}.", status),
        json!({"business_id": id, "verification_id": verification_id, "status": status}),
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({"verification_id": verification_id, "status": status, "reason_note": note})),
    )
        .into_response()
}

async fn assign_business_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<BusinessModerationAssignmentRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_case_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "business case management permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let current_due_at: Option<DateTime<Utc>> = match sqlx::query(
        r#"
        SELECT due_at
        FROM internal_moderation.business_moderation_cases
        WHERE business_id=$1
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(row) => row.and_then(|value| value.get::<Option<DateTime<Utc>>, _>("due_at")),
        Err(error) => {
            tracing::error!("assign_business_case current SLA lookup error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation SLA",
            )
            .into_response();
        }
    };
    let due_at = match (payload.assigned_to, payload.due_hours, current_due_at) {
        (None, _, _) => None,
        (Some(_), Some(hours), _) => {
            Some(Utc::now() + chrono::Duration::hours(hours.clamp(1, 168)))
        }
        (Some(_), None, existing) => {
            existing.or_else(|| Some(Utc::now() + chrono::Duration::hours(24)))
        }
    };

    let updated = sqlx::query(
        r#"
        UPDATE internal_moderation.business_moderation_cases
        SET assigned_to=$2, due_at=$3, updated_at=NOW()
        WHERE id = (
          SELECT id
          FROM internal_moderation.business_moderation_cases
          WHERE business_id=$1
          ORDER BY updated_at DESC
          LIMIT 1
        )
        RETURNING id, status, assigned_to, due_at
        "#,
    )
    .bind(id)
    .bind(payload.assigned_to)
    .bind(due_at)
    .fetch_optional(&state.db)
    .await;

    let row = match updated {
        Ok(Some(row)) => row,
        Ok(None) => {
            return err(StatusCode::NOT_FOUND, "business moderation case not found").into_response()
        }
        Err(error) => {
            tracing::error!("assign_business_case error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to assign moderation case",
            )
            .into_response();
        }
    };
    let case_id: Uuid = row.get("id");

    let _ = sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, missing_fields, business_snapshot)
        SELECT id,$2,'assigned','other',$3,severity,status,status,'[]'::jsonb,
               jsonb_build_object('business_id',$1,'assigned_to',$4,'due_at',$5)
        FROM internal_moderation.business_moderation_cases
        WHERE id=$6
        "#,
    )
    .bind(id)
    .bind(actor_id)
    .bind(if payload.assigned_to.is_some() {
        "Case assigned by CRM"
    } else {
        "Case unassigned by CRM"
    })
    .bind(payload.assigned_to)
    .bind(due_at)
    .bind(case_id)
    .execute(&state.db)
    .await;

    push_crm_notification(
        &state,
        "business_case_assigned",
        Some(id),
        "Tugas moderasi diperbarui",
        "Assignment dan SLA kasus usaha berhasil diperbarui.",
        json!({"business_id": id, "case_id": case_id, "assigned_to": payload.assigned_to, "due_at": due_at}),
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({
            "case_id": case_id,
            "status": row.get::<String,_>("status"),
            "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
            "due_at": row.get::<Option<DateTime<Utc>>,_>("due_at")
        })),
    )
        .into_response()
}

async fn add_business_evidence(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<BusinessModerationEvidenceRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_case_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "business case management permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let evidence_type = match normalize_business_evidence_type(&payload.evidence_type) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "unsupported evidence type").into_response(),
    };
    let label = match normalize_text(Some(payload.label), 120) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "evidence label is required").into_response(),
    };
    let source_url = normalize_business_evidence_url(payload.source_url);
    if source_url.is_none() && evidence_type != "note" {
        return err(StatusCode::BAD_REQUEST, "evidence source URL is required").into_response();
    }
    let note = normalize_text(payload.note, 4000);
    let metadata = if payload.metadata.is_object() {
        payload.metadata
    } else {
        json!({})
    };

    let case_id: Uuid = match sqlx::query(
        r#"
        SELECT id
        FROM internal_moderation.business_moderation_cases
        WHERE business_id=$1
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row.get("id"),
        Ok(None) => {
            return err(StatusCode::NOT_FOUND, "business moderation case not found").into_response()
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation case",
            )
            .into_response()
        }
    };

    let evidence_id: Uuid = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_evidence
          (case_id, added_by, evidence_type, label, source_url, note, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING id
        "#,
    )
    .bind(case_id)
    .bind(actor_id)
    .bind(evidence_type)
    .bind(label)
    .bind(source_url.as_deref())
    .bind(note.as_deref())
    .bind(metadata)
    .fetch_one(&state.db)
    .await
    {
        Ok(row) => row.get("id"),
        Err(error) => {
            tracing::error!("add_business_evidence error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to save evidence")
                .into_response();
        }
    };

    push_crm_notification(
        &state,
        "business_evidence_added",
        Some(id),
        "Bukti kasus diperbarui",
        "Bukti baru ditambahkan ke riwayat moderasi usaha.",
        json!({"business_id": id, "case_id": case_id, "evidence_id": evidence_id}),
    )
    .await;

    (
        StatusCode::CREATED,
        Json(json!({"evidence_id": evidence_id, "case_id": case_id})),
    )
        .into_response()
}

async fn list_crm_notifications(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListCrmNotificationsQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_notification_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "crm notification permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let unread_only = query.unread_only.unwrap_or(false);
    let rows = sqlx::query(
        r#"
        SELECT n.id, n.category, n.event_type, n.business_id, n.title, n.message, n.data,
               NOT EXISTS (
                 SELECT 1
                 FROM internal_moderation.crm_notification_reads r
                 WHERE r.notification_id = n.id
                   AND r.user_id = $3
               ) AS is_read,
               n.read_by, n.read_at, n.created_at
        FROM internal_moderation.crm_notifications n
        WHERE ($1::bool = FALSE OR NOT EXISTS (
                 SELECT 1
                 FROM internal_moderation.crm_notification_reads r
                 WHERE r.notification_id = n.id
                   AND r.user_id = $3
               ))
        ORDER BY n.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(unread_only)
    .bind(limit)
    .bind(actor_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => (
            StatusCode::OK,
            Json(json!({
                "items": rows.into_iter().map(|row| json!({
                    "id": row.get::<Uuid,_>("id"),
                    "category": row.get::<String,_>("category"),
                    "event_type": row.get::<String,_>("event_type"),
                    "business_id": row.get::<Option<Uuid>,_>("business_id"),
                    "title": row.get::<String,_>("title"),
                    "message": row.get::<String,_>("message"),
                    "data": row.get::<Value,_>("data"),
                    "is_read": row.get::<bool,_>("is_read"),
                    "read_by": row.get::<Option<Uuid>,_>("read_by"),
                    "read_at": row.get::<Option<DateTime<Utc>>,_>("read_at"),
                    "created_at": row.get::<DateTime<Utc>,_>("created_at")
                })).collect::<Vec<_>>()
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("list_crm_notifications error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load CRM notifications",
            )
            .into_response()
        }
    }
}

async fn mark_crm_notification_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_notification_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "crm notification permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let updated = sqlx::query(
        r#"
        INSERT INTO internal_moderation.crm_notification_reads
          (notification_id, user_id, read_at)
        VALUES ($1,$2,NOW())
        ON CONFLICT (notification_id, user_id)
        DO UPDATE SET read_at=EXCLUDED.read_at
        RETURNING notification_id AS id, TRUE AS is_read, read_at
        "#,
    )
    .bind(id)
    .bind(actor_id)
    .fetch_optional(&state.db)
    .await;
    match updated {
        Ok(Some(row)) => (
            StatusCode::OK,
            Json(json!({
                "id": row.get::<Uuid,_>("id"),
                "is_read": row.get::<bool,_>("is_read"),
                "read_at": row.get::<Option<DateTime<Utc>>,_>("read_at")
            })),
        )
            .into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "crm notification not found").into_response(),
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to mark CRM notification read",
        )
        .into_response(),
    }
}

async fn mark_all_crm_notifications_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_notification_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "crm notification permission required",
        )
        .into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    match sqlx::query(
        r#"
        INSERT INTO internal_moderation.crm_notification_reads
          (notification_id, user_id, read_at)
        SELECT n.id, $1, NOW()
        FROM internal_moderation.crm_notifications n
        WHERE NOT EXISTS (
          SELECT 1
          FROM internal_moderation.crm_notification_reads r
          WHERE r.notification_id = n.id
            AND r.user_id = $1
        )
        "#,
    )
    .bind(actor_id)
    .execute(&state.db)
    .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(json!({"updated_count": result.rows_affected()})),
        )
            .into_response(),
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to mark CRM notifications read",
        )
        .into_response(),
    }
}
async fn review_business_appeal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(appeal_id): Path<Uuid>,
    Json(payload): Json<BusinessAppealReviewRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_business_appeal_access(&claims) {
        return err(StatusCode::FORBIDDEN, "business appeal permission required").into_response();
    }
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };
    let action = payload.action.trim().to_ascii_lowercase();
    let status = match action.as_str() {
        "overturn" => "overturned",
        "uphold" => "upheld",
        "needs_information" => "needs_information",
        _ => return err(StatusCode::BAD_REQUEST, "unsupported appeal decision").into_response(),
    };
    let note = normalize_text(payload.note, 4000);
    if status != "needs_information" && note.is_none() {
        return err(StatusCode::BAD_REQUEST, "appeal decision note is required").into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT a.id, a.case_id, a.business_id, a.appellant_user_id, a.status,
               s.name, s.owner_user_id
        FROM internal_moderation.business_appeals a
        JOIN umkm_stores s ON s.id=a.business_id
        WHERE a.id=$1
        "#,
    )
    .bind(appeal_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "appeal not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load appeal").into_response()
        }
    };
    if !matches!(
        row.get::<String, _>("status").as_str(),
        "pending" | "in_review"
    ) {
        return err(StatusCode::CONFLICT, "appeal is already resolved").into_response();
    }
    let case_id: Uuid = row.get("case_id");
    let business_id: Uuid = row.get("business_id");
    let owner_id: Uuid = row.get("owner_user_id");

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to open appeal transaction",
            )
            .into_response()
        }
    };

    let new_active = status == "overturned";
    if sqlx::query(
        r#"
        UPDATE internal_moderation.business_appeals
        SET status=$2, reviewer_id=$3, reviewer_note=$4, updated_at=NOW(), resolved_at=CASE WHEN $2 <> 'needs_information' THEN NOW() ELSE NULL END
        WHERE id=$1
        "#,
    )
    .bind(appeal_id)
    .bind(status)
    .bind(actor_id)
    .bind(note.as_deref())
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to save appeal decision").into_response();
    }

    if status == "needs_information" {
        if sqlx::query("UPDATE internal_moderation.business_moderation_cases SET status='reviewing', updated_at=NOW() WHERE id=$1")
            .bind(case_id)
            .execute(&mut *tx)
            .await
            .is_err()
        {
            let _ = tx.rollback().await;
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to reopen business review").into_response();
        }
    } else {
        if sqlx::query("UPDATE umkm_stores SET is_active=$2, updated_at=NOW() WHERE id=$1")
            .bind(business_id)
            .bind(new_active)
            .execute(&mut *tx)
            .await
            .is_err()
        {
            let _ = tx.rollback().await;
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to apply appeal decision",
            )
            .into_response();
        }
        if sqlx::query("UPDATE internal_moderation.business_moderation_cases SET status='resolved', updated_at=NOW(), resolved_at=NOW() WHERE id=$1")
            .bind(case_id)
            .execute(&mut *tx)
            .await
            .is_err()
        {
            let _ = tx.rollback().await;
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to resolve business case").into_response();
        }
    }

    if sqlx::query(
        r#"
        INSERT INTO internal_moderation.business_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, missing_fields, business_snapshot)
        SELECT c.id,$2,$3,'other',$4,c.severity,c.status,c.status,'[]'::jsonb,
               jsonb_build_object('business_id',$1,'appeal_id',$5)
        FROM internal_moderation.business_moderation_cases c
        WHERE c.id=$6
        "#,
    )
    .bind(business_id)
    .bind(actor_id)
    .bind(format!("appeal_{}", action))
    .bind(note.as_deref())
    .bind(appeal_id)
    .bind(case_id)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write appeal history",
        )
        .into_response();
    }

    if tx.commit().await.is_err() {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to commit appeal decision",
        )
        .into_response();
    }

    push_notification_best_effort(
        &state,
        owner_id,
        "business",
        "business_appeal_reviewed",
        if status == "overturned" { "Banding usaha diterima" } else if status == "upheld" { "Banding usaha selesai" } else { "Bukti tambahan diperlukan" },
        if status == "overturned" {
            "Keputusan sebelumnya dibatalkan dan usaha dapat ditampilkan kembali."
        } else if status == "upheld" {
            "Banding telah ditinjau dan keputusan sebelumnya tetap berlaku."
        } else {
            "Tim Lajukan membutuhkan informasi atau bukti tambahan untuk memproses banding Anda."
        },
        json!({"business_id": business_id, "appeal_id": appeal_id, "status": status, "reason_note": note}),
    )
    .await;
    push_crm_notification(
        &state,
        "business_appeal_reviewed",
        Some(business_id),
        "Banding usaha diproses",
        &format!(
            "Banding usaha untuk {} diproses: {}.",
            row.get::<String, _>("name"),
            status
        ),
        json!({"business_id": business_id, "appeal_id": appeal_id, "status": status}),
    )
    .await;

    (
        StatusCode::OK,
        Json(json!({"appeal_id": appeal_id, "status": status, "reason_note": note})),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moderation_reads_canonical_public_category_and_business_media() {
        let metadata = json!({
            "public": {
                "category": "Minuman",
                "logo_url": "/api/forum/media/lajukan-juice.webp",
                "banner_url": "/api/forum/media/lajukan-juice-banner.webp",
            }
        });

        assert_eq!(
            metadata_text(&metadata, &["category", "category_label"]),
            Some("Minuman".to_string())
        );
        assert_eq!(
            collect_metadata_images(&metadata),
            vec![
                "/api/forum/media/lajukan-juice.webp".to_string(),
                "/api/forum/media/lajukan-juice-banner.webp".to_string(),
            ]
        );
    }
}
