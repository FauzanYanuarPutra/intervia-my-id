//! Lajukan Market Intelligence.
//!
//! This is deliberately a robust statistical engine first: current listing prices
//! are aggregated by comparable market (category + city + price unit), outliers are
//! filtered with median/MAD, and concentration/change signals are surfaced as alerts.
//! An LLM can later explain/rerank these signals without becoming the source of truth.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::{collections::HashMap, env, sync::Arc};
use uuid::Uuid;

use super::{auth_claims_from_headers, AppState};

const MAX_OBSERVATIONS: i64 = 1500;
const MIN_CONFIDENT_SAMPLE: usize = 8;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct MarketQuery {
    pub city: Option<String>,
    pub category: Option<String>,
    pub price_unit: Option<String>,
    pub days: Option<i64>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PriceObservation {
    content_id: Uuid,
    owner_id: Uuid,
    price_cents: i64,
    currency: String,
    price_unit: Option<String>,
    category: Option<String>,
    city: Option<String>,
    observed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct MarketStats {
    currency: String,
    price_unit: Option<String>,
    raw_sample_count: usize,
    clean_sample_count: usize,
    filtered_outlier_count: usize,
    median_cents: Option<i64>,
    mean_cents: Option<i64>,
    p25_cents: Option<i64>,
    p75_cents: Option<i64>,
    robust_spread_cents: Option<i64>,
    lower_band_cents: Option<i64>,
    upper_band_cents: Option<i64>,
    seller_count: usize,
    top_seller_share_percent: f64,
    dominant_price_share_percent: f64,
    confidence: String,
}

fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty())
}

fn city_from(metadata: &Value) -> Option<String> {
    for key in ["city", "location_text", "location", "service_area"] {
        if let Some(value) = metadata.get(key).and_then(Value::as_str) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_ascii_lowercase());
            }
        }
    }
    None
}

fn category_from(category: Option<&str>, metadata: &Value) -> Option<String> {
    for key in [
        "marketplace_category_slug",
        "marketplace_category",
        "create_category",
        "category",
        "discovery_category",
    ] {
        if let Some(value) = metadata.get(key).and_then(Value::as_str) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_ascii_lowercase());
            }
        }
    }
    category
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty())
}

fn median(values: &[i64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut values = values.to_vec();
    values.sort_unstable();
    let middle = values.len() / 2;
    Some(if values.len() % 2 == 0 {
        (values[middle - 1] as f64 + values[middle] as f64) / 2.0
    } else {
        values[middle] as f64
    })
}

fn percentile(values: &[i64], p: f64) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut values = values.to_vec();
    values.sort_unstable();
    if values.len() == 1 {
        return Some(values[0] as f64);
    }
    let position = (values.len() - 1) as f64 * p.clamp(0.0, 1.0);
    let lower = position.floor() as usize;
    let upper = position.ceil() as usize;
    if lower == upper {
        Some(values[lower] as f64)
    } else {
        let weight = position - lower as f64;
        Some(values[lower] as f64 * (1.0 - weight) + values[upper] as f64 * weight)
    }
}

fn rounded(value: Option<f64>) -> Option<i64> {
    value.map(|v| v.round() as i64)
}

fn robust_clean_prices(raw: &[i64]) -> (Vec<i64>, Option<f64>, Option<f64>) {
    let Some(center) = median(raw) else {
        return (Vec::new(), None, None);
    };
    let deviations = raw
        .iter()
        .map(|value| (*value as f64 - center).abs().round() as i64)
        .collect::<Vec<_>>();
    let mad = median(&deviations).unwrap_or(0.0);
    let scaled_mad = mad * 1.4826;
    // When MAD collapses to zero (many identical prices), retain a relative
    // tolerance rather than accidentally deleting every legitimate variant.
    let threshold = if scaled_mad > 0.0 {
        (scaled_mad * 3.0).max(center * 0.20)
    } else {
        center * 0.15
    };
    let clean = raw
        .iter()
        .copied()
        .filter(|value| (*value as f64 - center).abs() <= threshold)
        .collect::<Vec<_>>();
    (clean, Some(center), Some(scaled_mad))
}

