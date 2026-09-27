use axum::{extract::{Path, State}, http::{HeaderMap, StatusCode}, response::IntoResponse, Json};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
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
        return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response();
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
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
        return (StatusCode::UNAUTHORIZED, Json(json!({"error":"unauthorized"}))).into_response();
    };
    let Some(reviewer_id) = Uuid::parse_str(&claims.sub).ok() else {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error":"invalid reviewer identity"}))).into_response();
    };
    if !has_agent_access(&claims) {
        return (StatusCode::FORBIDDEN, Json(json!({"error":"agent role required"}))).into_response();
    }
    let decision = match payload.decision.trim() {
        "approved" => "approved",
        "rejected" => "rejected",
        "blocked" => "blocked",
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error":"decision must be approved, rejected, or blocked"}))).into_response(),
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
            RETURNING id, promotion_status, reviewed_at"#
    ).bind(candidate_id).bind(decision).bind(reviewer_id)
     .bind(payload.review_note.map(|v| v.trim().chars().take(4000).collect::<String>()))
     .fetch_optional(&state.db).await {
        Ok(Some(row)) => (StatusCode::OK, Json(json!({
            "id":row.try_get::<Uuid,_>("id").ok(),
            "promotion_status":row.try_get::<String,_>("promotion_status").ok(),
            "reviewed_at":row.try_get::<chrono::DateTime<chrono::Utc>,_>("reviewed_at").ok()
        }))).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error":"candidate not found or already promoted"}))).into_response(),
        Err(error) => {
            tracing::error!("review promotion candidate failed: {:?}", error);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"failed to review promotion candidate"}))).into_response()
        }
    }
}

pub fn router() -> axum::Router<Arc<AppState>> {
    axum::Router::new()
        .route("/v1/data/entities/{entity_id}/promotion-candidate", axum::routing::post(generate))
        .route("/v1/data/promotion-candidates", axum::routing::get(list_candidates))
        .route("/v1/data/promotion-candidates/{candidate_id}/review", axum::routing::post(review_candidate))
}
