use axum::{extract::State,http::StatusCode,response::IntoResponse,routing::get,Json,Router};
use serde_json::json;
use sqlx::{postgres::PgPoolOptions,PgPool};
use std::{env,net::SocketAddr,sync::Arc};
use tracing_subscriber::{layer::SubscriberExt,util::SubscriberInitExt};

#[derive(Clone)]
struct AppState { db: PgPool }

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let ok = sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&state.db).await.ok()==Some(1);
    if ok { (StatusCode::OK, Json(json!({"status":"ok","service":env!("CARGO_PKG_NAME")}))) }
    else { (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"status":"degraded","service":env!("CARGO_PKG_NAME")}))) }
}

async fn ready(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&state.db).await {
        Ok(1) => (StatusCode::OK, Json(json!({"status":"ready","service":env!("CARGO_PKG_NAME")}))),
        _ => (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"status":"not_ready","service":env!("CARGO_PKG_NAME")}))),
    }
}

async fn meta(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let row = sqlx::query!("SELECT service_name, schema_version FROM service_meta LIMIT 1")
        .fetch_optional(&state.db).await.unwrap_or(None);
    Json(json!({"service":env!("CARGO_PKG_NAME"),"database":row.as_ref().map(|r|r.service_name.clone()),"schema_version":row.as_ref().map(|r|r.schema_version.clone())}))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry().with(tracing_subscriber::EnvFilter::from_default_env()).with(tracing_subscriber::fmt::layer().json()).init();
    let url=env::var("DATABASE_URL")?;
    let pool=PgPoolOptions::new().max_connections(env::var("DB_MAX_CONNECTIONS").ok().and_then(|v|v.parse().ok()).unwrap_or(10)).connect(&url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    let state=Arc::new(AppState{db:pool});
    let app=Router::new().route("/health",get(health)).route("/ready",get(ready)).route("/meta",get(meta)).with_state(state);
    let port: u16=env::var("APP_PORT").unwrap_or_else(|_|"8080".into()).parse()?;
    let addr=SocketAddr::from(([0,0,0,0],port));
    axum::serve(tokio::net::TcpListener::bind(addr).await?,app).await?;
    Ok(())
}
