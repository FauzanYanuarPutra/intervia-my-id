use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use reqwest::Client;
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{env, sync::Arc, time::Duration};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    db: PgPool,
    http: Client,
    upstream: String,
    mode: RuntimeMode,
    proxy_enabled: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimeMode {
    Compatibility,
    Native,
}

impl RuntimeMode {
    fn from_env() -> anyhow::Result<Self> {
        match env::var("DOMAIN_RUNTIME_MODE")
            .unwrap_or_else(|_| "compatibility".to_string())
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "compatibility" | "proxy" | "legacy" => Ok(Self::Compatibility),
            "native" => Ok(Self::Native),
            other => anyhow::bail!("DOMAIN_RUNTIME_MODE must be compatibility or native, got {other:?}"),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Compatibility => "compatibility",
            Self::Native => "native",
        }
    }
}

fn service_name() -> &'static str {
    env!("CARGO_PKG_NAME")
}

async fn proxy(State(s): State<Arc<AppState>>, req: Request<Body>) -> Result<Response, StatusCode> {
    if s.mode == RuntimeMode::Native {
        return Ok((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "native_runtime_not_ready",
                "service": service_name(),
                "mode": "native",
                "message": "Native domain handlers are not enabled until backfill verification and cutover are complete."
            })),
        )
            .into_response());
    }
    if !s.proxy_enabled {
        return Ok((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "legacy_proxy_disabled",
                "service": service_name(),
                "mode": "compatibility"
            })),
        )
            .into_response());
    }

    let path = req.uri().path_and_query().map(|v| v.as_str()).unwrap_or("/");
    let url = format!("{}{}", s.upstream.trim_end_matches('/'), path);
    let method = req.method().clone();
    let mut rb = s.http.request(method, url);
    for name in [
        "authorization",
        "content-type",
        "accept",
        "x-request-id",
        "idempotency-key",
        "x-correlation-id",
        "traceparent",
    ] {
        if let Some(v) = req.headers().get(name) {
            if let Ok(vs) = v.to_str() {
                rb = rb.header(name, vs);
            }
        }
    }
    let body = to_bytes(req.into_body(), 8 * 1024 * 1024)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let response = rb
        .body(body.to_vec())
        .send()
        .await
        .map_err(|e| {
            tracing::error!(service = service_name(), error = ?e, "legacy upstream request failed");
            StatusCode::BAD_GATEWAY
        })?;

    let status = StatusCode::from_u16(response.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let request_id = response
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let correlation_id = response
        .headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let bytes = response
        .bytes()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let mut out = Response::new(Body::from(bytes));
    *out.status_mut() = status;
    if let Some(ct) = content_type {
        if let Ok(v) = ct.parse() {
            out.headers_mut().insert("content-type", v);
        }
    }
    if let Some(v) = request_id.and_then(|v| v.parse().ok()) {
        out.headers_mut().insert("x-request-id", v);
    }
    if let Some(v) = correlation_id.and_then(|v| v.parse().ok()) {
        out.headers_mut().insert("x-correlation-id", v);
    }
    Ok(out)
}

async fn health(State(s): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": service_name(),
        "mode": s.mode.as_str(),
        "legacy_proxy_enabled": s.proxy_enabled,
        "native_handlers_enabled": false
    }))
}

async fn migration_status(State(s): State<Arc<AppState>>) -> impl IntoResponse {
    let target_db_ready = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_optional(&s.db)
        .await
        .ok()
        .flatten()
        == Some(1);
    Json(json!({
        "service": service_name(),
        "mode": s.mode.as_str(),
        "target_db_ready": target_db_ready,
        "legacy_proxy_enabled": s.proxy_enabled,
        "native_handlers_enabled": false,
        "legacy_upstream_configured": !s.upstream.trim().is_empty()
    }))
}

async fn ready(State(s): State<Arc<AppState>>) -> Response {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&s.db)
        .await
        .ok()
        == Some(1);
    if !db_ok || s.mode == RuntimeMode::Native {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "not_ready",
                "service": service_name(),
                "mode": s.mode.as_str(),
                "target_db_ready": db_ok,
                "native_handlers_enabled": false
            })),
        )
            .into_response();
    }
    (
        StatusCode::OK,
        Json(json!({
            "status": "ready",
            "service": service_name(),
            "mode": s.mode.as_str(),
            "target_db_ready": true,
            "legacy_proxy_enabled": s.proxy_enabled
        })),
    )
        .into_response()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let mode = RuntimeMode::from_env()?;
    let db_url = env::var("DATABASE_URL")?;
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await?;

    if env::var("RUN_MIGRATIONS_ON_STARTUP")
        .unwrap_or_else(|_| "true".into())
        .eq_ignore_ascii_case("true")
    {
        sqlx::migrate!("./migrations").run(&db).await?;
    }

    let timeout_ms: u64 = env::var("LEGACY_PROXY_TIMEOUT_MS")
        .unwrap_or_else(|_| "5000".into())
        .parse()?;
    let http = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()?;
    let proxy_enabled = env::var("LEGACY_PROXY_ENABLED")
        .unwrap_or_else(|_| "true".into())
        .eq_ignore_ascii_case("true");
    let upstream = env::var("LEGACY_UPSTREAM_URL")
        .unwrap_or_else(|_| "http://marketplace_service:8081".into());

    let state = Arc::new(AppState {
        db,
        http,
        upstream,
        mode,
        proxy_enabled,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/migration/status", get(migration_status))
        .route("/v1/{*path}", any(proxy))
        .with_state(state);

    let port: u16 = env::var("APP_PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse()?;
    axum::serve(
        tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?,
        app,
    )
    .await?;
    Ok(())
}
