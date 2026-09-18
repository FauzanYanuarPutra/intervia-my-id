use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use std::{
    sync::atomic::{AtomicI64, AtomicU64, Ordering},
    time::Instant,
};
use tracing::Instrument;
use uuid::Uuid;

static HTTP_REQUESTS_TOTAL: AtomicU64 = AtomicU64::new(0);
static HTTP_RESPONSES_2XX: AtomicU64 = AtomicU64::new(0);
static HTTP_RESPONSES_3XX: AtomicU64 = AtomicU64::new(0);
static HTTP_RESPONSES_4XX: AtomicU64 = AtomicU64::new(0);
static HTTP_RESPONSES_5XX: AtomicU64 = AtomicU64::new(0);
static HTTP_IN_FLIGHT: AtomicI64 = AtomicI64::new(0);
static HTTP_DURATION_MICROS_SUM: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_COUNT: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_10MS: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_50MS: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_100MS: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_250MS: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_500MS: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_1S: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_2_5S: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_LE_5S: AtomicU64 = AtomicU64::new(0);
static HTTP_DURATION_INF: AtomicU64 = AtomicU64::new(0);
static HTTP_REJECTED_OVERLOAD_TOTAL: AtomicU64 = AtomicU64::new(0);

fn valid_request_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

fn resolve_request_id(request: &Request) -> String {
    request
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| valid_request_id(value))
        .map(str::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

struct InFlightGuard;

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        HTTP_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);
    }
}

pub async fn track_request(mut request: Request, next: Next) -> Response {
    if request.uri().path() == "/metrics" {
        return next.run(request).await;
    }

    let request_id = resolve_request_id(&request);
    let request_id_header = HeaderValue::from_str(&request_id)
        .expect("validated/generated request id is a valid header");
    request
        .headers_mut()
        .insert("x-request-id", request_id_header.clone());

    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let span = tracing::info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        path = %path
    );

    HTTP_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
    let _guard = InFlightGuard;
    let started = Instant::now();
    let mut response = next.run(request).instrument(span.clone()).await;
    let elapsed_micros = started.elapsed().as_micros().min(u128::from(u64::MAX)) as u64;

    HTTP_REQUESTS_TOTAL.fetch_add(1, Ordering::Relaxed);
    HTTP_DURATION_COUNT.fetch_add(1, Ordering::Relaxed);
    HTTP_DURATION_MICROS_SUM.fetch_add(elapsed_micros, Ordering::Relaxed);
    HTTP_DURATION_INF.fetch_add(1, Ordering::Relaxed);

    for (threshold, counter) in [
        (10_000_u64, &HTTP_DURATION_LE_10MS),
        (50_000_u64, &HTTP_DURATION_LE_50MS),
        (100_000_u64, &HTTP_DURATION_LE_100MS),
        (250_000_u64, &HTTP_DURATION_LE_250MS),
        (500_000_u64, &HTTP_DURATION_LE_500MS),
        (1_000_000_u64, &HTTP_DURATION_LE_1S),
        (2_500_000_u64, &HTTP_DURATION_LE_2_5S),
        (5_000_000_u64, &HTTP_DURATION_LE_5S),
    ] {
        if elapsed_micros <= threshold {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    }

    match response.status().as_u16() / 100 {
        2 => {
            HTTP_RESPONSES_2XX.fetch_add(1, Ordering::Relaxed);
        }
        3 => {
            HTTP_RESPONSES_3XX.fetch_add(1, Ordering::Relaxed);
        }
        4 => {
            HTTP_RESPONSES_4XX.fetch_add(1, Ordering::Relaxed);
        }
        5 => {
            HTTP_RESPONSES_5XX.fetch_add(1, Ordering::Relaxed);
        }
        _ => {}
    }

    tracing::info!(
        parent: &span,
        status = response.status().as_u16(),
        duration_ms = started.elapsed().as_secs_f64() * 1000.0,
        "request_completed"
    );

    response
        .headers_mut()
        .insert("x-request-id", request_id_header);
    response
}

