use anyhow::{anyhow, Result as AnyhowResult};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use uuid::Uuid;

use crate::{auth::auth_claims_from_headers, has_agent_access, AppState};

fn score_entity(
    name: Option<&str>,
    address: Option<&str>,
    city: Option<&str>,
    province: Option<&str>,
    lat: Option<f64>,
    lon: Option<f64>,
    resolution_status: &str,
) -> (f64, Vec<String>) {
    let mut score: f64 = 0.0;
    let mut reasons: Vec<String> = Vec::new();
    if name.is_some_and(|v| !v.trim().is_empty()) {
        score += 0.40;
    } else {
        reasons.push("missing_name".to_string());
    }
    let has_coordinates = lat.is_some() && lon.is_some();
    if address.is_some_and(|v| !v.trim().is_empty()) {
        score += 0.20;
    } else if !has_coordinates {
        // A map-ready reference may legitimately lack a structured street address.
        // Do not invent one; coordinates are the authoritative location signal.
        reasons.push("missing_address_and_coordinates".to_string());
    } else {
        // Preserve the address weight when coordinates make the record map-ready.
        score += 0.20;
    }
    if city.is_some_and(|v| !v.trim().is_empty()) {
        score += 0.10;
    } else {
        reasons.push("missing_city".to_string());
    }
    if province.is_some_and(|v| !v.trim().is_empty()) {
        score += 0.10;
    } else {
        reasons.push("missing_province".to_string());
    }
    // Coordinates improve readiness but are not mandatory for list/search publication.
    // A reference business can be publicly discoverable without being map-ready.
    if lat.is_some() && lon.is_some() {
        score += 0.20;
    }
    if matches!(resolution_status, "possible_duplicate" | "needs_review") {
        reasons.push("entity_resolution_requires_review".to_string());
        score *= 0.5;
    }
    (score.min(1.0), reasons)
}

pub async fn generate_for_entity(db: &PgPool, entity_id: Uuid) -> Result<Value, sqlx::Error> {
    let entity = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<f64>,
            Option<f64>,
            String,
            Value,
            bool,
            String,
            bool,
            bool,
        ),
    >(
        r#"SELECT e.id, e.source_id, e.normalized_name, e.normalized_address, e.city, e.province,
                   e.latitude, e.longitude, e.resolution_status, e.metadata,
                   s.auto_publish_reference, s.reuse_mode, s.storage_allowed, s.enabled
            FROM data_import_entities e
            JOIN data_source_registry s ON s.id=e.source_id
            WHERE e.id=$1 LIMIT 1"#,
    )
    .bind(entity_id)
    .fetch_optional(db)
    .await?;

    let Some((
        id,
        source_id,
        name,
        address,
        city,
        province,
        lat,
        lon,
        resolution_status,
        metadata,
        auto_publish_reference,
        reuse_mode,
        storage_allowed,
        source_enabled,
    )) = entity
    else {
        return Ok(json!({"found":false}));
    };

    let (score, reasons) = score_entity(
        name.as_deref(),
        address.as_deref(),
        city.as_deref(),
        province.as_deref(),
        lat,
        lon,
        &resolution_status,
    );
    let publication_blocked = reasons.iter().any(|reason| {
        matches!(
            reason.as_str(),
            "missing_name"
                | "missing_address_and_coordinates"
                | "entity_resolution_requires_review"
        )
    });
    let has_publishable_location = address
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
        || city
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty());
    let auto_publish_ready = auto_publish_reference
        && reuse_mode == "persistent_import"
        && storage_allowed
        && source_enabled
        && score >= 0.70
        && !publication_blocked
        && name
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        && has_publishable_location
        && !matches!(
            resolution_status.as_str(),
            "possible_duplicate" | "needs_review"
        );

    let status = if reasons
        .iter()
        .any(|v| *v == "entity_resolution_requires_review")
    {
        "blocked"
    } else if auto_publish_ready {
        "approved"
    } else {
        "pending_review"
    };

    let provenance = json!({
        "entity_id": id,
        "source_id": source_id,
        "record_kind": "reference_business_candidate",
        "resolution_status": resolution_status,
        "generated_from": "data_import_entities"
    });

    sqlx::query(
        r#"INSERT INTO reference_promotion_candidates
           (entity_id,source_id,promotion_status,readiness_score,blocking_reasons,provenance_snapshot,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())
           ON CONFLICT (entity_id) DO UPDATE SET
             source_id=EXCLUDED.source_id,
             promotion_status=CASE
               WHEN reference_promotion_candidates.promotion_status IN ('approved','promoted','rejected','blocked')
                 AND EXCLUDED.promotion_status <> 'approved'
                 THEN reference_promotion_candidates.promotion_status
               ELSE EXCLUDED.promotion_status END,
             readiness_score=EXCLUDED.readiness_score,
             blocking_reasons=EXCLUDED.blocking_reasons,
             provenance_snapshot=EXCLUDED.provenance_snapshot,
             updated_at=NOW()"#
    )
    .bind(id).bind(source_id).bind(status).bind(score)
    .bind(Value::Array(reasons.clone().into_iter().map(Value::String).collect::<Vec<_>>()))
    .bind(provenance)
    .execute(db)
    .await?;

    if auto_publish_ready {
        let candidate_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM reference_promotion_candidates WHERE entity_id=$1 LIMIT 1",
        )
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

        if let Err(error) = promote_candidate(db, candidate_id).await {
            tracing::warn!(candidate_id=%candidate_id, "automatic reference promotion skipped: {:?}", error);
        }
    }

    Ok(json!({
        "found": true,
        "entity_id": id,
        "readiness_score": score,
        "promotion_status": status,
        "blocking_reasons": reasons,
        "source_metadata_available": !metadata.is_null()
    }))
}

