use anyhow::Result;
use axum::{
    http::{header, HeaderName, HeaderValue, Method},
    routing::{get, post},
    Router,
};
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::FieldTable,
    BasicProperties, Channel, ExchangeKind,
};
use serde_json::Value;
use sqlx::FromRow;
use std::{env, sync::Arc};
use tokio::{
    net::TcpListener,
    time::{sleep, timeout, Duration},
};
use tower_http::{
    compression::CompressionLayer, cors::CorsLayer, set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use identity_service::config::{AppState, Config};
use identity_service::db;
use identity_service::organizations::invitations::{
    accept_organization_invitation, create_organization_invitation,
    list_my_organization_invitations, reject_organization_invitation,
};
use identity_service::organizations::routes::{
    create_organization, ensure_organization, get_organization, list_organization_members,
    list_organizations,
};
use identity_service::routes::{
    cancel_my_privacy_request, change_password, create_backoffice_invitation, create_privacy_request,
    create_security_incident,
    delete_me_account, discover_users,
    get_me_profile, get_public_user_profile, get_user_by_email, get_user_by_phone, get_user_detail,
    health_check, list_backoffice_google_access, list_backoffice_invitations,
    list_my_backoffice_invitations, list_users, login, login_phone, logout, me, moderate_user,
    oauth_google, ready_check, refresh_token, register, reset_password,
    respond_backoffice_invitation, revoke_backoffice_invitation, search_backoffice_candidates,
    service_metrics, update_me_profile, upsert_backoffice_google_access,
};
use identity_service::runtime_metrics;
mod retention;
use retention::run_retention_sweep;

#[derive(Debug, FromRow)]
struct IdentityOutboxEventRow {
    id: uuid::Uuid,
    aggregate_type: String,
    aggregate_id: String,
    event_type: String,
    routing_key: String,
    payload: Value,
    lease_until: chrono::DateTime<chrono::Utc>,
}

// Kept temporarily for migration characterization tests only. Runtime schema
// ownership belongs exclusively to versioned files in `migrations/`.
#[cfg(test)]
#[allow(dead_code)]
async fn ensure_identity_runtime_schema(db: &sqlx::PgPool) -> Result<()> {
    sqlx::query("CREATE EXTENSION IF NOT EXISTS citext")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS core")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS events")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS audit")
        .execute(db)
        .await?;
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION public.update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity TEXT NOT NULL,
            action TEXT NOT NULL,
            actor_id UUID,
            user_id UUID,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF to_regclass('core.users') IS NOT NULL THEN
                ALTER TABLE core.users ALTER COLUMN password_hash DROP NOT NULL;
            END IF;
            IF to_regclass('core.user_profiles') IS NOT NULL THEN
                ALTER TABLE core.user_profiles
                    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
            END IF;
        END $$;
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS core.user_identities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            provider_user_id TEXT NOT NULL,
            email CITEXT,
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ,
            CONSTRAINT user_identities_provider_check CHECK (provider <> ''),
            CONSTRAINT user_identities_provider_user_id_check CHECK (provider_user_id <> '')
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_subject
            ON core.user_identities(provider, provider_user_id)
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_user
            ON core.user_identities(provider, user_id)
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON core.user_identities(user_id)",
    )
    .execute(db)
    .await?;
    sqlx::query("DROP TRIGGER IF EXISTS user_identities_update_timestamp ON core.user_identities")
        .execute(db)
        .await?;
    sqlx::query(
        r#"
        CREATE TRIGGER user_identities_update_timestamp
        BEFORE UPDATE ON core.user_identities
        FOR EACH ROW EXECUTE FUNCTION public.update_timestamp()
        "#,
    )
    .execute(db)
    .await?;
    Ok(())
}

async fn verify_identity_schema(db: &sqlx::PgPool) -> Result<()> {
    let ready: bool = sqlx::query_scalar(
        r#"
        SELECT to_regclass('core.users') IS NOT NULL
           AND to_regclass('core.user_profiles') IS NOT NULL
           AND to_regclass('core.user_identities') IS NOT NULL
           AND to_regclass('events.event_outbox') IS NOT NULL
        "#,
    )
    .fetch_one(db)
    .await?;

    if !ready {
        anyhow::bail!("identity schema contract is incomplete after migrations");
    }
    Ok(())
}

