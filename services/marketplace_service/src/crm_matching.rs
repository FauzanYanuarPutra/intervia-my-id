//! Deterministic Lajukan Match runtime.
//!
//! This module turns the existing CRM matching foundation tables into a real,
//! admin-reviewed workflow. It intentionally starts with rule-based extraction
//! and deterministic candidate scoring so the first production path does not
//! depend on an LLM or vector database.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::{collections::HashSet, sync::Arc};
use uuid::Uuid;

use super::{auth_claims_from_headers, has_agent_access, push_notification_best_effort, AppState};

const MATCHING_SCHEMA_VERSION: &str = "lajukan-match-schema-v1";
const MATCHING_SCORE_VERSION: &str = "lajukan-match-score-v1";
const MAX_REQUIREMENTS: i64 = 100;
const MAX_CANDIDATES: i64 = 100;
const TOP_RESULTS: usize = 25;

#[derive(Debug, Deserialize, Default)]
pub struct RequirementQuery {
    pub q: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct MatchRequest {
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct CandidateReviewRequest {
    pub admin_status: Option<String>,
    pub admin_reason: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ConnectionRequest {
    pub requirement_review_id: Uuid,
    pub matching_run_id: Option<Uuid>,
    pub matching_candidate_id: Option<Uuid>,
    pub requester_user_id: Option<Uuid>,
    pub provider_user_id: Option<Uuid>,
    pub provider_business_id: Option<Uuid>,
    pub provider_entity_type: String,
    pub provider_entity_id: String,
    pub channel: Option<String>,
    pub notes: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ConnectionPatch {
    pub status: Option<String>,
    pub outcome_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct MatchingFeedbackRequest {
    pub connection_id: Option<Uuid>,
    pub matching_candidate_id: Option<Uuid>,
    pub requirement_review_id: Option<Uuid>,
    pub feedback_source: String,
    pub feedback_type: String,
    pub reason_code: Option<String>,
    pub note: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct RequirementReview {
    id: Uuid,
    source_type: String,
    source_id: Option<String>,
    requester_user_id: Option<Uuid>,
    status: String,
    priority: String,
    assigned_to: Option<Uuid>,
    original_text_snapshot: Option<String>,
    original_metadata_snapshot: Value,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct RequirementItem {
    id: Uuid,
    source_id: Uuid,
    requester_user_id: Option<Uuid>,
    title: String,
    summary: Option<String>,
    body: String,
    category: Option<String>,
    metadata: Value,
    review_id: Option<Uuid>,
    review_status: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CandidateItem {
    id: Uuid,
    owner_id: Uuid,
    title: String,
    summary: Option<String>,
    body: String,
    content_type: String,
    category: Option<String>,
    tags: Option<Vec<String>>,
    price_cents: Option<i64>,
    rating: Option<f32>,
    review_count: Option<i32>,
    cover_image: Option<String>,
    metadata: Value,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct MatchingRunRow {
    id: Uuid,
    requirement_review_id: Uuid,
    extraction_id: Option<Uuid>,
    status: String,
    scoring_version: String,
    retrieval_strategy: String,
    candidate_count: i32,
    top_score: Option<f64>,
    error_code: Option<String>,
    created_at: DateTime<Utc>,
    started_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
}

fn unauthorized() -> axum::response::Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "unauthorized"})),
    )
        .into_response()
}

fn forbidden() -> axum::response::Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({"error": "agent role required"})),
    )
        .into_response()
}

#[allow(clippy::result_large_err)]
fn require_agent(
    headers: &HeaderMap,
    state: &Arc<AppState>,
) -> Result<Uuid, axum::response::Response> {
    let claims = auth_claims_from_headers(headers, &state.jwt_secret).ok_or_else(unauthorized)?;
    if !has_agent_access(&claims) {
        return Err(forbidden());
    }
    Uuid::parse_str(&claims.sub).map_err(|_| unauthorized())
}

fn text(value: impl AsRef<str>) -> String {
    value
        .as_ref()
        .trim()
        .to_ascii_lowercase()
        .chars()
        .filter(|ch| !ch.is_control())
        .collect()
}

fn json_text(metadata: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = metadata.get(*key) {
            if let Some(value) = value.as_str() {
                let value = value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
            if let Some(value) = value.as_i64() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn json_f64(metadata: &Value, keys: &[&str]) -> Option<f64> {
    for key in keys {
        let value = metadata.get(*key)?;
        if let Some(value) = value.as_f64() {
            return Some(value);
        }
        if let Some(value) = value.as_i64() {
            return Some(value as f64);
        }
        if let Some(value) = value.as_str() {
            if let Ok(value) = value.trim().parse::<f64>() {
                return Some(value);
            }
        }
    }
    None
}

fn tokens(input: &str) -> HashSet<String> {
    const STOPWORDS: &[&str] = &[
        "dan", "yang", "untuk", "dari", "dengan", "butuh", "ingin", "cari", "mau", "tolong",
        "saya", "kami", "agar", "atau", "di", "ke", "yang", "the", "and", "for",
    ];

    input
        .split(|ch: char| !ch.is_alphanumeric())
        .map(text)
        .filter(|token| token.len() >= 3 && !STOPWORDS.contains(&token.as_str()))
        .take(40)
        .collect()
}

fn city_from(metadata: &Value) -> Option<String> {
    json_text(
        metadata,
        &["city", "location_text", "location", "service_area"],
    )
    .map(text)
}

fn category_from(metadata: &Value) -> Option<String> {
    json_text(
        metadata,
        &[
            "marketplace_category_slug",
            "marketplace_category",
            "create_category",
            "category",
            "discovery_category",
        ],
    )
    .map(text)
}
fn metadata_terms(metadata: &Value, keys: &[&str]) -> String {
    let mut values = Vec::<String>::new();

    for key in keys {
        match metadata.get(*key) {
            Some(Value::String(value)) if !value.trim().is_empty() => values.push(value.clone()),
            Some(Value::Array(items)) => {
                values.extend(
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .filter(|value| !value.trim().is_empty())
                        .map(ToOwned::to_owned),
                );
            }
            _ => {}
        }
    }

    values.join(" ")
}


fn coordinate_from(metadata: &Value) -> Option<(f64, f64)> {
    let lat = json_f64(metadata, &["latitude", "lat", "location_lat"])?;
    let lng = json_f64(metadata, &["longitude", "lng", "lon", "location_lng"])?;
    if !lat.is_finite()
        || !lng.is_finite()
        || !(-90.0..=90.0).contains(&lat)
        || !(-180.0..=180.0).contains(&lng)
    {
        return None;
    }
    Some((lat, lng))
}

fn haversine_km(a: (f64, f64), b: (f64, f64)) -> f64 {
    let radius_km = 6_371.0;
    let lat1 = a.0.to_radians();
    let lat2 = b.0.to_radians();
    let dlat = (b.0 - a.0).to_radians();
    let dlng = (b.1 - a.1).to_radians();
    let h = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlng / 2.0).sin().powi(2);
    2.0 * radius_km * h.sqrt().asin()
}

fn budget(metadata: &Value) -> (Option<i64>, Option<i64>) {
    (
        json_f64(metadata, &["budget_min", "min_budget"]).map(|value| value.round() as i64),
        json_f64(metadata, &["budget_max", "max_budget"]).map(|value| value.round() as i64),
    )
}

fn availability_score(metadata: &Value) -> f64 {
    let status = json_text(
        metadata,
        &["availability", "stock_status", "availability_status"],
    )
    .map(text);
    match status.as_deref() {
        Some("available") | Some("ready") | Some("ready_stock") | Some("tersedia") => 10.0,
        Some("limited") | Some("terbatas") => 6.0,
        Some("unavailable") | Some("habis") | Some("out_of_stock") => 0.0,
        _ => 5.0,
    }
}

fn trust_score(candidate: &CandidateItem) -> f64 {
    let verified = json_text(
        &candidate.metadata,
        &["verification_status", "verified_status", "trust_status"],
    )
    .map(|v| matches!(text(v).as_str(), "verified" | "trusted" | "approved"))
    .unwrap_or(false);

    let rating = f64::from(candidate.rating.unwrap_or(0.0)).clamp(0.0, 5.0);
    let reviews = candidate.review_count.unwrap_or(0).max(0) as f64;
    let rating_component = (rating / 5.0) * 6.0;
    let verification_component = if verified { 4.0 } else { 1.0 };
    let volume_component = if reviews >= 50.0 {
        1.0
    } else if reviews >= 10.0 {
        0.5
    } else {
        0.0
    };
    (rating_component + verification_component + volume_component).min(10.0)
}

fn listing_quality_score(candidate: &CandidateItem) -> f64 {
    let mut score = 0.0;
    if !candidate.title.trim().is_empty() {
        score += 1.0;
    }
    if candidate
        .summary
        .as_deref()
        .unwrap_or_default()
        .trim()
        .len()
        >= 30
    {
        score += 1.0;
    }
    if candidate.body.trim().len() >= 80 {
        score += 1.0;
    }
    if !candidate
        .cover_image
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        score += 1.0;
    }
    if candidate
        .tags
        .as_ref()
        .map(|v| !v.is_empty())
        .unwrap_or(false)
    {
        score += 1.0;
    }
    score
}

fn freshness_score(updated_at: DateTime<Utc>) -> f64 {
    let age = Utc::now() - updated_at;
    if age <= Duration::days(30) {
        5.0
    } else if age <= Duration::days(90) {
        3.0
    } else {
        1.0
    }
}

#[derive(Debug)]
struct CandidateScore {
    total: f64,
    similarity: f64,
    worth: f64,
    breakdown: Value,
    matched_fields: Vec<String>,
    missing_fields: Vec<String>,
    reasons: Vec<String>,
    warnings: Vec<String>,
}

fn score_candidate(requirement: &RequirementItem, candidate: &CandidateItem) -> CandidateScore {
    let requirement_text = format!(
        "{} {} {} {} {}",
        requirement.title,
        requirement.summary.as_deref().unwrap_or_default(),
        requirement.body,
        requirement.category.as_deref().unwrap_or_default(),
        metadata_terms(
            &requirement.metadata,
            &[
                "subcategory",
                "sub_category",
                "keywords",
                "search_keywords",
                "product_name",
                "service_name",
                "attributes",
            ],
        ),
    );
    let candidate_text = format!(
        "{} {} {} {} {} {}",
        candidate.title,
        candidate.summary.as_deref().unwrap_or_default(),
        candidate.body,
        candidate.category.as_deref().unwrap_or_default(),
        candidate
            .tags
            .as_ref()
            .map(|v| v.join(" "))
            .unwrap_or_default(),
        metadata_terms(
            &candidate.metadata,
            &[
                "subcategory",
                "sub_category",
                "keywords",
                "search_keywords",
                "product_name",
                "service_name",
                "attributes",
            ],
        ),
    );

    let need_tokens = tokens(&requirement_text);
    let candidate_tokens = tokens(&candidate_text);
    let overlap = need_tokens.intersection(&candidate_tokens).count();
    let need_recall = if need_tokens.is_empty() {
        0.0
    } else {
        overlap as f64 / need_tokens.len() as f64
    };
    let candidate_precision = if candidate_tokens.is_empty() {
        0.0
    } else {
        overlap as f64 / candidate_tokens.len() as f64
    };
    let token_f1 = if need_recall + candidate_precision > 0.0 {
        2.0 * need_recall * candidate_precision / (need_recall + candidate_precision)
    } else {
        0.0
    };
    let title_need_tokens = tokens(&requirement.title);
    let title_candidate_tokens = tokens(&candidate.title);
    let title_overlap = title_need_tokens
        .intersection(&title_candidate_tokens)
        .count();
    let title_similarity = if title_need_tokens.is_empty() {
        0.0
    } else {
        title_overlap as f64 / title_need_tokens.len() as f64
    };
    let similarity = ((token_f1 * 0.65 + title_similarity * 0.35) * 100.0).clamp(0.0, 100.0);
    let keyword_fit = (similarity * 0.25).min(25.0);

    let requirement_category =
        category_from(&requirement.metadata).or_else(|| requirement.category.clone().map(text));
    let candidate_category =
        category_from(&candidate.metadata).or_else(|| candidate.category.clone().map(text));
    let category_fit = match (requirement_category.clone(), candidate_category.clone()) {
        (Some(req), Some(candidate)) if req == candidate => 20.0,
        (Some(req), Some(candidate)) if req.contains(&candidate) || candidate.contains(&req) => {
            14.0
        }
        (Some(_), Some(_)) => 5.0,
        _ => 0.0,
    };

    let req_city = city_from(&requirement.metadata);
    let cand_city = city_from(&candidate.metadata);
    let req_coord = coordinate_from(&requirement.metadata);
    let cand_coord = coordinate_from(&candidate.metadata);
    let distance_km = req_coord.zip(cand_coord).map(|(a, b)| haversine_km(a, b));
    let location_fit = if let Some(distance) = distance_km {
        if distance <= 10.0 {
            15.0
        } else if distance <= 25.0 {
            12.0
        } else if distance <= 50.0 {
            8.0
        } else {
            2.0
        }
    } else if req_city.is_some() && req_city == cand_city {
        12.0
    } else if req_city.is_some() && cand_city.is_some() {
        3.0
    } else {
        0.0
    };

    let (budget_min, budget_max) = budget(&requirement.metadata);
    let price_fit = match (budget_min, budget_max, candidate.price_cents) {
        (Some(min), Some(max), Some(price)) if price >= min && price <= max => 10.0,
        (None, Some(max), Some(price)) if price <= max => 10.0,
        (Some(min), None, Some(price)) if price >= min => 10.0,
        (Some(min), Some(max), Some(price)) => {
            let distance = if price < min {
                min - price
            } else {
                price - max
            };
            let bound = (max - min).max(1);
            if distance as f64 <= bound as f64 {
                5.0
            } else {
                0.0
            }
        }
        _ => 5.0,
    };

    let trust = trust_score(candidate);
    let availability = availability_score(&candidate.metadata);
    let quality = listing_quality_score(candidate);
    let freshness = freshness_score(candidate.updated_at);

    let total = (keyword_fit
        + category_fit
        + location_fit
        + price_fit
        + trust
        + availability
        + quality
        + freshness)
        .clamp(0.0, 100.0);

    let price_value = match (candidate.price_cents, budget_min, budget_max) {
        (Some(price), Some(min), Some(max)) if max > min => {
            if price < min {
                0.65
            } else if price <= max {
                let span = (max - min).max(1) as f64;
                let position = ((price - min) as f64 / span).clamp(0.0, 1.0);
                1.0 - position * 0.25
            } else {
                0.35
            }
        }
        (Some(price), _, Some(max)) if max > 0 => {
            (1.0 - (price as f64 / max as f64).clamp(0.0, 1.0) * 0.35).max(0.35)
        }
        (Some(_), _, _) => 0.55,
        _ => 0.50,
    };
    let value_index = (similarity * 0.40)
        + (price_value * 100.0 * 0.20)
        + (trust * 10.0) * 0.20
        + (availability * 10.0) * 0.10
        + (quality * 20.0) * 0.10;
    let worth = (total * 0.70 + value_index * 0.30).clamp(0.0, 100.0);

    let mut matched_fields = Vec::new();
    let mut missing_fields = Vec::new();
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if overlap > 0 {
        matched_fields.push(format!("{} kata kunci", overlap));
        reasons.push(format!(
            "Kemiripan isi terdeteksi sekitar {:.0}%.",
            similarity
        ));
        reasons.push(
            "Konten kandidat memiliki istilah dan konteks yang selaras dengan kebutuhan."
                .to_string(),
        );
    } else {
        missing_fields.push("keyword_fit".to_string());
        warnings.push("Tidak ada kecocokan kata kunci yang kuat.".to_string());
    }
    if category_fit >= 14.0 {
        matched_fields.push("category".to_string());
        reasons.push("Kategori listing sejalan dengan kategori kebutuhan.".to_string());
    } else if requirement_category.is_some() {
        warnings.push("Kategori belum cocok kuat.".to_string());
    }
    if let Some(distance) = distance_km {
        reasons.push(format!("Perkiraan jarak {:.1} km.", distance));
    } else if req_city.is_some() && req_city == cand_city {
        reasons.push("Kota kebutuhan dan penyedia sama.".to_string());
    } else if req_city.is_some() {
        warnings.push("Lokasi belum cukup presisi untuk menghitung jarak.".to_string());
    } else {
        missing_fields.push("location".to_string());
    }
    if candidate.price_cents.is_some() && (budget_min.is_some() || budget_max.is_some()) {
        matched_fields.push("price_budget".to_string());
    } else {
        missing_fields.push("price_or_budget".to_string());
    }
    if candidate.review_count.unwrap_or(0) > 0 || candidate.rating.unwrap_or(0.0) > 0.0 {
        matched_fields.push("trust".to_string());
    } else {
        warnings.push("Belum ada bukti review/rating yang cukup.".to_string());
    }

    CandidateScore {
        total,
        similarity,
        worth,
        breakdown: json!({
            "keyword_category_fit": (keyword_fit + category_fit).round(),
            "need_item_fit": keyword_fit.round(),
            "similarity": similarity.round(),
            "worth": worth.round(),
            "category_fit": category_fit.round(),
            "location_fit": location_fit.round(),
            "price_budget_fit": price_fit.round(),
            "trust_verification": trust.round(),
            "availability_response": availability.round(),
            "listing_quality": quality.round(),
            "freshness": freshness.round(),
        }),
        matched_fields,
        missing_fields,
        reasons,
        warnings,
    }
}

async fn ensure_review(
    db: &sqlx::PgPool,
    content_id: Uuid,
    actor_user_id: Uuid,
) -> Result<RequirementReview, sqlx::Error> {
    if let Some(review) = sqlx::query_as::<_, RequirementReview>(
        r#"
        SELECT
            id, source_type, source_id, requester_user_id, status, priority, assigned_to,
            original_text_snapshot, original_metadata_snapshot
        FROM crm_requirement_reviews
        WHERE source_type = 'content_item' AND source_id = $1
        LIMIT 1
        "#,
    )
    .bind(content_id.to_string())
    .fetch_optional(db)
    .await?
    {
        return Ok(review);
    }

    let row = sqlx::query_as::<_, RequirementReview>(
        r#"
        INSERT INTO crm_requirement_reviews (
            source_type, source_id, requester_user_id, status, priority,
            original_text_snapshot, original_metadata_snapshot, created_by
        )
        SELECT
            'content_item', ci.id::text, ci.owner_id, 'new', 'normal',
            concat_ws('\n\n', ci.title, ci.summary, ci.body),
            COALESCE(ci.metadata, '{}'::jsonb),
            $2
        FROM content_items ci
        WHERE ci.id = $1 AND ci.content_type = 'request'
        RETURNING
            id, source_type, source_id, requester_user_id, status, priority, assigned_to,
            original_text_snapshot, original_metadata_snapshot
        "#,
    )
    .bind(content_id)
    .bind(actor_user_id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

pub async fn list_requirements(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RequirementQuery>,
) -> impl IntoResponse {
    let _ = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let limit = query.limit.unwrap_or(50).clamp(1, MAX_REQUIREMENTS);
    let offset = query.offset.unwrap_or(0).max(0);
    let q = query
        .q
        .map(|v| v.trim().chars().take(180).collect::<String>())
        .filter(|v| !v.is_empty());
    let status = query.status.map(text).filter(|v| !v.is_empty());

    let rows = sqlx::query_as::<_, RequirementItem>(
        r#"
        SELECT
            ci.id,
            ci.id AS source_id,
            ci.owner_id AS requester_user_id,
            ci.title,
            ci.summary,
            ci.body,
            ci.category,
            COALESCE(ci.metadata, '{}'::jsonb) AS metadata,
            rr.id AS review_id,
            rr.status AS review_status
        FROM content_items ci
        LEFT JOIN crm_requirement_reviews rr
          ON rr.source_type = 'content_item'
         AND rr.source_id = ci.id::text
        WHERE ci.content_type = 'request'
          AND ci.content_status = 'active'
          AND ($1::text IS NULL OR ci.title ILIKE '%' || $1 || '%' OR COALESCE(ci.summary, '') ILIKE '%' || $1 || '%' OR ci.body ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR rr.status = $2)
        ORDER BY COALESCE(rr.status, 'new') ASC, ci.updated_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(q)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({
                "items": items,
                "limit": limit,
                "offset": offset,
                "has_more": items.len() as i64 == limit
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("list CRM requirements failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load requirements"})),
            )
                .into_response()
        }
    }
}

pub async fn get_requirement(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let _ = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let review = sqlx::query_as::<_, RequirementReview>(
        r#"
        SELECT
            id, source_type, source_id, requester_user_id, status, priority, assigned_to,
            original_text_snapshot, original_metadata_snapshot
        FROM crm_requirement_reviews
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match review {
        Ok(Some(review)) => (StatusCode::OK, Json(json!({"requirement": review}))).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "requirement not found"})),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("get CRM requirement failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load requirement"})),
            )
                .into_response()
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn write_audit(
    db: &sqlx::PgPool,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    actor_user_id: Option<Uuid>,
    before: Option<Value>,
    after: Option<Value>,
    reason: Option<String>,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO crm_audit_logs (
            entity_type, entity_id, action, actor_user_id, before, after, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(action)
    .bind(actor_user_id)
    .bind(before)
    .bind(after)
    .bind(reason)
    .execute(db)
    .await;

    if let Err(error) = result {
        tracing::warn!(
            entity_type,
            entity_id,
            action,
            error = ?error,
            "failed to write CRM matching audit log"
        );
    }
}

async fn load_requirement_content(
    db: &sqlx::PgPool,
    review: &RequirementReview,
) -> Result<RequirementItem, sqlx::Error> {
    let source_id = review
        .source_id
        .as_deref()
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    sqlx::query_as::<_, RequirementItem>(
        r#"
        SELECT
            ci.id,
            ci.id AS source_id,
            ci.owner_id AS requester_user_id,
            ci.title,
            ci.summary,
            ci.body,
            ci.category,
            COALESCE(ci.metadata, '{}'::jsonb) AS metadata,
            $2::uuid AS review_id,
            $3::text AS review_status
        FROM content_items ci
        WHERE ci.id = $1 AND ci.content_type = 'request'
        "#,
    )
    .bind(source_id)
    .bind(review.id)
    .bind(&review.status)
    .fetch_one(db)
    .await
}

async fn find_existing_run(
    db: &sqlx::PgPool,
    key: &str,
) -> Result<Option<MatchingRunRow>, sqlx::Error> {
    sqlx::query_as::<_, MatchingRunRow>(
        r#"
        SELECT
            id, requirement_review_id, extraction_id, status, scoring_version, retrieval_strategy,
            candidate_count, top_score::double precision AS top_score, error_code,
            created_at, started_at, completed_at
        FROM crm_matching_runs
        WHERE idempotency_key = $1
        LIMIT 1
        "#,
    )
    .bind(key)
    .fetch_optional(db)
    .await
}

pub async fn run_match(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(review_or_source): Path<Uuid>,
    Json(payload): Json<MatchRequest>,
) -> impl IntoResponse {
    let actor = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let review = match sqlx::query_as::<_, RequirementReview>(
        r#"
        SELECT id, source_type, source_id, requester_user_id, status, priority, assigned_to,
               original_text_snapshot, original_metadata_snapshot
        FROM crm_requirement_reviews
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(review_or_source)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(review)) => review,
        Ok(None) => match ensure_review(&state.db, review_or_source, actor).await {
            Ok(review) => review,
            Err(sqlx::Error::RowNotFound) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "requirement not found"})),
                )
                    .into_response()
            }
            Err(error) => {
                tracing::error!("ensure CRM requirement failed: {:?}", error);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "failed to prepare requirement"})),
                )
                    .into_response();
            }
        },
        Err(error) => {
            tracing::error!("load CRM requirement failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load requirement"})),
            )
                .into_response();
        }
    };

    if let Some(key) = payload
        .idempotency_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        match find_existing_run(&state.db, key).await {
            Ok(Some(run)) => {
                return (StatusCode::OK, Json(json!({"run": run, "deduped": true}))).into_response()
            }
            Ok(None) => {}
            Err(error) => {
                tracing::error!("find existing matching run failed: {:?}", error);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "failed to check idempotency"})),
                )
                    .into_response();
            }
        }
    }

    let requirement = match load_requirement_content(&state.db, &review).await {
        Ok(requirement) => requirement,
        Err(error) => {
            tracing::error!("load requirement content failed: {:?}", error);
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "requirement source not found"})),
            )
                .into_response();
        }
    };

    let extraction_text = format!(
        "{}\n{}\n{}",
        requirement.title,
        requirement.summary.as_deref().unwrap_or_default(),
        requirement.body
    );
    let extraction_tokens = tokens(&extraction_text);
    let inferred_city = city_from(&requirement.metadata);
    let inferred_category =
        category_from(&requirement.metadata).or_else(|| requirement.category.clone());
    let (budget_min, budget_max) = budget(&requirement.metadata);
    let mut missing_fields = Vec::new();
    if inferred_city.is_none() {
        missing_fields.push("location".to_string());
    }
    if inferred_category.is_none() {
        missing_fields.push("category".to_string());
    }
    if budget_min.is_none() && budget_max.is_none() {
        missing_fields.push("budget".to_string());
    }

    let extraction_confidence: f64 =
        0.55 + if inferred_category.is_some() {
            0.15
        } else {
            0.0
        } + if inferred_city.is_some() { 0.10 } else { 0.0 }
            + if !extraction_tokens.is_empty() {
                0.10
            } else {
                0.0
            };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("start matching tx failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to start match"})),
            )
                .into_response();
        }
    };

    let extraction_id = match sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO crm_requirement_extractions (
            requirement_review_id, source_type, model_provider, model_name, prompt_version,
            schema_version, extracted_data, confidence, missing_fields, warnings, created_by
        )
        VALUES ($1, 'rule', 'lajukan', 'deterministic-v1', NULL, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(review.id)
    .bind(MATCHING_SCHEMA_VERSION)
    .bind(json!({
        "original_text": extraction_text,
        "need_type": json_text(&requirement.metadata, &["need_type", "listing_intent"]).unwrap_or_else(|| "request".to_string()),
        "category": inferred_category,
        "city": inferred_city,
        "budget_min": budget_min,
        "budget_max": budget_max,
        "keywords": extraction_tokens.iter().cloned().collect::<Vec<_>>()
    }))
    .bind(extraction_confidence.min(1.0))
    .bind(json!(missing_fields))
    .bind(json!([]))
    .bind(actor)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(id) => id,
        Err(error) => {
            let _ = tx.rollback().await;
            tracing::error!("insert extraction failed: {:?}", error);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "failed to persist extraction"}))).into_response()
        }
    };

    let run = match sqlx::query_as::<_, MatchingRunRow>(
        r#"
        INSERT INTO crm_matching_runs (
            requirement_review_id, extraction_id, status, scoring_version, retrieval_strategy,
            candidate_count, idempotency_key, started_at, created_by
        )
        VALUES ($1, $2, 'retrieved', $3, 'postgres', 0, $4, NOW(), $5)
        RETURNING
            id, requirement_review_id, extraction_id, status, scoring_version, retrieval_strategy,
            candidate_count, top_score::double precision AS top_score, error_code,
            created_at, started_at, completed_at
        "#,
    )
    .bind(review.id)
    .bind(extraction_id)
    .bind(MATCHING_SCORE_VERSION)
    .bind(payload.idempotency_key.clone())
    .bind(actor)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(run) => run,
        Err(error) => {
            let _ = tx.rollback().await;
            tracing::error!("insert matching run failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to create matching run"})),
            )
                .into_response();
        }
    };

    let query_text = extraction_tokens
        .iter()
        .take(12)
        .cloned()
        .collect::<Vec<_>>()
        .join(" ");
    let candidates = sqlx::query_as::<_, CandidateItem>(
        r#"
        SELECT
            id, owner_id, title, summary, body, content_type, category, tags,
            price_cents, rating, review_count, cover_image,
            COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
        FROM content_items
        WHERE content_status = 'active'
          AND content_type IN ('product', 'service', 'material', 'tool_rental', 'business_transfer', 'property', 'talent')
        ORDER BY
            CASE
                WHEN ($1 <> '' AND search_vector @@ plainto_tsquery('simple', $2)) THEN 0
                WHEN lower(title) ILIKE '%' || lower($2) || '%' THEN 1
                WHEN lower(COALESCE(summary, '')) ILIKE '%' || lower($2) || '%' THEN 2
                WHEN lower(COALESCE(body, '')) ILIKE '%' || lower($2) || '%' THEN 3
                ELSE 4
            END,
            updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(&query_text)
    .bind(&requirement.title)
    .bind(MAX_CANDIDATES)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let requirement_for_score = requirement;
    let mut ranked = candidates
        .iter()
        .map(|candidate| {
            let score = score_candidate(&requirement_for_score, candidate);
            (candidate, score)
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|a, b| {
        b.1.total
            .partial_cmp(&a.1.total)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let ranked = ranked.into_iter().take(TOP_RESULTS).collect::<Vec<_>>();
    let top_score = ranked.first().map(|(_, score)| score.total);
    for (rank, (candidate, score)) in ranked.iter().enumerate() {
        if let Err(error) = sqlx::query(
            r#"
            INSERT INTO crm_matching_candidates (
                matching_run_id, candidate_type, candidate_id, provider_user_id, rank,
                score_total, score_breakdown, matched_fields, missing_fields, reasons,
                warnings, verification_snapshot, location_snapshot, admin_status
            )
            VALUES (
                $1, 'content_item', $2, $3, $4,
                $5, $6, $7, $8, $9,
                $10, $11, $12, 'pending'
            )
            "#,
        )
        .bind(run.id)
        .bind(candidate.id.to_string())
        .bind(candidate.owner_id)
        .bind((rank + 1) as i32)
        .bind(score.total)
        .bind(score.breakdown.clone())
        .bind(json!(score.matched_fields))
        .bind(json!(score.missing_fields))
        .bind(json!(score.reasons))
        .bind(json!(score.warnings))
        .bind(json!({
            "rating": candidate.rating,
            "review_count": candidate.review_count,
            "content_type": candidate.content_type
        }))
        .bind(json!({
            "city": city_from(&candidate.metadata),
            "coordinates": coordinate_from(&candidate.metadata)
        }))
        .execute(&mut *tx)
        .await
        {
            let _ = tx.rollback().await;
            tracing::error!("insert matching candidate failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to save candidates"})),
            )
                .into_response();
        }
    }

    let run_status = if ranked.is_empty() {
        "no_match"
    } else {
        "needs_admin_review"
    };
    if let Err(error) = sqlx::query(
        r#"
        UPDATE crm_matching_runs
        SET status = $2, candidate_count = $3, top_score = $4, completed_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(run.id)
    .bind(run_status)
    .bind(ranked.len() as i32)
    .bind(top_score)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("update matching run failed: {:?}", error);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "failed to finalize match"})),
        )
            .into_response();
    }

    let next_review_status = if ranked.is_empty() {
        "closed"
    } else {
        "matching"
    };
    if let Err(error) = sqlx::query(
        "UPDATE crm_requirement_reviews SET status = $2, assigned_to = COALESCE(assigned_to, $3), updated_at = NOW() WHERE id = $1",
    )
    .bind(review.id)
    .bind(next_review_status)
    .bind(actor)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("update requirement review failed: {:?}", error);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "failed to update requirement state"}))).into_response()
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("commit matching run failed: {:?}", error);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "failed to commit match"})),
        )
            .into_response();
    }

    write_audit(
        &state.db,
        "matching_run",
        &run.id.to_string(),
        "match.run_completed",
        Some(actor),
        None,
        Some(json!({
            "status": run_status,
            "candidate_count": ranked.len(),
            "top_score": top_score,
            "scoring_version": MATCHING_SCORE_VERSION
        })),
        None,
    )
    .await;

    (
        StatusCode::CREATED,
        Json(json!({
            "run": {
                "id": run.id,
                "requirement_review_id": run.requirement_review_id,
                "status": run_status,
                "scoring_version": MATCHING_SCORE_VERSION,
                "candidate_count": ranked.len(),
                "top_score": top_score
            },
            "deduped": false
        })),
    )
        .into_response()
}