async fn generate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(entity_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(claims) = auth_claims_from_headers(&headers, &state.jwt_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"unauthorized"})),
        )
            .into_response();
    };
    if !has_agent_access(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"agent role required"})),
        )
            .into_response();
    }
    match generate_for_entity(&state.db, entity_id).await {
        Ok(value) if value.get("found").and_then(Value::as_bool) == Some(true) => {
            (StatusCode::OK, Json(value)).into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"entity not found"})),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("generate promotion candidate failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to generate promotion candidate"})),
            )
                .into_response()
        }
    }
}

fn slugify_reference(name: &str, city: Option<&str>, entity_id: Uuid) -> String {
    let mut slug = String::new();
    for ch in name
        .chars()
        .chain(std::iter::once(' '))
        .chain(city.unwrap_or("").chars())
    {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    while slug.starts_with('-') {
        slug.remove(0);
    }
    if slug.is_empty() {
        format!("reference-{entity_id}")
    } else {
        format!(
            "{}-{}",
            slug.chars().take(96).collect::<String>(),
            &entity_id.to_string()[..8]
        )
    }
}

fn reference_body(
    name: &str,
    address: Option<&str>,
    city: Option<&str>,
    province: Option<&str>,
) -> String {
    let mut lines = vec![name.to_string()];
    if let Some(value) = address.filter(|v| !v.trim().is_empty()) {
        lines.push(format!("Alamat: {value}"));
    }
    if let Some(value) = city.filter(|v| !v.trim().is_empty()) {
        lines.push(format!("Kota/Kabupaten: {value}"));
    }
    if let Some(value) = province.filter(|v| !v.trim().is_empty()) {
        lines.push(format!("Provinsi: {value}"));
    }
    lines.join("\n")
}

#[derive(Debug, sqlx::FromRow)]
struct PromotionCandidateSourceRow {
    candidate_id: Uuid,
    entity_id: Uuid,
    source_id: Uuid,
    promotion_status: String,
    readiness_score: f64,
    normalized_name: Option<String>,
    normalized_address: Option<String>,
    city: Option<String>,
    province: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    resolution_status: String,
    canonical_record_id: Option<Uuid>,
    source_record_id: Option<String>,
    source_record_url: Option<String>,
    record_license: Option<String>,
    record_attribution: Option<String>,
    record_kind: String,
    source_key: String,
    provider_name: String,
    source_url: String,
    source_license: Option<String>,
    source_license_url: Option<String>,
    source_attribution: Option<String>,
    reuse_mode: String,
    storage_allowed: bool,
    source_enabled: bool,
}

pub(crate) async fn promote_candidate(db: &PgPool, candidate_id: Uuid) -> AnyhowResult<Value> {
    let mut tx = db.begin().await?;

    let candidate = sqlx::query_as::<_, PromotionCandidateSourceRow>(
        r#"
        SELECT
          c.id AS candidate_id, c.entity_id, c.source_id, c.promotion_status, c.readiness_score,
          e.normalized_name, e.normalized_address, e.city, e.province,
          e.latitude, e.longitude, e.resolution_status, e.canonical_record_id,
          r.source_record_id, r.source_url AS source_record_url,
          r.license_snapshot AS record_license, r.attribution_snapshot AS record_attribution,
          r.record_kind,
          s.source_key, s.provider_name, s.source_url, s.license_name AS source_license,
          s.license_url AS source_license_url, s.attribution_text AS source_attribution,
          s.reuse_mode, s.storage_allowed, s.enabled AS source_enabled
        FROM reference_promotion_candidates c
        JOIN data_import_entities e ON e.id = c.entity_id
        LEFT JOIN data_import_records r
          ON r.id = e.canonical_record_id
         AND r.source_id = c.source_id
        JOIN data_source_registry s ON s.id = c.source_id
        WHERE c.id = $1
        FOR UPDATE OF c
        "#,
    )
    .bind(candidate_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(candidate) = candidate else {
        return Err(anyhow!("promotion candidate not found"));
    };

    let PromotionCandidateSourceRow {
        candidate_id,
        entity_id,
        source_id,
        promotion_status,
        readiness_score,
        normalized_name: name,
        normalized_address: address,
        city,
        province,
        latitude: lat,
        longitude: lon,
        resolution_status,
        canonical_record_id,
        source_record_id,
        source_record_url,
        record_license,
        record_attribution,
        record_kind,
        source_key,
        provider_name,
        source_url,
        source_license,
        source_license_url,
        source_attribution,
        reuse_mode,
        storage_allowed,
        source_enabled,
    } = candidate;

    if promotion_status == "promoted" {
        let existing = sqlx::query_scalar::<_, Uuid>(
            "SELECT proposed_content_id FROM reference_promotion_candidates WHERE id=$1",
        )
        .bind(candidate_id)
        .fetch_optional(&mut *tx)
        .await?;
        tx.commit().await?;
        return Ok(json!({
            "promoted": true,
            "idempotent": true,
            "candidate_id": candidate_id,
            "content_id": existing
        }));
    }

    if promotion_status != "approved" {
        return Err(anyhow!("candidate must be approved before promotion"));
    }
    if readiness_score < 0.70 {
        return Err(anyhow!("candidate readiness is below promotion threshold"));
    }
    if matches!(
        resolution_status.as_str(),
        "possible_duplicate" | "needs_review"
    ) {
        return Err(anyhow!("entity resolution still requires review"));
    }
    if canonical_record_id.is_none() || source_record_id.is_none() {
        return Err(anyhow!("canonical imported record is required"));
    }
    if reuse_mode != "persistent_import" || !storage_allowed || !source_enabled {
        return Err(anyhow!(
            "source is not currently enabled/approved for persistent promotion"
        ));
    }

    let source_record_id =
        source_record_id.ok_or_else(|| anyhow!("canonical imported record is required"))?;
    let canonical_record_id =
        canonical_record_id.ok_or_else(|| anyhow!("canonical imported record is required"))?;
    let effective_license = record_license.or(source_license.clone());
    if effective_license
        .as_deref()
        .is_none_or(|v| v.trim().is_empty())
    {
        return Err(anyhow!("source license is missing"));
    }

    let name = name.ok_or_else(|| anyhow!("reference entity has no name"))?;
    let body = reference_body(
        &name,
        address.as_deref(),
        city.as_deref(),
        province.as_deref(),
    );
    let slug = slugify_reference(&name, city.as_deref(), entity_id);

    let existing_content = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM content_items
        WHERE content_status <> 'deleted'
          AND metadata->>'reference_publication_status' = 'published'
          AND metadata->>'source_dataset' = $1
          AND metadata->>'external_id' = $2
        LIMIT 1
        "#,
    )
    .bind(&source_key)
    .bind(&source_record_id)
    .fetch_optional(&mut *tx)
    .await?;

    let content_id = if let Some(existing_id) = existing_content {
        existing_id
    } else {
        let metadata = json!({
            "record_kind": match record_kind.as_str() {
                "government_reference" => "government_reference",
                "real_openstreetmap_reference" => "real_openstreetmap_reference",
                _ => "open_data_reference",
            },
            "market_side": "reference",
            "is_transactional": false,
            "reference_publication_status": "published",
            "claimable": true,
            "source_dataset": source_key,
            "source_provider": provider_name,
            "source_title": provider_name,
            "source_url": source_record_url.as_deref().unwrap_or(&source_url),
            "source_license": effective_license,
            "source_license_url": source_license_url,
            "source_attribution": record_attribution.or(source_attribution),
            "external_id": source_record_id,
            "entity_id": entity_id,
            "source_id": source_id,
            "source_record_id": source_record_id,
            "canonical_record_id": canonical_record_id,
            "latitude": lat,
            "longitude": lon,
            "city": city,
            "province": province,
            "address": address,
            "category": "umkm_reference",
            "trust_note": "Data referensi dari sumber terdaftar; bukan verifikasi kepemilikan."
        });

        let inserted = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO content_items (
              owner_id, content_type, slug, title, summary, body,
              pricing_mode, currency, tags, category, content_status,
              metadata, listing_status, listing_intent, current_step,
              completion_percentage, last_saved_at, published_at
            ) VALUES (
              NULL, 'profile', $1, $2, $3, $4,
              'fixed', 'IDR', ARRAY['reference','umkm']::text[], 'umkm_reference', 'active',
              $5, 'published', 'offer', 1, 100, NOW(), NOW()
            )
            ON CONFLICT DO NOTHING
            RETURNING id
            "#,
        )
        .bind(&slug)
        .bind(&name)
        .bind(format!("Referensi usaha dari {provider_name}."))
        .bind(body)
        .bind(metadata)
        .fetch_optional(&mut *tx)
        .await?;

        match inserted {
            Some(id) => id,
            None => sqlx::query_scalar::<_, Uuid>(
                r#"
                    SELECT id FROM content_items
                    WHERE content_status <> 'deleted'
                      AND metadata->>'reference_publication_status' = 'published'
                      AND metadata->>'source_dataset' = $1
                      AND metadata->>'external_id' = $2
                    LIMIT 1
                    "#,
            )
            .bind(&source_key)
            .bind(&source_record_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| anyhow!("reference slug collision requires a new slug"))?,
        }
    };

    sqlx::query(
        r#"
        UPDATE data_import_records
        SET target_content_id=$2, updated_at=NOW()
        WHERE id=$1
        "#,
    )
    .bind(canonical_record_id)
    .bind(content_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE reference_promotion_candidates
        SET proposed_content_id=$2,
            promotion_status='promoted',
            updated_at=NOW()
        WHERE id=$1 AND promotion_status='approved'
        "#,
    )
    .bind(candidate_id)
    .bind(content_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(json!({
        "promoted": true,
        "idempotent": false,
        "candidate_id": candidate_id,
        "entity_id": entity_id,
        "content_id": content_id
    }))
}

#[derive(serde::Deserialize)]
struct ReviewPromotionRequest {
    decision: String,
    review_note: Option<String>,
}

async fn list_candidates(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let Some(claims) = auth_claims_from_headers(&headers, &state.jwt_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"unauthorized"})),
        )
            .into_response();
    };
    if !has_agent_access(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"agent role required"})),
        )
            .into_response();
    }
    match sqlx::query(
        r#"SELECT id, entity_id, source_id, proposed_content_id, promotion_status,
                   readiness_score, blocking_reasons, provenance_snapshot,
                   reviewed_by, reviewed_at, review_note, created_at, updated_at
            FROM reference_promotion_candidates
            ORDER BY CASE promotion_status WHEN 'pending_review' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END,
                     readiness_score DESC, created_at DESC
            LIMIT 200"#
    ).fetch_all(&state.db).await {
        Ok(rows) => {
            let items = rows.into_iter().map(|row| json!({
                "id": row.try_get::<Uuid,_>("id").ok(),
                "entity_id": row.try_get::<Uuid,_>("entity_id").ok(),
                "source_id": row.try_get::<Uuid,_>("source_id").ok(),
                "proposed_content_id": row.try_get::<Option<Uuid>,_>("proposed_content_id").ok().flatten(),
                "promotion_status": row.try_get::<String,_>("promotion_status").ok(),
                "readiness_score": row.try_get::<f64,_>("readiness_score").ok(),
                "blocking_reasons": row.try_get::<Value,_>("blocking_reasons").ok(),
                "provenance_snapshot": row.try_get::<Value,_>("provenance_snapshot").ok(),
                "review_note": row.try_get::<Option<String>,_>("review_note").ok().flatten(),
            })).collect::<Vec<_>>();
            (StatusCode::OK, Json(json!({"items":items}))).into_response()
        }
        Err(error) => {
            tracing::error!("list promotion candidates failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to load promotion candidates"}))).into_response()
        }
    }
}

