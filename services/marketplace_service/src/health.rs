use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::Arc;
use tokio::time::{timeout, Duration};

use crate::{runtime_metrics, AppState};

pub(crate) async fn health() -> impl IntoResponse {
    Json(json!({"status":"ok","service":"marketplace_service"}))
}

pub(crate) async fn ready(State(state): State<Arc<AppState>>) -> Response {
    match timeout(
        Duration::from_secs(2),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.db),
    )
    .await
    {
        Ok(Ok(1)) => (
            StatusCode::OK,
            Json(json!({"status":"ready","service":"marketplace_service"})),
        )
            .into_response(),
        Ok(Ok(_)) | Ok(Err(_)) | Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"status":"not_ready","service":"marketplace_service"})),
        )
            .into_response(),
    }
}

pub(crate) async fn service_metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let pool_size = state.db.size();
    let pool_idle = state.db.num_idle();
    let pool_max = state.db.options().get_max_connections();
    let pool_active = pool_size.saturating_sub(pool_idle.min(pool_size as usize) as u32);
    let notification_subscribers = state.notification_tx.receiver_count();
    let (outbox_backlog, outbox_oldest_age_seconds, metrics_query_ok) = match timeout(
        Duration::from_secs(2),
        sqlx::query_as::<_, (i64, f64)>(
            r#"
            SELECT
              COUNT(*)::bigint,
              COALESCE(
                EXTRACT(EPOCH FROM (NOW() - MIN(created_at))),
                0
              )::double precision
            FROM events.event_outbox
            WHERE status <> 'published'
            "#,
        )
        .fetch_one(&state.db),
    )
    .await
    {
        Ok(Ok((backlog, oldest_age_seconds))) => (backlog, oldest_age_seconds.max(0.0), 1),
        Ok(Err(_)) | Err(_) => (0, 0.0, 0),
    };

    let mut body = format!(
        concat!(
            "# HELP lajukan_service_info Static service identity.\n",
            "# TYPE lajukan_service_info gauge\n",
            "lajukan_service_info{{service=\"marketplace_service\"}} 1\n",
            "# HELP lajukan_db_pool_connections PostgreSQL pool connections by state.\n",
            "# TYPE lajukan_db_pool_connections gauge\n",
            "lajukan_db_pool_connections{{service=\"marketplace_service\",state=\"total\"}} {}\n",
            "lajukan_db_pool_connections{{service=\"marketplace_service\",state=\"idle\"}} {}\n",
            "lajukan_db_pool_connections{{service=\"marketplace_service\",state=\"active\"}} {}\n",
            "lajukan_db_pool_connections{{service=\"marketplace_service\",state=\"max\"}} {}\n",
            "# HELP lajukan_outbox_backlog Pending or failed transactional outbox events.\n",
            "# TYPE lajukan_outbox_backlog gauge\n",
            "lajukan_outbox_backlog{{service=\"marketplace_service\"}} {}\n",
            "# HELP lajukan_outbox_oldest_age_seconds Age in seconds of the oldest unpublished transactional outbox event.\n",
            "# TYPE lajukan_outbox_oldest_age_seconds gauge\n",
            "lajukan_outbox_oldest_age_seconds{{service=\"marketplace_service\"}} {}\n",
            "# HELP lajukan_metrics_db_query_ok Whether the metrics DB query succeeded.\n",
            "# TYPE lajukan_metrics_db_query_ok gauge\n",
            "lajukan_metrics_db_query_ok{{service=\"marketplace_service\"}} {}\n",
            "# HELP lajukan_notification_subscribers Active realtime notification subscribers.\n",
            "# TYPE lajukan_notification_subscribers gauge\n",
            "lajukan_notification_subscribers{{service=\"marketplace_service\"}} {}\n"
        ),
        pool_size,
        pool_idle,
        pool_active,
        pool_max,
        outbox_backlog,
        outbox_oldest_age_seconds,
        metrics_query_ok,
        notification_subscribers
    );

    body.push_str(&runtime_metrics::render("marketplace_service"));

    (
        [(
            header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}