pub async fn get_match_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let _ = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let run = match sqlx::query_as::<_, MatchingRunRow>(
        r#"
        SELECT
            id, requirement_review_id, extraction_id, status, scoring_version, retrieval_strategy,
            candidate_count, top_score::double precision AS top_score, error_code,
            created_at, started_at, completed_at
        FROM crm_matching_runs
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(run)) => run,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "matching run not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("get match run failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load matching run"})),
            )
                .into_response();
        }
    };

    let candidates = sqlx::query(
        r#"
        SELECT id, candidate_type, candidate_id, provider_user_id, provider_business_id,
               rank, score_total, score_breakdown, matched_fields, missing_fields,
               reasons, warnings, verification_snapshot, location_snapshot,
               admin_status, admin_reason, reviewed_by, reviewed_at, created_at
        FROM crm_matching_candidates
        WHERE matching_run_id = $1
        ORDER BY rank ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let candidate_json = candidates
        .into_iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid, _>("id"),
                "candidate_type": row.get::<String, _>("candidate_type"),
                "candidate_id": row.get::<String, _>("candidate_id"),
                "provider_user_id": row.get::<Option<Uuid>, _>("provider_user_id"),
                "provider_business_id": row.get::<Option<Uuid>, _>("provider_business_id"),
                "rank": row.get::<i32, _>("rank"),
                "score_total": row.get::<f64, _>("score_total"),
                "score_breakdown": row.get::<Value, _>("score_breakdown"),
                "matched_fields": row.get::<Value, _>("matched_fields"),
                "missing_fields": row.get::<Value, _>("missing_fields"),
                "reasons": row.get::<Value, _>("reasons"),
                "warnings": row.get::<Value, _>("warnings"),
                "verification_snapshot": row.get::<Value, _>("verification_snapshot"),
                "location_snapshot": row.get::<Value, _>("location_snapshot"),
                "admin_status": row.get::<String, _>("admin_status"),
                "admin_reason": row.get::<Option<String>, _>("admin_reason"),
                "reviewed_by": row.get::<Option<Uuid>, _>("reviewed_by"),
                "reviewed_at": row.get::<Option<DateTime<Utc>>, _>("reviewed_at"),
                "created_at": row.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect::<Vec<_>>();

    (
        StatusCode::OK,
        Json(json!({"run": run, "candidates": candidate_json})),
    )
        .into_response()
}