async fn review_candidate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(candidate_id): Path<Uuid>,
    Json(payload): Json<ReviewPromotionRequest>,
) -> impl IntoResponse {
    let Some(claims) = auth_claims_from_headers(&headers, &state.jwt_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"unauthorized"})),
        )
            .into_response();
    };
    let Some(reviewer_id) = Uuid::parse_str(&claims.sub).ok() else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid reviewer identity"})),
        )
            .into_response();
    };
    if !has_agent_access(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"agent role required"})),
        )
            .into_response();
    }
    let decision = match payload.decision.trim() {
        "approved" => "approved",
        "rejected" => "rejected",
        "blocked" => "blocked",
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"decision must be approved, rejected, or blocked"})),
            )
                .into_response()
        }
    };
    if decision == "approved" {
        let blocked = match sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM reference_promotion_candidates WHERE id=$1 AND (jsonb_array_length(blocking_reasons) > 0 OR readiness_score < 0.70)"
        ).bind(candidate_id).fetch_one(&state.db).await {
            Ok(value) => value,
            Err(error) => {
                tracing::error!("promotion candidate validation failed: {:?}", error);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to validate promotion candidate"}))).into_response();
            }
        };
        if blocked > 0 {
            return (StatusCode::CONFLICT, Json(json!({"error":"candidate has unresolved blocking reasons or insufficient readiness","code":"candidate_blocked"}))).into_response();
        }
    }
    match sqlx::query(
        r#"UPDATE reference_promotion_candidates
            SET promotion_status=$2, reviewed_by=$3, reviewed_at=NOW(),
                review_note=$4, updated_at=NOW()
            WHERE id=$1 AND promotion_status NOT IN ('promoted')
            RETURNING id, promotion_status, reviewed_at"#,
    )
    .bind(candidate_id)
    .bind(decision)
    .bind(reviewer_id)
    .bind(
        payload
            .review_note
            .map(|v| v.trim().chars().take(4000).collect::<String>()),
    )
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => (
            StatusCode::OK,
            Json(json!({
                "id":row.try_get::<Uuid,_>("id").ok(),
                "promotion_status":row.try_get::<String,_>("promotion_status").ok(),
                "reviewed_at":row.try_get::<chrono::DateTime<chrono::Utc>,_>("reviewed_at").ok()
            })),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"candidate not found or already promoted"})),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("review promotion candidate failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"failed to review promotion candidate"})),
            )
                .into_response()
        }
    }
}