async fn connect_outbox_channel(rabbitmq_url: &str, exchange: &str) -> Result<Channel> {
    let conn =
        lapin::Connection::connect(rabbitmq_url, lapin::ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;
    channel
        .exchange_declare(
            exchange,
            ExchangeKind::Topic,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    Ok(channel)
}

async fn publish_identity_outbox_batch(
    db: &sqlx::PgPool,
    channel: &Channel,
    exchange: &str,
    batch_size: i64,
) -> Result<usize> {
    let events = sqlx::query_as::<_, IdentityOutboxEventRow>(
        r#"
        WITH candidate AS (
          SELECT id
          FROM events.event_outbox
          WHERE status IN ('pending', 'failed', 'publishing')
            AND available_at <= NOW()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE events.event_outbox AS outbox
        SET
          status = 'publishing',
          available_at = NOW() + INTERVAL '2 minutes',
          error_message = NULL
        FROM candidate
        WHERE outbox.id = candidate.id
        RETURNING
          outbox.id,
          outbox.aggregate_type,
          outbox.aggregate_id,
          outbox.event_type,
          outbox.routing_key,
          outbox.payload,
          outbox.available_at AS lease_until
        "#,
    )
    .bind(batch_size)
    .fetch_all(db)
    .await?;

    if events.is_empty() {
        return Ok(0);
    }

    for event in events.iter() {
        let mut envelope = event.payload.clone();
        if let Value::Object(ref mut object) = envelope {
            object.insert("event_id".to_string(), Value::String(event.id.to_string()));
            object.insert(
                "event_type".to_string(),
                Value::String(event.event_type.clone()),
            );
            object.insert(
                "aggregate_type".to_string(),
                Value::String(event.aggregate_type.clone()),
            );
            object.insert(
                "aggregate_id".to_string(),
                Value::String(event.aggregate_id.clone()),
            );
        }

        let payload_bytes = serde_json::to_vec(&envelope)?;
        let publish_result = channel
            .basic_publish(
                exchange,
                &event.routing_key,
                BasicPublishOptions::default(),
                &payload_bytes,
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2u8)
                    .with_message_id(event.id.to_string().into())
                    .with_type(event.event_type.clone().into()),
            )
            .await;

        match publish_result {
            Ok(confirm) => {
                if let Err(error) = confirm.await {
                    mark_identity_outbox_retry(
                        db,
                        event.id,
                        event.lease_until,
                        format!("confirm: {error:?}"),
                    )
                    .await;
                    continue;
                }
            }
            Err(error) => {
                mark_identity_outbox_retry(
                    db,
                    event.id,
                    event.lease_until,
                    format!("publish: {error:?}"),
                )
                .await;
                continue;
            }
        }

        sqlx::query(
            r#"
            UPDATE events.event_outbox
            SET status = 'published', published_at = NOW(), error_message = NULL
            WHERE id = $1
              AND status = 'publishing'
              AND available_at = $2
            "#,
        )
        .bind(event.id)
        .bind(event.lease_until)
        .execute(db)
        .await?;
    }

    Ok(events.len())
}

async fn mark_identity_outbox_retry(
    db: &sqlx::PgPool,
    event_id: uuid::Uuid,
    lease_until: chrono::DateTime<chrono::Utc>,
    error: String,
) {
    let _ = sqlx::query(
        r#"
        UPDATE events.event_outbox
        SET
          status = 'failed',
          retry_count = retry_count + 1,
          available_at = NOW() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
          error_message = $2
        WHERE id = $1
          AND status = 'publishing'
          AND available_at = $3
        "#,
    )
    .bind(event_id)
    .bind(error)
    .bind(lease_until)
    .execute(db)
    .await;
}

async fn run_identity_outbox_publisher(
    db: sqlx::PgPool,
    rabbitmq_url: String,
    exchange: String,
    batch_size: i64,
    poll_ms: u64,
) {
    loop {
        match connect_outbox_channel(&rabbitmq_url, &exchange).await {
            Ok(channel) => loop {
                match publish_identity_outbox_batch(&db, &channel, &exchange, batch_size).await {
                    Ok(0) => sleep(Duration::from_millis(poll_ms)).await,
                    Ok(count) => tracing::info!("published {count} identity outbox events"),
                    Err(error) => {
                        tracing::warn!("identity outbox publish error: {error:?}");
                        sleep(Duration::from_secs(2)).await;
                        break;
                    }
                }
            },
            Err(error) => {
                tracing::warn!("identity outbox RabbitMQ connection error: {error:?}");
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}

fn init_tracing() {
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

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Logging
    init_tracing();

    // 2. Load Config & Infra
    let cfg = Config::from_env();

    // Sinkronisasi dengan config.rs (Gunakan cfg.env)
    let is_prod = cfg.env == "production" || cfg.env == "staging";
    tracing::info!(environment = %cfg.env, "starting identity service");

    let db_pool = db::init_postgres(&cfg).await;

    let migrate_only = env::var("MIGRATE_ONLY").ok().is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes"
        )
    });
    let run_migrations_on_startup = migrate_only
        || env::var("RUN_MIGRATIONS_ON_STARTUP")
            .ok()
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes"
                )
            })
            .unwrap_or(!is_prod);

    // Production/staging migrations are release-owned. Normal application
    // replicas verify the schema but do not race each other to mutate it.
    if run_migrations_on_startup {
        let mut migrator = sqlx::migrate!("./migrations");
        if !is_prod {
            migrator.set_ignore_missing(true);
        }
        let migration_timeout = if is_prod { 60 } else { 10 };
        match timeout(
            Duration::from_secs(migration_timeout),
            migrator.run(&db_pool),
        )
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(error)) => {
                let message = error.to_string();
                let checksum_mismatch =
                    message.contains("was previously applied but has been modified");

                if !is_prod && checksum_mismatch {
                    tracing::info!(
                        "Shared DB migration checksum drift in {} (ignored): {}",
                        cfg.env,
                        message
                    );
                } else {
                    return Err(error.into());
                }
            }
            Err(_) if !is_prod => {
                tracing::warn!(
                    "Embedded migrations timed out after {}s in {}; continuing because entrypoint already handles migrations.",
                    migration_timeout,
                    cfg.env
                );
            }
            Err(_) => {
                return Err(anyhow::anyhow!(
                    "Embedded migrations timed out after {}s in {}",
                    migration_timeout,
                    cfg.env
                ));
            }
        }
    } else {
        tracing::info!("startup migrations disabled; expecting release-owned migration step");
    }

    verify_identity_schema(&db_pool).await?;
    if migrate_only {
        tracing::info!("identity migration-only release step completed");
        return Ok(());
    }

    tracing::info!("initializing Redis");
    let redis_pool = db::init_redis(&cfg).await;

    // RabbitMQ is intentionally not part of request-serving readiness.
    // The transactional outbox publisher owns its broker connection and retries
    // independently, so authentication remains available during broker outages.
    let app_state = Arc::new(AppState {
        db: db_pool,
        redis: redis_pool,
        config: cfg.clone(),
    });

    let identity_outbox_exchange =
        env::var("IDENTITY_OUTBOX_EXCHANGE").unwrap_or_else(|_| "identity.outbox".to_string());
    let identity_outbox_batch_size = env::var("IDENTITY_OUTBOX_BATCH_SIZE")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(50)
        .clamp(1, 500);
    let identity_outbox_poll_ms = env::var("IDENTITY_OUTBOX_POLL_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(750)
        .clamp(100, 30_000);
    tokio::spawn(run_retention_sweep(app_state.db.clone()));

    tokio::spawn(run_identity_outbox_publisher(
        app_state.db.clone(),
        cfg.rabbitmq_url.clone(),
        identity_outbox_exchange,
        identity_outbox_batch_size,
        identity_outbox_poll_ms,
    ));

    // 3. Konfigurasi CORS Adaptif
    let mut cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            HeaderName::from_static("x-requested-with"),
            HeaderName::from_static("x-request-id"),
        ])
        .expose_headers([HeaderName::from_static("x-request-id")])
        .allow_credentials(true);

    let configured_origins: Vec<HeaderValue> = cfg
        .cors_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect();

    if !configured_origins.is_empty() {
        cors = cors.allow_origin(configured_origins);
    } else if is_prod {
        cors = cors.allow_origin("https://www.lajukan.com".parse::<HeaderValue>()?);
    } else {
        cors = cors.allow_origin([
            "http://localhost:3000".parse::<HeaderValue>()?,
            "http://localhost:3001".parse::<HeaderValue>()?,
            "http://localhost:3002".parse::<HeaderValue>()?,
        ]);
    }

    // 4. Build Router
    let mut app = Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(ready_check))
        .route("/metrics", get(service_metrics))
        .nest(
            "/auth",
            Router::new()
                .route("/register", post(register))
                .route("/login", post(login))
                .route("/login-phone", post(login_phone))
                .route("/oauth/google", post(oauth_google))
                .route("/change-password", post(change_password))
                .route("/reset-password", post(reset_password))
                .route("/me", get(me))
                .route("/refresh", post(refresh_token))
                .route("/logout", post(logout)),
        )
        .route("/users/by-phone/{phone}", get(get_user_by_phone))
        .route("/users/by-email/{email}", get(get_user_by_email))
        .route("/users/discover", get(discover_users))
        .route("/users/public/{id}", get(get_public_user_profile))
        .route(
            "/users/me",
            get(get_me_profile)
                .put(update_me_profile)
                .delete(delete_me_account),
        )
        .route("/users", get(list_users))
        .route("/users/{id}", get(get_user_detail))
        .route("/users/{id}/moderate", post(moderate_user))
        .route("/privacy/requests", get(list_privacy_requests).post(create_privacy_request))
        .route("/privacy/requests/mine", get(list_my_privacy_requests))
        .route("/privacy/requests/{id}/cancel", post(cancel_my_privacy_request))
        .route("/privacy/requests/{id}/transition", post(transition_privacy_request))
        .route("/security/incidents", get(list_security_incidents).post(create_security_incident))
        .route("/security/incidents/{id}/transition", post(transition_security_incident))
        .route(
            "/backoffice/google-access",
            get(list_backoffice_google_access).post(upsert_backoffice_google_access),
        )
        .route("/backoffice/candidates", get(search_backoffice_candidates))
        .route(
            "/backoffice/invitations",
            get(list_backoffice_invitations).post(create_backoffice_invitation),
        )
        .route(
            "/backoffice/invitations/mine",
            get(list_my_backoffice_invitations),
        )
        .route(
            "/backoffice/invitations/{id}/revoke",
            post(revoke_backoffice_invitation),
        )
        .route(
            "/backoffice/invitations/{id}/respond",
            post(respond_backoffice_invitation),
        )
        .route(
            "/organizations",
            get(list_organizations).post(create_organization),
        )
        .route("/organizations/ensure", post(ensure_organization))
        .route("/organizations/{id}", get(get_organization))
        .route(
            "/organizations/{id}/members",
            get(list_organization_members),
        )
        .route(
            "/organizations/{id}/invitations",
            post(create_organization_invitation),
        )
        .route(
            "/organization-invitations",
            get(list_my_organization_invitations),
        )
        .route(
            "/organization-invitations/{id}/accept",
            post(accept_organization_invitation),
        )
        .route(
            "/organization-invitations/{id}/reject",
            post(reject_organization_invitation),
        )
        .layer(axum::middleware::from_fn(runtime_metrics::track_request))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .layer(CompressionLayer::new())
        .with_state(app_state);

    // 5. Tambahkan Security Headers HANYA di Production
    if is_prod {
        let security_layers = tower::ServiceBuilder::new()
            .layer(SetResponseHeaderLayer::overriding(
                HeaderName::from_static("strict-transport-security"),
                HeaderValue::from_static("max-age=63072000; includeSubDomains; preload"),
            ))
            .layer(SetResponseHeaderLayer::overriding(
                HeaderName::from_static("x-content-type-options"),
                HeaderValue::from_static("nosniff"),
            ));
        app = app.layer(security_layers);
    }

    // 6. Server Startup
    let addr = format!("0.0.0.0:{}", cfg.app_port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!(address = %addr, "identity service listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
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