pub async fn review_candidate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CandidateReviewRequest>,
) -> impl IntoResponse {
    let actor = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let status =
        match payload.admin_status.as_deref().map(text).as_deref() {
            Some("approved") | Some("rejected") | Some("held") | Some("pending") => {
                payload.admin_status.clone().unwrap()
            }
            _ => return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "admin_status must be pending, approved, rejected, or held"})),
            )
                .into_response(),
        };

    let existing = sqlx::query(
        r#"
        SELECT admin_status, admin_reason, matching_run_id
        FROM crm_matching_candidates
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let existing = match existing {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "candidate not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("load candidate for review failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load candidate"})),
            )
                .into_response();
        }
    };

    let before = json!({
        "admin_status": existing.get::<String, _>("admin_status"),
        "admin_reason": existing.get::<Option<String>, _>("admin_reason"),
        "matching_run_id": existing.get::<Uuid, _>("matching_run_id"),
    });

    let updated = sqlx::query(
        r#"
        UPDATE crm_matching_candidates
        SET admin_status = $2, admin_reason = $3, reviewed_by = $4, reviewed_at = NOW()
        WHERE id = $1
        RETURNING id, admin_status, admin_reason, reviewed_at
        "#,
    )
    .bind(id)
    .bind(status.clone())
    .bind(payload.admin_reason.clone())
    .bind(actor)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(row) => {
            write_audit(
                &state.db,
                "matching_candidate",
                &id.to_string(),
                "match.candidate_reviewed",
                Some(actor),
                Some(before),
                Some(json!({
                    "admin_status": row.get::<String, _>("admin_status"),
                    "admin_reason": row.get::<Option<String>, _>("admin_reason"),
                    "reviewed_at": row.get::<Option<DateTime<Utc>>, _>("reviewed_at"),
                })),
                payload.admin_reason.clone(),
            )
            .await;

            (
                StatusCode::OK,
                Json(json!({
                    "ok": true,
                    "candidate_id": id,
                    "admin_status": row.get::<String, _>("admin_status"),
                    "matching_run_id": existing.get::<Uuid, _>("matching_run_id"),
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("review candidate failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to review candidate"})),
            )
                .into_response()
        }
    }
}