fn stats(observations: &[PriceObservation]) -> Option<MarketStats> {
    let raw = observations
        .iter()
        .map(|v| v.price_cents)
        .collect::<Vec<_>>();
    if raw.is_empty() {
        return None;
    }
    let (clean, _center, robust_spread) = robust_clean_prices(&raw);
    if clean.is_empty() {
        return None;
    }

    let sum = clean.iter().fold(0i128, |acc, value| acc + *value as i128);
    let mean = sum as f64 / clean.len() as f64;
    let median = median(&clean);
    let p25 = percentile(&clean, 0.25);
    let p75 = percentile(&clean, 0.75);

    let mut owners = HashMap::<Uuid, usize>::new();
    for observation in observations {
        if clean.contains(&observation.price_cents) {
            *owners.entry(observation.owner_id).or_insert(0) += 1;
        }
    }
    let top_seller_share = owners
        .values()
        .copied()
        .max()
        .map(|count| count as f64 / clean.len() as f64 * 100.0)
        .unwrap_or(0.0);

    let mut price_frequency = HashMap::<i64, usize>::new();
    for value in &clean {
        *price_frequency.entry(*value).or_insert(0) += 1;
    }
    let dominant_price_share = price_frequency
        .values()
        .copied()
        .max()
        .map(|count| count as f64 / clean.len() as f64 * 100.0)
        .unwrap_or(0.0);

    let confidence = if clean.len() >= 20 {
        "high"
    } else if clean.len() >= MIN_CONFIDENT_SAMPLE {
        "medium"
    } else {
        "low"
    };

    let currency = observations
        .first()
        .map(|v| v.currency.clone())
        .unwrap_or_else(|| "IDR".to_string());

    Some(MarketStats {
        currency,
        price_unit: observations.first().and_then(|v| v.price_unit.clone()),
        raw_sample_count: raw.len(),
        clean_sample_count: clean.len(),
        filtered_outlier_count: raw.len().saturating_sub(clean.len()),
        median_cents: rounded(median),
        mean_cents: rounded(Some(mean)),
        p25_cents: rounded(p25),
        p75_cents: rounded(p75),
        robust_spread_cents: rounded(robust_spread),
        lower_band_cents: rounded(median.map(|v| v - robust_spread.unwrap_or(0.0) * 2.5)),
        upper_band_cents: rounded(median.map(|v| v + robust_spread.unwrap_or(0.0) * 2.5)),
        seller_count: owners.len(),
        top_seller_share_percent: (top_seller_share * 10.0).round() / 10.0,
        dominant_price_share_percent: (dominant_price_share * 10.0).round() / 10.0,
        confidence: confidence.to_string(),
    })
}

fn price_alert(source_price: Option<i64>, market: &MarketStats) -> Value {
    let Some(price) = source_price else {
        return json!({
            "level": "info",
            "code": "no_source_price",
            "message": "Listing ini belum punya harga tetap, jadi belum bisa dibandingkan dengan pasar."
        });
    };
    let Some(median) = market.median_cents else {
        return json!({
            "level": "info",
            "code": "insufficient_market_data",
            "message": "Data pembanding pasar belum cukup."
        });
    };

    let deviation_percent = ((price as f64 - median as f64) / median.max(1) as f64) * 100.0;
    let level = if deviation_percent.abs() >= 40.0 {
        "high"
    } else if deviation_percent.abs() >= 20.0 {
        "medium"
    } else {
        "normal"
    };

    let direction = if deviation_percent > 0.0 {
        "above"
    } else {
        "below"
    };
    json!({
        "level": level,
        "code": if level == "normal" { "within_market_range" } else { "price_outlier" },
        "direction": direction,
        "deviation_percent": (deviation_percent * 10.0).round() / 10.0,
        "message": if level == "normal" {
            "Harga masih berada dalam rentang pasar yang terdeteksi."
        } else if direction == "above" {
            "Harga terlihat lebih tinggi dari pusat pasar. Cek kualitas, spesifikasi, ongkir, dan kondisi barang sebelum menyimpulkan harga tidak wajar."
        } else {
            "Harga terlihat lebih rendah dari pusat pasar. Cek kualitas, spesifikasi, stok, dan kemungkinan harga promosi sebelum menyimpulkan ada masalah."
        }
    })
}

