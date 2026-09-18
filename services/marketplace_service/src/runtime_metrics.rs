use axum::{extract::Request, middleware::Next, response::Response};
use std::{
    sync::atomic::{AtomicI64, AtomicU64, Ordering},
    time::Instant,
};

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

struct InFlightGuard;

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        HTTP_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);
    }
}

pub async fn track_request(request: Request, next: Next) -> Response {
    if request.uri().path() == "/metrics" {
        return next.run(request).await;
    }

    HTTP_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
    let _guard = InFlightGuard;
    let started = Instant::now();
    let response = next.run(request).await;
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

    response
}

pub fn render(service: &str) -> String {
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
    fn render_exposes_low_cardinality_red_metrics() {
        let body = render("test_service");
        assert!(body.contains("lajukan_http_requests_total{service=\"test_service\"}"));
        assert!(
            body.contains("lajukan_http_responses_total{service=\"test_service\",class=\"5xx\"}")
        );
        assert!(body.contains(
            "lajukan_http_request_duration_seconds_bucket{service=\"test_service\",le=\"+Inf\"}"
        ));
        assert!(!body.contains("path="));
    }
}