pub fn record_overload_rejection() {
    HTTP_REJECTED_OVERLOAD_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn render(service: &str, concurrency_limit: usize) -> String {
    let duration_sum_seconds =
        HTTP_DURATION_MICROS_SUM.load(Ordering::Relaxed) as f64 / 1_000_000.0;

    format!(
        concat!(
            "# HELP lajukan_http_requests_total Completed HTTP requests excluding /metrics.\n",
            "# TYPE lajukan_http_requests_total counter\n",
            "lajukan_http_requests_total{{service=\"{service}\"}} {requests}\n",
            "# HELP lajukan_http_responses_total Completed HTTP responses by status class.\n",
            "# TYPE lajukan_http_responses_total counter\n",
            "lajukan_http_responses_total{{service=\"{service}\",class=\"2xx\"}} {responses_2xx}\n",
            "lajukan_http_responses_total{{service=\"{service}\",class=\"3xx\"}} {responses_3xx}\n",
            "lajukan_http_responses_total{{service=\"{service}\",class=\"4xx\"}} {responses_4xx}\n",
            "lajukan_http_responses_total{{service=\"{service}\",class=\"5xx\"}} {responses_5xx}\n",
            "# HELP lajukan_http_in_flight_requests Current in-flight HTTP requests excluding /metrics.\n",
            "# TYPE lajukan_http_in_flight_requests gauge\n",
            "lajukan_http_in_flight_requests{{service=\"{service}\"}} {in_flight}\n",
            "# HELP lajukan_http_concurrency_limit Configured maximum AI work concurrency.\n",
            "# TYPE lajukan_http_concurrency_limit gauge\n",
            "lajukan_http_concurrency_limit{{service=\"{service}\"}} {concurrency_limit}\n",
            "# HELP lajukan_http_overload_rejections_total Requests rejected because AI concurrency was exhausted.\n",
            "# TYPE lajukan_http_overload_rejections_total counter\n",
            "lajukan_http_overload_rejections_total{{service=\"{service}\"}} {overload_rejections}\n",
            "# HELP lajukan_http_request_duration_seconds HTTP request duration histogram excluding /metrics.\n",
            "# TYPE lajukan_http_request_duration_seconds histogram\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"0.01\"}} {le_10ms}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"0.05\"}} {le_50ms}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"0.1\"}} {le_100ms}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"0.25\"}} {le_250ms}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"0.5\"}} {le_500ms}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"1\"}} {le_1s}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"2.5\"}} {le_2_5s}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"5\"}} {le_5s}\n",
            "lajukan_http_request_duration_seconds_bucket{{service=\"{service}\",le=\"+Inf\"}} {inf}\n",
            "lajukan_http_request_duration_seconds_sum{{service=\"{service}\"}} {duration_sum_seconds}\n",
            "lajukan_http_request_duration_seconds_count{{service=\"{service}\"}} {duration_count}\n"
        ),
        service = service,
        requests = HTTP_REQUESTS_TOTAL.load(Ordering::Relaxed),
        responses_2xx = HTTP_RESPONSES_2XX.load(Ordering::Relaxed),
        responses_3xx = HTTP_RESPONSES_3XX.load(Ordering::Relaxed),
        responses_4xx = HTTP_RESPONSES_4XX.load(Ordering::Relaxed),
        responses_5xx = HTTP_RESPONSES_5XX.load(Ordering::Relaxed),
        in_flight = HTTP_IN_FLIGHT.load(Ordering::Relaxed),
        concurrency_limit = concurrency_limit,
        overload_rejections = HTTP_REJECTED_OVERLOAD_TOTAL.load(Ordering::Relaxed),
        le_10ms = HTTP_DURATION_LE_10MS.load(Ordering::Relaxed),
        le_50ms = HTTP_DURATION_LE_50MS.load(Ordering::Relaxed),
        le_100ms = HTTP_DURATION_LE_100MS.load(Ordering::Relaxed),
        le_250ms = HTTP_DURATION_LE_250MS.load(Ordering::Relaxed),
        le_500ms = HTTP_DURATION_LE_500MS.load(Ordering::Relaxed),
        le_1s = HTTP_DURATION_LE_1S.load(Ordering::Relaxed),
        le_2_5s = HTTP_DURATION_LE_2_5S.load(Ordering::Relaxed),
        le_5s = HTTP_DURATION_LE_5S.load(Ordering::Relaxed),
        inf = HTTP_DURATION_INF.load(Ordering::Relaxed),
        duration_sum_seconds = duration_sum_seconds,
        duration_count = HTTP_DURATION_COUNT.load(Ordering::Relaxed),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_id_validation_preserves_existing_ai_contract() {
        assert!(valid_request_id("lai:edge-abc_123.456"));
        assert!(!valid_request_id(""));
        assert!(!valid_request_id("contains space"));
        assert!(!valid_request_id(&"a".repeat(121)));
    }

    #[test]
    fn render_exposes_ai_red_and_overload_metrics() {
        let body = render("ai_service", 8);
        assert!(body.contains("lajukan_http_requests_total{service=\"ai_service\"}"));
        assert!(body.contains("lajukan_http_concurrency_limit{service=\"ai_service\"} 8"));
        assert!(body.contains("lajukan_http_overload_rejections_total{service=\"ai_service\"}"));
        assert!(!body.contains("path="));
    }
}
