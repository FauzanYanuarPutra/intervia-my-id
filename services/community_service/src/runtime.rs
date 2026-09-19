use axum::http::HeaderValue;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::env;
use tokio::time::Duration;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn env_u32_bounded(name: &str, default: u32, min: u32, max: u32) -> u32 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(default)
        .clamp(min, max)
}

fn env_u64_bounded(name: &str, default: u64, min: u64, max: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(default)
        .clamp(min, max)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum DatabasePoolPurpose {
    Migration,
    Application,
}

pub(crate) fn database_session_setup(purpose: DatabasePoolPurpose) -> Option<&'static str> {
    match purpose {
        DatabasePoolPurpose::Migration => None,
        DatabasePoolPurpose::Application => Some("SET search_path TO forum, reel, public, events"),
    }
}

pub(crate) async fn connect_database_pool(
    database_url: &str,
    purpose: DatabasePoolPurpose,
) -> anyhow::Result<PgPool> {
    let options = match purpose {
        DatabasePoolPurpose::Migration => PgPoolOptions::new()
            .max_connections(2)
            .min_connections(0)
            .acquire_timeout(Duration::from_secs(10)),
        DatabasePoolPurpose::Application => {
            let max_connections = env_u32_bounded("COMMUNITY_DB_MAX_CONNECTIONS", 20, 2, 100);
            let min_connections =
                env_u32_bounded("COMMUNITY_DB_MIN_CONNECTIONS", 2, 0, max_connections);
            let acquire_timeout_seconds =
                env_u64_bounded("COMMUNITY_DB_ACQUIRE_TIMEOUT_SECONDS", 5, 1, 30);
            let idle_timeout_seconds =
                env_u64_bounded("COMMUNITY_DB_IDLE_TIMEOUT_SECONDS", 300, 30, 3_600);
            let max_lifetime_seconds =
                env_u64_bounded("COMMUNITY_DB_MAX_LIFETIME_SECONDS", 1_800, 300, 86_400);
            PgPoolOptions::new()
                .max_connections(max_connections)
                .min_connections(min_connections)
                .acquire_timeout(Duration::from_secs(acquire_timeout_seconds))
                .idle_timeout(Duration::from_secs(idle_timeout_seconds))
                .max_lifetime(Duration::from_secs(max_lifetime_seconds))
        }
    };
    let options = if let Some(statement) = database_session_setup(purpose) {
        options.after_connect(move |conn, _meta| {
            Box::pin(async move {
                sqlx::query(statement).execute(conn).await?;
                Ok(())
            })
        })
    } else {
        options
    };

    Ok(options.connect(database_url).await?)
}

pub(crate) fn init_tracing() {
    let app_env = env::var("ENV")
        .or_else(|_| env::var("APP_ENV"))
        .unwrap_or_else(|_| "development".to_string());
    let structured = match env::var("LOG_FORMAT")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "json" => true,
        "text" | "pretty" => false,
        _ => app_env.eq_ignore_ascii_case("production") || app_env.eq_ignore_ascii_case("staging"),
    };
    let filter = tracing_subscriber::EnvFilter::new(
        env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
    );

    if structured {
        tracing_subscriber::registry()
            .with(filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .json()
                    .flatten_event(true)
                    .with_current_span(true)
                    .with_span_list(true),
            )
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
    }
}

pub(crate) async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}

pub(crate) fn parse_cors_origins() -> Vec<HeaderValue> {
    env::var("CORS_ORIGINS")
        .ok()
        .or_else(|| env::var("CORS_ORIGIN").ok())
        .unwrap_or_default()
        .split(',')
        .filter_map(|origin| origin.trim().parse::<HeaderValue>().ok())
        .collect()
}
