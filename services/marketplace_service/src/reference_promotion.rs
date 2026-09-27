use axum::{extract::{Path, State}, http::{HeaderMap, StatusCode}, response::IntoResponse, Json};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::{auth::auth_claims_from_headers, has_agent_access, AppState};

fn score_entity(
    name: Option<&str>, address: Option<&str>, city: Option<&str>, province: Option<&str>,
    lat: Option<f64>, lon: Option<f64>, resolution_status: &str
) -> (f64, Vec<String>) {
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if name.is_some_and(|v| !v.trim().is_empty()) { score += 0.40; } else { reasons.push("missing_name"); }
    if address.is_some_and(|v| !v.trim().is_empty()) { score += 0.20; } else { reasons.push("missing_address"); }
    if city.is_some_and(|v| !v.trim().is_empty()) { score += 0.10; } else { reasons.push("missing_city"); }
    if province.is_some_and(|v| !v.trim().is_empty()) { score += 0.10; } else { reasons.push("missing_province"); }
    if lat.is_some() && lon.is_some() { score += 0.20; } else { reasons.push("missing_coordinates"); }
    if matches!(resolution_status, "possible_duplicate" | "needs_review") {
        reasons.push("entity_resolution_requires_review");
        score *= 0.5;
    }
    (score.min(1.0), reasons)
}

pub async fn generate_for_entity(
    db: &PgPool,
    entity_id: Uuid,
) -> Result<Value, sqlx::Error> {
    let entity = sqlx::query_as::<_, (
        Uuid, Uuid, Option<String>, Option<String>, Option<String>, Option<String>,
        Option<f64>, Option<f64>, String, Value
    )>(
        r#"SELECT id, source_id, normalized_name, normalized_address, city, province,
                   latitude, longitude, resolution_status, metadata
            FROM data_import_entities WHERE id=$1 LIMIT 1"#
    )
    .bind(entity_id)
    .fetch_optional(db)
    .await?;

    let Some((id, source_id, name, address, city, province, lat, lon, resolution_status, metadata)) = entity else {
        return Ok(json!({"found":false}));
    };

    let (score, reasons) = score_entity(
        name.as_deref(), address.as_deref(), city.as_deref(), province.as_deref(),
        lat, lon, &resolution_status
    );
    let status = if reasons.iter().any(|v| *v == "entity_resolution_requires_review") {
        "blocked"
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
               WHEN reference_promotion_candidates.promotion_status IN ('approved','promoted') THEN reference_promotion_candidates.promotion_status
               ELSE EXCLUDED.promotion_status END,
             readiness_score=EXCLUDED.readiness_score,
             blocking_reasons=EXCLUDED.blocking_reasons,
             provenance_snapshot=EXCLUDED.provenance_snapshot,
             updated_at=NOW()"#
    )
    .bind(id).bind(source_id).bind(status).bind(score)
    .bind(Value::Array(reasons.into_iter().map(Value::String).collect::<Vec<_>>()))
    .bind(provenance)
    .execute(db)
    .await?;

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
        return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response();
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }
    match generate_for_entity(&state.db, entity_id).await {
        Ok(value) if value.get("found").and_then(Value::as_bool) == Some(true) =>
            (StatusCode::OK, Json(value)).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error":"entity not found"}))).into_response(),
        Err(error) => {
            tracing::error!("generate promotion candidate failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to generate promotion candidate"}))).into_response()
        }
    }
}

pub fn router() -> axum::Router<Arc<AppState>> {
    axum::Router::new()
        .route("/v1/data/entities/{entity_id}/promotion-candidate", axum::routing::post(generate))
}