pub async fn create_connection(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ConnectionRequest>,
) -> impl IntoResponse {
    let actor = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let channel = payload
        .channel
        .as_deref()
        .map(text)
        .unwrap_or_else(|| "manual".to_string());
    if !["lajukan_chat", "whatsapp", "phone", "manual"].contains(&channel.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid connection channel"})),
        )
            .into_response();
    }

    let provider_entity_type = text(&payload.provider_entity_type);
    if provider_entity_type.is_empty() || payload.provider_entity_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "provider entity is required"})),
        )
            .into_response();
    }

    let mut provider_user_id = payload.provider_user_id;
    let mut provider_business_id = payload.provider_business_id;
    let mut provider_entity_id = payload.provider_entity_id.trim().to_string();
    let mut candidate_status: Option<String> = None;
    let mut linked_review_id = payload.requirement_review_id;

    if let Some(candidate_id) = payload.matching_candidate_id {
        let candidate = sqlx::query(
            r#"
            SELECT
                c.admin_status,
                c.candidate_type,
                c.candidate_id,
                c.provider_user_id,
                c.provider_business_id,
                r.requirement_review_id
            FROM crm_matching_candidates c
            JOIN crm_matching_runs r ON r.id = c.matching_run_id
            WHERE c.id = $1
            LIMIT 1
            "#,
        )
        .bind(candidate_id)
        .fetch_optional(&state.db)
        .await;

        let candidate = match candidate {
            Ok(Some(row)) => row,
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "matching candidate not found"})),
                )
                    .into_response()
            }
            Err(error) => {
                tracing::error!("load candidate before connection failed: {:?}", error);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "failed to validate candidate"})),
                )
                    .into_response();
            }
        };

        candidate_status = Some(candidate.get::<String, _>("admin_status"));
        if candidate.get::<String, _>("admin_status") != "approved" {
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "candidate must be approved before creating a connection"})),
            )
                .into_response();
        }

        linked_review_id = candidate.get::<Uuid, _>("requirement_review_id");
        if linked_review_id != payload.requirement_review_id {
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "candidate does not belong to this requirement"})),
            )
                .into_response();
        }

        provider_user_id =
            provider_user_id.or_else(|| candidate.get::<Option<Uuid>, _>("provider_user_id"));
        provider_business_id = provider_business_id
            .or_else(|| candidate.get::<Option<Uuid>, _>("provider_business_id"));
        provider_entity_id = candidate.get::<String, _>("candidate_id");

        if payload.provider_entity_type.trim().is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "provider_entity_type is required"})),
            )
                .into_response();
        }
    }

    if let Some(key) = payload
        .idempotency_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        if let Ok(Some(existing)) =
            sqlx::query("SELECT id, status FROM crm_connections WHERE idempotency_key = $1 LIMIT 1")
                .bind(key)
                .fetch_optional(&state.db)
                .await
        {
            return (
                StatusCode::OK,
                Json(json!({
                    "connection": {
                        "id": existing.get::<Uuid, _>("id"),
                        "status": existing.get::<String, _>("status")
                    },
                    "deduped": true
                })),
            )
                .into_response();
        }
    }

    let inserted = sqlx::query(
        r#"
        INSERT INTO crm_connections (
            requirement_review_id, matching_run_id, matching_candidate_id,
            requester_user_id, provider_user_id, provider_business_id,
            provider_entity_type, provider_entity_id, channel, status, notes,
            idempotency_key, created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, 'draft', $10,
            $11, $12
        )
        RETURNING id, status, created_at
        "#,
    )
    .bind(linked_review_id)
    .bind(payload.matching_run_id)
    .bind(payload.matching_candidate_id)
    .bind(payload.requester_user_id)
    .bind(provider_user_id)
    .bind(provider_business_id)
    .bind(provider_entity_type)
    .bind(&provider_entity_id)
    .bind(channel)
    .bind(payload.notes)
    .bind(payload.idempotency_key)
    .bind(actor)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(row) => {
            write_audit(
                &state.db,
                "connection",
                &row.get::<Uuid, _>("id").to_string(),
                "connection.created",
                Some(actor),
                None,
                Some(json!({
                    "requirement_review_id": linked_review_id,
                    "matching_run_id": payload.matching_run_id,
                    "matching_candidate_id": payload.matching_candidate_id,
                    "provider_user_id": provider_user_id,
                    "provider_business_id": provider_business_id,
                    "provider_entity_id": provider_entity_id,
                    "candidate_status": candidate_status,
                })),
                None,
            )
            .await;

            (
                StatusCode::CREATED,
                Json(json!({
                    "connection": {
                        "id": row.get::<Uuid, _>("id"),
                        "status": row.get::<String, _>("status"),
                        "created_at": row.get::<DateTime<Utc>, _>("created_at")
                    }
                })),
            )
                .into_response()
        }
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => (
            StatusCode::CONFLICT,
            Json(json!({"error": "connection already exists for this idempotency key"})),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("create connection failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to create connection"})),
            )
                .into_response()
        }
    }
}

