use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Json},
};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tokio::time::{timeout, Duration};

use crate::config::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "OK".into(),
    })
}

pub async fn ready_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match timeout(
        Duration::from_secs(2),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.db),
    )
    .await
    {
        Ok(Ok(1)) => (
            StatusCode::OK,
            Json(json!({"status":"ready","service":"identity_service"})),
        )
            .into_response(),
        Ok(Ok(_)) | Ok(Err(_)) | Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"status":"not_ready","service":"identity_service"})),
        )
            .into_response(),
    }
}

pub async fn service_metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let pool_size = state.db.size();
    let pool_idle = state.db.num_idle();
    let (outbox_backlog, metrics_query_ok) = match timeout(
        Duration::from_secs(2),
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)::bigint FROM events.event_outbox WHERE status <> 'published'",
        )
        .fetch_one(&state.db),
    )
    .await
    {
        Ok(Ok(value)) => (value, 1),
        Ok(Err(_)) | Err(_) => (0, 0),
    };

    let mut body = format!(
        concat!(
            "# HELP lajukan_service_info Static service identity.\n",
            "# TYPE lajukan_service_info gauge\n",
            "lajukan_service_info{{service=\"identity_service\"}} 1\n",
            "# HELP lajukan_db_pool_connections PostgreSQL pool connections by state.\n",
            "# TYPE lajukan_db_pool_connections gauge\n",
            "lajukan_db_pool_connections{{service=\"identity_service\",state=\"total\"}} {}\n",
            "lajukan_db_pool_connections{{service=\"identity_service\",state=\"idle\"}} {}\n",
            "# HELP lajukan_outbox_backlog Pending or failed transactional outbox events.\n",
            "# TYPE lajukan_outbox_backlog gauge\n",
            "lajukan_outbox_backlog{{service=\"identity_service\"}} {}\n",
            "# HELP lajukan_metrics_db_query_ok Whether the metrics DB query succeeded.\n",
            "# TYPE lajukan_metrics_db_query_ok gauge\n",
            "lajukan_metrics_db_query_ok{{service=\"identity_service\"}} {}\n"
        ),
        pool_size, pool_idle, outbox_backlog, metrics_query_ok
    );

    body.push_str(&crate::runtime_metrics::render("identity_service"));

    (
        [(
            header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}