async fn promote(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(candidate_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(claims) = auth_claims_from_headers(&headers, &state.jwt_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"unauthorized"})),
        )
            .into_response();
    };
    if !has_agent_access(&claims) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error":"agent role required"})),
        )
            .into_response();
    }

    match promote_candidate(&state.db, candidate_id).await {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(error) => {
            tracing::error!("promote reference candidate failed: {:?}", error);
            let message = error.to_string();
            let status = if message.contains("not found") {
                StatusCode::NOT_FOUND
            } else if message.contains("must be approved")
                || message.contains("below promotion")
                || message.contains("requires review")
                || message.contains("not currently enabled/approved")
                || message.contains("license is missing")
                || message.contains("canonical imported record")
            {
                StatusCode::CONFLICT
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            (
                status,
                Json(json!({"error":"failed to promote reference candidate","detail":message})),
            )
                .into_response()
        }
    }
}

pub fn router() -> axum::Router<Arc<AppState>> {
    axum::Router::new()
        .route(
            "/v1/data/entities/{entity_id}/promotion-candidate",
            axum::routing::post(generate),
        )
        .route(
            "/v1/data/promotion-candidates",
            axum::routing::get(list_candidates),
        )
        .route(
            "/v1/data/promotion-candidates/{candidate_id}/review",
            axum::routing::post(review_candidate),
        )
        .route(
            "/v1/data/promotion-candidates/{candidate_id}/promote",
            axum::routing::post(promote),
        )
}

