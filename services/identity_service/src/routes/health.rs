use axum::{
    extract::State,
    http::StatusCode,
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