pub async fn patch_connection(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<ConnectionPatch>,
) -> impl IntoResponse {
    let _actor = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let status = payload.status.as_deref().map(text);
    if let Some(status) = status.as_deref() {
        const ALLOWED: &[&str] = &[
            "draft",
            "sent",
            "opened",
            "contacted",
            "responded",
            "negotiating",
            "succeeded",
            "failed",
            "spam_or_invalid",
        ];
        if !ALLOWED.contains(&status) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid connection status"})),
            )
                .into_response();
        }
    }

    let updated = sqlx::query(
        r#"
        UPDATE crm_connections
        SET
            status = COALESCE($2, status),
            outcome_reason = COALESCE($3, outcome_reason),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, outcome_reason, notes, updated_at
        "#,
    )
    .bind(id)
    .bind(status)
    .bind(payload.outcome_reason)
    .bind(payload.notes)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(row)) => {
            let terminal = matches!(
                row.get::<String, _>("status").as_str(),
                "succeeded" | "failed" | "spam_or_invalid"
            );
            if terminal {
                let outcome = row.get::<String, _>("status");
                let _ = sqlx::query(
                    "UPDATE crm_requirement_reviews SET status = 'connected', updated_at = NOW() WHERE id = (SELECT requirement_review_id FROM crm_connections WHERE id = $1)",
                )
                .bind(id)
                .execute(&state.db)
                .await;
                let _ = outcome;
            }
            (
                StatusCode::OK,
                Json(json!({
                    "connection": {
                        "id": row.get::<Uuid, _>("id"),
                        "status": row.get::<String, _>("status"),
                        "outcome_reason": row.get::<Option<String>, _>("outcome_reason"),
                        "notes": row.get::<Option<String>, _>("notes"),
                        "updated_at": row.get::<DateTime<Utc>, _>("updated_at")
                    }
                })),
            )
                .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "connection not found"})),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("patch connection failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to update connection"})),
            )
                .into_response()
        }
    }
}