#[cfg(test)]
mod tests {
    #[test]
    fn score_entity_allows_missing_address_for_geocoded_reference() {
        let (score, reasons) = score_entity(
            Some("Toko Contoh"),
            None,
            Some("jakarta"),
            Some("dki jakarta"),
            Some(-6.2),
            Some(106.8),
            "new",
        );
        assert!(score >= 0.8);
        assert!(!reasons.iter().any(|reason| reason == "missing_address"));
    }

    use super::*;

    #[test]
    fn slug_is_deterministic_and_has_entity_suffix() {
        let id = Uuid::parse_str("12345678-1234-1234-1234-123456789abc").unwrap();
        let slug = slugify_reference("Toko Maju!", Some("Bandung"), id);
        assert_eq!(slug, "toko-maju-bandung-12345678");
    }

    #[test]
    fn empty_reference_name_falls_back_to_entity_slug() {
        let id = Uuid::parse_str("abcdef12-1234-1234-1234-123456789abc").unwrap();
        assert_eq!(
            slugify_reference("!!!", None, id),
            "reference-abcdef12-1234-1234-1234-123456789abc"
        );
    }

    #[test]
    fn reference_body_contains_only_supplied_facts() {
        let body = reference_body(
            "Toko Maju",
            Some("Jl. Contoh 1"),
            Some("Bandung"),
            Some("Jawa Barat"),
        );
        assert!(body.contains("Toko Maju"));
        assert!(body.contains("Jl. Contoh 1"));
        assert!(body.contains("Bandung"));
        assert!(body.contains("Jawa Barat"));
        assert!(!body.contains("rating"));
    }
}