async fn current_observations(
    state: &Arc<AppState>,
    source_id: Uuid,
    query: &MarketQuery,
) -> Result<(PriceObservation, Vec<PriceObservation>), sqlx::Error> {
    let source = sqlx::query(
        r#"
        SELECT id, owner_id, price_cents, currency, price_unit, category,
               COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
        FROM content_items
        WHERE id = $1 AND content_status = 'active'
        LIMIT 1
        "#,
    )
    .bind(source_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| sqlx::Error::RowNotFound)?;

    let source_metadata: Value = source.get("metadata");
    let source_category = category_from(
        source.get::<Option<String>, _>("category").as_deref(),
        &source_metadata,
    );
    let source_city = city_from(&source_metadata);
    let source_unit = source.get::<Option<String>, _>("price_unit");

    let source_observation = PriceObservation {
        content_id: source.get("id"),
        owner_id: source.get("owner_id"),
        price_cents: source.get::<Option<i64>, _>("price_cents").unwrap_or(0),
        currency: source
            .get::<Option<String>, _>("currency")
            .unwrap_or_else(|| "IDR".to_string()),
        price_unit: source_unit.clone(),
        category: source_category.clone(),
        city: source_city.clone(),
        observed_at: source.get("updated_at"),
    };

    let rows = sqlx::query(
        r#"
        SELECT id, owner_id, price_cents, currency, price_unit, category,
               COALESCE(metadata, '{}'::jsonb) AS metadata, updated_at
        FROM content_items
        WHERE content_status = 'active'
          AND price_cents IS NOT NULL
          AND price_cents > 0
          AND pricing_mode = 'fixed'
          AND id <> $1
          AND content_type NOT IN ('request', 'news')
        ORDER BY updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(source_id)
    .bind(MAX_OBSERVATIONS)
    .fetch_all(&state.db)
    .await?;

    let scope = clean(query.scope.clone()).unwrap_or_else(|| "auto".to_string());
    let target_city = if scope == "national" {
        None
    } else {
        clean(query.city.clone()).or(source_city)
    };
    let target_category = clean(query.category.clone()).or(source_category);
    let target_unit = clean(query.price_unit.clone()).or(source_unit);
    let target_currency = source_observation.currency.to_ascii_uppercase();

    let mut observations = Vec::with_capacity(rows.len());
    for row in rows {
        let metadata: Value = row.get("metadata");
        let category = category_from(
            row.get::<Option<String>, _>("category").as_deref(),
            &metadata,
        );
        let city = city_from(&metadata);
        let unit = row.get::<Option<String>, _>("price_unit");
        let currency = row
            .get::<Option<String>, _>("currency")
            .unwrap_or_else(|| "IDR".to_string())
            .to_ascii_uppercase();

        if currency != target_currency
            || target_category
                .as_deref()
                .is_some_and(|v| category.as_deref() != Some(v))
            || target_city
                .as_deref()
                .is_some_and(|v| city.as_deref() != Some(v))
            || target_unit
                .as_deref()
                .is_some_and(|v| unit.as_deref() != Some(v))
        {
            continue;
        }

        observations.push(PriceObservation {
            content_id: row.get("id"),
            owner_id: row.get("owner_id"),
            price_cents: row.get("price_cents"),
            currency,
            price_unit: unit,
            category,
            city,
            observed_at: row.get("updated_at"),
        });
    }

    Ok((source_observation, observations))
}

async fn historical_trend(
    state: &Arc<AppState>,
    category: Option<&str>,
    city: Option<&str>,
    price_unit: Option<&str>,
    currency: &str,
    days: i64,
) -> Result<Vec<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT observed_at::date AS day, price_cents
        FROM crm_market_price_snapshots
        WHERE observed_at >= NOW() - ($1::text || ' days')::interval
          AND currency = $2
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR city = $4)
          AND ($5::text IS NULL OR price_unit = $5)
        ORDER BY observed_at ASC
        "#,
    )
    .bind(days.clamp(1, 90))
    .bind(currency)
    .bind(category)
    .bind(city)
    .bind(price_unit)
    .fetch_all(&state.db)
    .await?;

    let mut grouped: HashMap<NaiveDate, Vec<i64>> = HashMap::new();
    for row in rows {
        grouped
            .entry(row.get("day"))
            .or_default()
            .push(row.get("price_cents"));
    }

    let mut days = grouped.into_iter().collect::<Vec<_>>();
    days.sort_by_key(|(day, _)| *day);
    Ok(days
        .into_iter()
        .map(|(day, prices)| {
            let (clean_prices, _, _) = robust_clean_prices(&prices);
            json!({
                "date": day,
                "sample_count": prices.len(),
                "clean_sample_count": clean_prices.len(),
                "median_cents": rounded(median(&clean_prices)),
            })
        })
        .collect())
}