pub async fn create_matching_feedback(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<MatchingFeedbackRequest>,
) -> impl IntoResponse {
    let actor = match require_agent(&headers, &state) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    let allowed_sources = ["admin", "requester", "provider", "system"];
    let allowed_types = [
        "approved",
        "rejected",
        "contacted",
        "responded",
        "succeeded",
        "failed",
        "corrected_extraction",
    ];
    if !allowed_sources.contains(&text(&payload.feedback_source).as_str())
        || !allowed_types.contains(&text(&payload.feedback_type).as_str())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid feedback type"})),
        )
            .into_response();
    }

    let inserted = sqlx::query(
        r#"
        INSERT INTO crm_matching_feedback (
            connection_id, matching_candidate_id, requirement_review_id,
            feedback_source, feedback_type, reason_code, note, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'::jsonb), $9)
        RETURNING id, created_at
        "#,
    )
    .bind(payload.connection_id)
    .bind(payload.matching_candidate_id)
    .bind(payload.requirement_review_id)
    .bind(text(&payload.feedback_source))
    .bind(text(&payload.feedback_type))
    .bind(payload.reason_code.as_ref().map(text))
    .bind(payload.note.clone())
    .bind(payload.metadata)
    .bind(actor)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(row) => {
            write_audit(
                &state.db,
                "matching_feedback",
                &row.get::<Uuid, _>("id").to_string(),
                "matching_feedback.created",
                Some(actor),
                None,
                Some(json!({
                    "connection_id": payload.connection_id,
                    "matching_candidate_id": payload.matching_candidate_id,
                    "requirement_review_id": payload.requirement_review_id,
                    "feedback_source": text(&payload.feedback_source),
                    "feedback_type": text(&payload.feedback_type),
                    "reason_code": payload.reason_code,
                })),
                payload.note.clone(),
            )
            .await;

            (
                StatusCode::CREATED,
                Json(json!({
                    "feedback": {
                        "id": row.get::<Uuid, _>("id"),
                        "created_at": row.get::<DateTime<Utc>, _>("created_at")
                    }
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("create matching feedback failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to create feedback"})),
            )
                .into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenization_ignores_short_and_stop_words() {
        let result = tokens("Butuh supplier cup 16 oz untuk kedai kopi Bandung");
        assert!(result.contains("supplier"));
        assert!(result.contains("cup"));
        assert!(result.contains("bandung"));
        assert!(!result.contains("untuk"));
    }

    #[test]
    fn distance_is_reasonable() {
        let distance = haversine_km((-6.2000, 106.8166), (-6.1754, 106.8272));
        assert!(distance > 2.0 && distance < 4.0);
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct PublicMatchQuery {
    pub sort: Option<String>,
    pub limit: Option<i64>,
}

fn public_match_sort(value: Option<&str>) -> &str {
    match value.unwrap_or("best").trim().to_ascii_lowercase().as_str() {
        "nearest" | "closest" => "nearest",
        "cheapest" | "cheap" => "cheapest",
        "similar" | "similarity" | "match" => "similarity",
        "worth" | "value" | "best" | "balanced" => "worth",
        _ => "worth",
    }
}

/// Fast owner-scoped Smart Match for the public listing flow.
pub async fn public_matches(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(query): Query<PublicMatchQuery>,
) -> impl IntoResponse {
    let owner_id = match auth_claims_from_headers(&headers, &state.jwt_secret)
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok())
    {
        Some(id) => id,
        None => return unauthorized(),
    };

    let source = match sqlx::query_as::<_, CandidateItem>(
        r#"
        SELECT
            id, owner_id, title, summary, body, content_type, category, tags,
            price_cents, rating, review_count, cover_image,
            COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
        FROM content_items
        WHERE id = $1
          AND owner_id = $2
          AND content_status = 'active'
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(owner_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "listing not found"})),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("public match source lookup failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to load listing"})),
            )
                .into_response();
        }
    };

    let listing_intent = json_text(
        &source.metadata,
        &["listing_intent", "intent", "market_side", "listing_side"],
    )
    .map(text)
    .unwrap_or_else(|| {
        if source.price_cents.is_some() {
            "offer".to_string()
        } else {
            "request".to_string()
        }
    });

    let limit = query.limit.unwrap_or(12).clamp(1, 25);
    let sort = public_match_sort(query.sort.as_deref());
    let source_text = format!(
        "{} {} {} {}",
        source.title,
        source.summary.as_deref().unwrap_or_default(),
        source.body,
        source.category.as_deref().unwrap_or_default()
    );
    let query_text = tokens(&source_text)
        .into_iter()
        .take(12)
        .collect::<Vec<_>>()
        .join(" ");

    struct PublicRanked {
        item: CandidateItem,
        score: CandidateScore,
        distance_km: Option<f64>,
        target_budget_min: Option<i64>,
        target_budget_max: Option<i64>,
    }

    let mut ranked: Vec<PublicRanked> = Vec::new();

    let is_request = matches!(listing_intent.as_str(), "request" | "demand" | "seeker");
    if is_request {
        let requirement = RequirementItem {
            id: source.id,
            source_id: source.id,
            requester_user_id: Some(source.owner_id),
            title: source.title.clone(),
            summary: source.summary.clone(),
            body: source.body.clone(),
            category: source.category.clone(),
            metadata: source.metadata.clone(),
            review_id: None,
            review_status: None,
        };

        let candidates = sqlx::query_as::<_, CandidateItem>(
            r#"
            SELECT
                id, owner_id, title, summary, body, content_type, category, tags,
                price_cents, rating, review_count, cover_image,
                COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
            FROM content_items
            WHERE content_status = 'active'
              AND owner_id <> $2
              AND content_type IN (
                  'product', 'service', 'material', 'tool_rental',
                  'business_transfer', 'property', 'talent'
              )
            ORDER BY
                CASE
                    WHEN ($1 <> '' AND search_vector @@ plainto_tsquery('simple', $1)) THEN 0
                    WHEN lower(title) ILIKE '%' || lower($3) || '%' THEN 1
                    WHEN lower(COALESCE(summary, '')) ILIKE '%' || lower($3) || '%' THEN 2
                    WHEN lower(COALESCE(body, '')) ILIKE '%' || lower($3) || '%' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT 120
            "#,
        )
        .bind(&query_text)
        .bind(source.owner_id)
        .bind(&source.title)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        let (budget_min, budget_max) = budget(&source.metadata);
        for candidate in candidates {
            let score = score_candidate(&requirement, &candidate);
            let distance_km = coordinate_from(&source.metadata)
                .zip(coordinate_from(&candidate.metadata))
                .map(|(a, b)| haversine_km(a, b));
            ranked.push(PublicRanked {
                item: candidate,
                score,
                distance_km,
                target_budget_min: budget_min,
                target_budget_max: budget_max,
            });
        }
    } else {
        let candidates = sqlx::query_as::<_, CandidateItem>(
            r#"
            SELECT
                id, owner_id, title, summary, body, content_type, category, tags,
                price_cents, rating, review_count, cover_image,
                COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
            FROM content_items
            WHERE content_status = 'active'
              AND owner_id <> $2
              AND content_type = 'request'
            ORDER BY
                CASE
                    WHEN ($1 <> '' AND search_vector @@ plainto_tsquery('simple', $1)) THEN 0
                    WHEN lower(title) ILIKE '%' || lower($3) || '%' THEN 1
                    WHEN lower(COALESCE(summary, '')) ILIKE '%' || lower($3) || '%' THEN 2
                    WHEN lower(COALESCE(body, '')) ILIKE '%' || lower($3) || '%' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT 120
            "#,
        )
        .bind(&query_text)
        .bind(source.owner_id)
        .bind(&source.title)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        for request in candidates {
            let requirement = RequirementItem {
                id: request.id,
                source_id: request.id,
                requester_user_id: Some(request.owner_id),
                title: request.title.clone(),
                summary: request.summary.clone(),
                body: request.body.clone(),
                category: request.category.clone(),
                metadata: request.metadata.clone(),
                review_id: None,
                review_status: None,
            };
            let score = score_candidate(&requirement, &source);
            let distance_km = coordinate_from(&source.metadata)
                .zip(coordinate_from(&request.metadata))
                .map(|(a, b)| haversine_km(a, b));
            let (budget_min, budget_max) = budget(&request.metadata);
            ranked.push(PublicRanked {
                item: request,
                score,
                distance_km,
                target_budget_min: budget_min,
                target_budget_max: budget_max,
            });
        }
    }

    ranked.sort_by(|a, b| {
        let ordering = match sort {
            "nearest" => a
                .distance_km
                .unwrap_or(f64::INFINITY)
                .partial_cmp(&b.distance_km.unwrap_or(f64::INFINITY)),
            "cheapest" => Some(
                a.item
                    .price_cents
                    .or(a.target_budget_max)
                    .unwrap_or(i64::MAX)
                    .cmp(
                        &b.item
                            .price_cents
                            .or(b.target_budget_max)
                            .unwrap_or(i64::MAX),
                    ),
            ),
            "similarity" => b.score.similarity.partial_cmp(&a.score.similarity),
            "worth" | "best" | "balanced" | _ => b
                .score
                .worth
                .partial_cmp(&a.score.worth)
                .or_else(|| b.score.total.partial_cmp(&a.score.total)),
        };
        ordering.unwrap_or(std::cmp::Ordering::Equal)
    });

    let results = ranked
        .into_iter()
        .take(limit as usize)
        .map(|entry| {
            let score_label = if entry.score.total >= 85.0 {
                "very_high"
            } else if entry.score.total >= 70.0 {
                "high"
            } else if entry.score.total >= 55.0 {
                "medium"
            } else {
                "low"
            };
            json!({
                "id": entry.item.id,
                "title": entry.item.title,
                "summary": entry.item.summary,
                "content_type": entry.item.content_type,
                "slug": entry.item.metadata.get("slug").and_then(Value::as_str),
                "cover_image": entry.item.cover_image,
                "price_cents": entry.item.price_cents,
                "currency": entry.item.metadata.get("currency").and_then(Value::as_str).unwrap_or("IDR"),
                "city": city_from(&entry.item.metadata),
                "distance_km": entry.distance_km.map(|v| (v * 10.0).round() / 10.0),
                "budget_min": entry.target_budget_min,
                "budget_max": entry.target_budget_max,
                "score": entry.score.total.round(),
                "similarity_score": entry.score.similarity.round(),
                "worth_score": entry.score.worth.round(),
                "score_label": score_label,
                "breakdown": entry.score.breakdown,
                "matched_fields": entry.score.matched_fields,
                "reasons": entry.score.reasons,
                "warnings": entry.score.warnings,
                "rating": entry.item.rating,
                "review_count": entry.item.review_count,
                "updated_at": entry.item.updated_at,
            })
        })
        .collect::<Vec<_>>();

    (
        StatusCode::OK,
        Json(json!({
            "source_id": source.id,
            "intent": listing_intent,
            "sort": sort,
            "count": results.len(),
            "results": results,
            "engine": {
                "name": "Lajukan Smart Match",
                "version": MATCHING_SCORE_VERSION,
                "mode": "fast_deterministic",
                "ai_ready": true
            }
        })),
    )
        .into_response()
}

