use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use super::{auth::user_id_from_auth, AppState};

#[derive(Debug, Deserialize)]
pub struct CreateMarketSignal {
    pub signal_type: Option<String>,
    pub amount_cents: Option<i64>,
    pub currency: Option<String>,
    pub quantity: Option<f64>,
    pub quantity_unit: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Serialize)]
struct SignalSummary {
    signal_side: String,
    sample_count: i64,
    median_amount_cents: Option<i64>,
    p25_amount_cents: Option<i64>,
    p75_amount_cents: Option<i64>,
}

fn clean_text(value: Option<&str>, max: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.chars().take(max).collect())
}

fn normalize_signal_type(value: Option<&str>) -> &'static str {
    match value.unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "inquiry" => "inquiry",
        "price_indication" => "price_indication",
        _ => "negotiation",
    }
}

fn median(mut values: Vec<i64>) -> Option<i64> {
    if values.is_empty() {
        return None;
    }
    values.sort_unstable();
    let middle = values.len() / 2;
    if values.len() % 2 == 0 {
        Some(((values[middle - 1] as i128 + values[middle] as i128) / 2) as i64)
    } else {
        Some(values[middle])
    }
}

fn percentile(mut values: Vec<i64>, p: f64) -> Option<i64> {
    if values.is_empty() {
        return None;
    }
    values.sort_unstable();
    let position = (values.len() - 1) as f64 * p.clamp(0.0, 1.0);
    let lower = position.floor() as usize;
    let upper = position.ceil() as usize;
    if lower == upper {
        return Some(values[lower]);
    }
    let weight = position - lower as f64;
    Some(
        ((values[lower] as f64 * (1.0 - weight)) + (values[upper] as f64 * weight))
            .round() as i64,
    )
}

pub async fn create_market_signal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(content_id): Path<Uuid>,
    Json(payload): Json<CreateMarketSignal>,
) -> impl IntoResponse {
    let Some(actor_id) = user_id_from_auth(&headers, &state.jwt_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "unauthorized"})),
        )
            .into_response();
    };

    if payload.amount_cents.is_some_and(|v| v <= 0) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "amount_cents must be positive"})),
        )
            .into_response();
    }

    if payload.quantity.is_some_and(|v| !v.is_finite() || v <= 0.0) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "quantity must be positive"})),
        )
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, owner_id, content_type, category, price_unit, currency,
               price_cents, COALESCE(metadata, '{}'::jsonb) AS metadata
        FROM content_items
        WHERE id = $1 AND content_status = 'active'
        LIMIT 1
        "#,
    )
    .bind(content_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "listing not found"})),
            )
                .into_response();
        }
        Err(error) => {
            tracing::warn!("market signal content lookup failed: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "market signal unavailable"})),
            )
                .into_response();
        }
    };

    let owner_id: Uuid = row.get("owner_id");
    if owner_id == actor_id {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "cannot signal your own listing"})),
        )
            .into_response();
    }

    let metadata = row.get::<serde_json::Value, _>("metadata");
    let listing_side = {
        let candidates = [
            metadata.get("listing_side").and_then(|v| v.as_str()),
            metadata.get("market_side").and_then(|v| v.as_str()),
            metadata.get("listing_intent").and_then(|v| v.as_str()),
            metadata.get("market_intent").and_then(|v| v.as_str()),
            metadata.get("intent").and_then(|v| v.as_str()),
        ];
        let demand = candidates.iter().flatten().any(|v| {
            matches!(
                v.trim().to_ascii_lowercase().as_str(),
                "demand" | "seeker" | "need" | "needed" | "request" | "buyer"
            )
        });
        if demand { "demand" } else { "supply" }
    };

    // A response to a supply listing is a demand-side signal.
    // A response to a demand listing is a supply-side signal.
    let signal_side = if listing_side == "demand" { "supply" } else { "demand" };

    let metadata_city = metadata
        .get("city")
        .and_then(|v| v.as_str())
        .or_else(|| metadata.get("location").and_then(|v| v.as_str()))
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty());

    let category = row
        .get::<Option<String>, _>("category")
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty());
    let price_unit = row
        .get::<Option<String>, _>("price_unit")
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty());
    let currency = payload
        .currency
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_uppercase)
        .or_else(|| {
            row.get::<Option<String>, _>("currency")
                .map(|value| value.trim().to_ascii_uppercase())
        })
        .unwrap_or_else(|| "IDR".to_string());
    let signal_type = normalize_signal_type(payload.signal_type.as_deref());
    let source = clean_text(payload.source.as_deref(), 64).unwrap_or_else(|| "content_detail".to_string());
    let quantity_unit = clean_text(payload.quantity_unit.as_deref(), 32);
    let idempotency_key = headers
        .get("x-idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| clean_text(Some(v), 160));

    let insert = sqlx::query(
        r#"
        INSERT INTO market_negotiation_signals
          (content_id, actor_id, signal_side, signal_type, amount_cents, currency,
           quantity, quantity_unit, city, category, price_unit, source, idempotency_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id, created_at
        "#,
    )
    .bind(content_id)
    .bind(actor_id)
    .bind(signal_side)
    .bind(signal_type)
    .bind(payload.amount_cents)
    .bind(&currency)
    .bind(payload.quantity)
    .bind(quantity_unit)
    .bind(metadata_city)
    .bind(category)
    .bind(price_unit)
    .bind(source)
    .bind(idempotency_key)
    .fetch_optional(&state.db)
    .await;

    match insert {
        Ok(Some(row)) => (
            StatusCode::CREATED,
            Json(json!({
                "id": row.get::<Uuid, _>("id"),
                "content_id": content_id,
                "signal_side": signal_side,
                "signal_type": signal_type,
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "message": "Negotiation signal recorded"
            })),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::OK,
            Json(json!({
                "content_id": content_id,
                "signal_side": signal_side,
                "signal_type": signal_type,
                "deduplicated": true
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::warn!("market signal insert failed: {:?}", error);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to record market signal"})),
            )
                .into_response()
        }
    }
}

pub async fn market_signal_summary(
    state: &Arc<AppState>,
    category: Option<&str>,
    city: Option<&str>,
    price_unit: Option<&str>,
    currency: &str,
    days: i64,
) -> Result<Vec<SignalSummary>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT signal_side, amount_cents
        FROM market_negotiation_signals
        WHERE created_at >= NOW() - ($1::text || ' days')::interval
          AND currency = $2
          AND amount_cents IS NOT NULL
          AND amount_cents > 0
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR city = $4)
          AND ($5::text IS NULL OR price_unit = $5)
        ORDER BY created_at DESC
        LIMIT 5000
        "#,
    )
    .bind(days.clamp(1, 90))
    .bind(currency)
    .bind(category)
    .bind(city)
    .bind(price_unit)
    .fetch_all(&state.db)
    .await?;

    let mut grouped = std::collections::HashMap::<String, Vec<i64>>::new();
    for row in rows {
        grouped
            .entry(row.get::<String, _>("signal_side"))
            .or_default()
            .push(row.get::<i64, _>("amount_cents"));
    }

    Ok(grouped
        .into_iter()
        .map(|(signal_side, values)| SignalSummary {
            signal_side,
            sample_count: values.len() as i64,
            median_amount_cents: median(values.clone()),
            p25_amount_cents: percentile(values.clone(), 0.25),
            p75_amount_cents: percentile(values, 0.75),
        })
        .collect())
}