async fn source_history_signal(
    state: &Arc<AppState>,
    source_id: Uuid,
) -> Result<Option<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT price_cents, observed_at
        FROM crm_market_price_snapshots
        WHERE content_id = $1
        ORDER BY observed_at DESC
        LIMIT 8
        "#,
    )
    .bind(source_id)
    .fetch_all(&state.db)
    .await?;

    if rows.len() < 2 {
        return Ok(None);
    }
    let newest = rows[0].get::<i64, _>("price_cents");
    let previous = rows[1].get::<i64, _>("price_cents");
    let change = (newest as f64 - previous as f64) / previous.max(1) as f64 * 100.0;
    if change.abs() < 20.0 {
        return Ok(None);
    }
    Ok(Some(json!({
        "level": if change.abs() >= 40.0 { "high" } else { "medium" },
        "code": "rapid_price_change",
        "change_percent": (change * 10.0).round() / 10.0,
        "message": "Harga listing berubah cukup besar dibanding snapshot sebelumnya. Ini bukan bukti manipulasi; cek perubahan stok, spesifikasi, promo, atau kondisi pasar."
    })))
}

async fn build_market_response(
    state: &Arc<AppState>,
    source_id: Uuid,
    query: MarketQuery,
) -> Result<Value, (StatusCode, String)> {
    let (source, mut observations) = current_observations(state, source_id, &query)
        .await
        .map_err(|error| {
            tracing::warn!("market intelligence source lookup failed: {:?}", error);
            (StatusCode::NOT_FOUND, "listing not found".to_string())
        })?;

    let mut benchmark_scope = if query.scope.as_deref() == Some("national") {
        "national"
    } else {
        "local"
    };

    // Auto mode starts with the user's local market. If there is not enough
    // evidence, widen to the national category market instead of showing a
    // misleadingly tiny benchmark.
    if observations.len() < MIN_CONFIDENT_SAMPLE
        && query.scope.as_deref().unwrap_or("auto") == "auto"
        && source.category.is_some()
    {
        let mut national_query = query.clone();
        national_query.city = None;
        national_query.scope = Some("national".to_string());
        let (_, national_observations) = current_observations(state, source_id, &national_query)
            .await
            .map_err(|error| {
                tracing::warn!("national market fallback failed: {:?}", error);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "market benchmark unavailable".to_string(),
                )
            })?;
        if national_observations.len() > observations.len() {
            observations = national_observations;
            benchmark_scope = "national_fallback";
        }
    }

    if source.price_cents <= 0 {
        return Ok(json!({
            "source_id": source.content_id,
            "market": null,
            "alerts": [{
                "level": "info",
                "code": "no_fixed_price",
                "message": "Listing belum memakai harga tetap. Market benchmark akan tersedia setelah ada harga."
            }],
            "intelligence": {
                "name": "Lajukan Market Intelligence",
                "version": "market-robust-v1",
                "mode": "robust_statistics",
                "ai_ready": true
            }
        }));
    }

    let market = stats(&observations);
    let Some(market) = market else {
        return Ok(json!({
            "source_id": source.content_id,
            "market": null,
            "alerts": [{
                "level": "info",
                "code": "insufficient_market_data",
                "message": "Belum ada cukup listing pembanding dengan kategori, lokasi, unit, dan mata uang yang sama."
            }],
            "intelligence": {
                "name": "Lajukan Market Intelligence",
                "version": "market-robust-v1",
                "mode": "robust_statistics",
                "ai_ready": true
            }
        }));
    };

    let category = source.category.as_deref();
    let city = source.city.as_deref();
    let unit = source.price_unit.as_deref();
    let days = query.days.unwrap_or(30).clamp(1, 90);
    let trend = historical_trend(state, category, city, unit, &source.currency, days)
        .await
        .unwrap_or_default();
    let history_alert = source_history_signal(state, source.content_id)
        .await
        .unwrap_or(None);

    let mut alerts = Vec::<Value>::new();
    let source_alert = price_alert(Some(source.price_cents), &market);
    let price_position = source_alert
        .get("direction")
        .and_then(Value::as_str)
        .unwrap_or("within");
    if source_alert.get("level").and_then(Value::as_str) != Some("normal") {
        alerts.push(source_alert);
    }
    if market.top_seller_share_percent >= 60.0 && market.seller_count >= 2 {
        alerts.push(json!({
            "level": "medium",
            "code": "seller_concentration",
            "message": "Data pasar cukup terkonsentrasi pada sedikit penjual. Benchmark ini perlu dibaca lebih hati-hati karena belum tentu mewakili seluruh pasar.",
            "top_seller_share_percent": market.top_seller_share_percent
        }));
    }
    if market.dominant_price_share_percent >= 60.0 && market.seller_count >= 3 {
        alerts.push(json!({
            "level": "medium",
            "code": "price_pattern_concentration",
            "message": "Banyak listing memakai harga yang sama persis. Ini bisa normal, tetapi bila tidak sesuai kondisi pasar sebaiknya diverifikasi dengan sumber lain.",
            "dominant_price_share_percent": market.dominant_price_share_percent
        }));
    }
    if market.filtered_outlier_count > 0 {
        alerts.push(json!({
            "level": "info",
            "code": "outliers_filtered",
            "message": format!("{} harga ekstrem dikeluarkan dari benchmark agar tidak menggeser pusat pasar.", market.filtered_outlier_count),
            "count": market.filtered_outlier_count
        }));
    }
    if market.confidence == "low" {
        alerts.push(json!({
            "level": "medium",
            "code": "low_sample_confidence",
            "message": "Sampel pasar masih sedikit. Jangan anggap angka ini sebagai harga pasar final."
        }));
    }
    if let Some(history_alert) = history_alert {
        alerts.push(history_alert);
    }

    let trend_summary = if trend.len() >= 2 {
        let first = trend
            .first()
            .and_then(|v| v.get("median_cents"))
            .and_then(Value::as_i64);
        let last = trend
            .last()
            .and_then(|v| v.get("median_cents"))
            .and_then(Value::as_i64);
        match (first, last) {
            (Some(first), Some(last)) if first > 0 => {
                let change = (last as f64 - first as f64) / first as f64 * 100.0;
                Some(json!({
                    "direction": if change > 3.0 { "up" } else if change < -3.0 { "down" } else { "stable" },
                    "change_percent": (change * 10.0).round() / 10.0,
                    "first_median_cents": first,
                    "last_median_cents": last
                }))
            }
            _ => None,
        }
    } else {
        None
    };

    Ok(json!({
        "source_id": source.content_id,
        "scope": {
            "level": benchmark_scope,
            "city": if benchmark_scope == "national" || benchmark_scope == "national_fallback" { None } else { city },
            "category": category,
            "price_unit": unit,
            "currency": source.currency
        },
        "source": {
            "price_cents": source.price_cents
        },
        "market": market,
        "trend": {
            "days": days,
            "summary": trend_summary,
            "daily": trend
        },
        "insight": {
            "price_position": price_position,
            "headline": match price_position {
                "above" => "Harga listing berada di atas pusat pasar.",
                "below" => "Harga listing berada di bawah pusat pasar.",
                _ => "Harga listing masih dekat dengan pusat pasar."
            },
            "action": match price_position {
                "above" => "Cek kualitas, spesifikasi, ongkir, dan kondisi barang sebelum mengubah harga.",
                "below" => "Cek stok, kualitas, promo, dan biaya sebelum menaikkan harga.",
                _ => "Tidak ada sinyal harga besar yang perlu ditindaklanjuti."
            }
        },
        "alerts": alerts,
        "intelligence": {
            "name": "Lajukan Market Intelligence",
            "version": "market-robust-v1",
            "mode": "robust_statistics",
            "ai_ready": true,
            "explanation": "Benchmark memakai median + MAD dan tidak menjadikan satu harga ekstrem sebagai pusat pasar."
        }
    }))
}