pub async fn notify_new_listing_matches(
    state: &Arc<AppState>,
    source_id: Uuid,
    source_owner_id: Uuid,
) {
    let source = match sqlx::query_as::<_, CandidateItem>(
        r#"
        SELECT
            id, owner_id, title, summary, body, content_type, category, tags,
            price_cents, rating, review_count, cover_image,
            COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
        FROM content_items
        WHERE id = $1
          AND owner_id = $2
          AND content_status = 'active'
        LIMIT 1
        "#,
    )
    .bind(source_id)
    .bind(source_owner_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return,
        Err(error) => {
            tracing::warn!("smart match notification source lookup failed: {:?}", error);
            return;
        }
    };

    let listing_intent = json_text(
        &source.metadata,
        &["listing_intent", "intent", "market_side", "listing_side"],
    )
    .map(text)
    .unwrap_or_else(|| {
        if source.price_cents.is_some() {
            "offer".to_string()
        } else {
            "request".to_string()
        }
    });

    let query_text = tokens(&format!(
        "{} {} {} {}",
        source.title,
        source.summary.as_deref().unwrap_or_default(),
        source.body,
        source.category.as_deref().unwrap_or_default()
    ))
    .into_iter()
    .take(12)
    .collect::<Vec<_>>()
    .join(" ");

    let is_request = matches!(listing_intent.as_str(), "request" | "demand" | "seeker");
    let candidates = if is_request {
        sqlx::query_as::<_, CandidateItem>(
            r#"
            SELECT
                id, owner_id, title, summary, body, content_type, category, tags,
                price_cents, rating, review_count, cover_image,
                COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
            FROM content_items
            WHERE content_status = 'active'
              AND owner_id <> $2
              AND content_type IN (
                  'product', 'service', 'material', 'tool_rental',
                  'business_transfer', 'property', 'talent'
              )
            ORDER BY
                CASE
                    WHEN ($1 <> '' AND search_vector @@ plainto_tsquery('simple', $1)) THEN 0
                    WHEN lower(title) ILIKE '%' || lower($3) || '%' THEN 1
                    WHEN lower(COALESCE(summary, '')) ILIKE '%' || lower($3) || '%' THEN 2
                    WHEN lower(COALESCE(body, '')) ILIKE '%' || lower($3) || '%' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT 80
            "#,
        )
        .bind(&query_text)
        .bind(source.owner_id)
        .bind(&source.title)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, CandidateItem>(
            r#"
            SELECT
                id, owner_id, title, summary, body, content_type, category, tags,
                price_cents, rating, review_count, cover_image,
                COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
            FROM content_items
            WHERE content_status = 'active'
              AND owner_id <> $2
              AND content_type = 'request'
              AND (
                  ($1 <> '' AND search_vector @@ plainto_tsquery('simple', $1))
                  OR lower(title) ILIKE '%' || lower($3) || '%'
                  OR lower(COALESCE(summary, '')) ILIKE '%' || lower($3) || '%'
                  OR lower(COALESCE(body, '')) ILIKE '%' || lower($3) || '%'
              )
            ORDER BY updated_at DESC
            LIMIT 50
            "#,
        )
        .bind(&query_text)
        .bind(source.owner_id)
        .bind(&source.title)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    };

    let requirement_for_source = RequirementItem {
        id: source.id,
        source_id: source.id,
        requester_user_id: Some(source.owner_id),
        title: source.title.clone(),
        summary: source.summary.clone(),
        body: source.body.clone(),
        category: source.category.clone(),
        metadata: source.metadata.clone(),
        review_id: None,
        review_status: None,
    };

    let mut scored = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        let score = if is_request {
            score_candidate(&requirement_for_source, &candidate)
        } else {
            let candidate_requirement = RequirementItem {
                id: candidate.id,
                source_id: candidate.id,
                requester_user_id: Some(candidate.owner_id),
                title: candidate.title.clone(),
                summary: candidate.summary.clone(),
                body: candidate.body.clone(),
                category: candidate.category.clone(),
                metadata: candidate.metadata.clone(),
                review_id: None,
                review_status: None,
            };
            score_candidate(&candidate_requirement, &source)
        };
        if score.total >= 55.0 {
            scored.push((candidate, score.total));
        }
    }

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top = scored.into_iter().take(5).collect::<Vec<_>>();

    if top.is_empty() {
        return;
    }

    let owner_message = if top.len() == 1 {
        "Lajukan menemukan 1 listing yang cocok. Cek perbandingannya."
    } else {
        "Lajukan menemukan beberapa listing yang cocok. Cek dan bandingkan sekarang."
    };

    if let Ok(result) = sqlx::query(
        r#"
        INSERT INTO crm_smart_match_notifications (
            source_content_id, matched_content_id, recipient_user_id, direction
        )
        SELECT $1, $2, $3, 'source_owner'
        WHERE NOT EXISTS (
            SELECT 1 FROM crm_smart_match_notifications
            WHERE source_content_id = $1
              AND matched_content_id = $2
              AND recipient_user_id = $3
              AND direction = 'source_owner'
        )
        "#,
    )
    .bind(source.id)
    .bind(top[0].0.id)
    .bind(source.owner_id)
    .execute(&state.db)
    .await
    {
        if result.rows_affected() > 0 {
            push_notification_best_effort(
                state,
                source.owner_id,
                "system",
                "smart_match.found",
                "Ada yang cocok dengan listing kamu",
                owner_message,
                json!({
                    "source_content_id": source.id,
                    "match_count": top.len(),
                    "top_match_id": top[0].0.id,
                    "top_score": top[0].1.round(),
                    "action": "compare_matches"
                }),
            )
            .await;
        }
    }

    for (candidate, score) in top {
        let inserted = sqlx::query(
            r#"
            INSERT INTO crm_smart_match_notifications (
                source_content_id, matched_content_id, recipient_user_id, direction
            )
            SELECT $1, $2, $3, 'matched_owner'
            WHERE NOT EXISTS (
                SELECT 1 FROM crm_smart_match_notifications
                WHERE source_content_id = $1
                  AND matched_content_id = $2
                  AND recipient_user_id = $3
                  AND direction = 'matched_owner'
            )
            "#,
        )
        .bind(source.id)
        .bind(candidate.id)
        .bind(candidate.owner_id)
        .execute(&state.db)
        .await;

        if inserted
            .as_ref()
            .map(|r| r.rows_affected() > 0)
            .unwrap_or(false)
        {
            let opposite = if is_request {
                "permintaan"
            } else {
                "penawaran"
            };
            push_notification_best_effort(
                state,
                candidate.owner_id,
                "system",
                "smart_match.opportunity",
                "Ada peluang yang cocok",
                &format!(
                    "Listing kamu cocok dengan {}. Kecocokan sekitar {}%. Buka untuk membandingkan.",
                    opposite,
                    score.round()
                ),
                json!({
                    "source_content_id": source.id,
                    "matched_content_id": candidate.id,
                    "score": score.round(),
                    "action": "compare_matches"
                }),
            )
            .await;
        }
    }
}
