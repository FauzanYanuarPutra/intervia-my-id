use crate::config::AppState;
use axum::extract::State;
use axum::response::Json;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct InfoResponse {
    pub app_name: String,
    pub app_port: u16,
    pub env: String,
    pub version: String,
}

pub async fn app_info(State(state): State<Arc<AppState>>) -> Json<InfoResponse> {
    let cfg = &state.config;

    Json(InfoResponse {
        app_name: cfg.app_name.clone(),
        app_port: cfg.app_port,
        env: cfg.env.clone(),
        version: cfg.version.clone(),
    })
}