fn authorized(headers: &HeaderMap, state: &Arc<AppState>) -> bool {
    if auth_claims_from_headers(headers, &state.jwt_secret).is_some() {
        return true;
    }

    let ai_tool = headers
        .get("x-lajukan-ai-tool")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == "1");

    if !ai_tool {
        return false;
    }

    let expected = env::var("MARKETPLACE_SERVICE_TOKEN")
        .unwrap_or_default()
        .trim()
        .to_string();
    if expected.is_empty() {
        return false;
    }

    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|value| value.trim() == expected)
}

pub async fn market_intelligence(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(query): Query<MarketQuery>,
) -> impl IntoResponse {
    if !authorized(&headers, &state) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "unauthorized"})),
        )
            .into_response();
    }

    match build_market_response(&state, id, query).await {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err((status, message)) => (status, Json(json!({"error": message}))).into_response(),
    }
}

pub async fn record_price_snapshot(state: &Arc<AppState>, content_id: Uuid, owner_id: Uuid) {
    let row = match sqlx::query(
        r#"
        SELECT price_cents, currency, price_unit, category,
               COALESCE(metadata, '{}'::jsonb) AS metadata
        FROM content_items
        WHERE id = $1 AND owner_id = $2
          AND content_status = 'active'
          AND pricing_mode = 'fixed'
          AND price_cents IS NOT NULL
          AND price_cents > 0
        LIMIT 1
        "#,
    )
    .bind(content_id)
    .bind(owner_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return,
        Err(error) => {
            tracing::warn!("market snapshot lookup failed: {:?}", error);
            return;
        }
    };

    let metadata: Value = row.get("metadata");
    let category = category_from(
        row.get::<Option<String>, _>("category").as_deref(),
        &metadata,
    );
    let city = city_from(&metadata);
    let currency = row
        .get::<Option<String>, _>("currency")
        .unwrap_or_else(|| "IDR".to_string())
        .to_ascii_uppercase();
    let price = row.get::<i64, _>("price_cents");
    let unit = row.get::<Option<String>, _>("price_unit");

    let recent_same = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM crm_market_price_snapshots
        WHERE content_id = $1
          AND price_cents = $2
          AND observed_at >= NOW() - interval '6 hours'
        "#,
    )
    .bind(content_id)
    .bind(price)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    if recent_same > 0 {
        return;
    }

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO crm_market_price_snapshots
          (content_id, owner_id, price_cents, currency, price_unit, category, city)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(content_id)
    .bind(owner_id)
    .bind(price)
    .bind(currency)
    .bind(unit)
    .bind(category)
    .bind(city)
    .execute(&state.db)
    .await
    {
        tracing::warn!("market snapshot insert failed: {:?}", error);
    }
}
