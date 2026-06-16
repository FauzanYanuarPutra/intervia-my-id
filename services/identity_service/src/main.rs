use anyhow::Result;
use axum::{
    http::{header, HeaderName, HeaderValue, Method},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::{
    net::TcpListener,
    time::{timeout, Duration},
};
use tower_http::{
    compression::CompressionLayer, cors::CorsLayer, set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use identity_service::config::{AppState, Config};
use identity_service::db;
use identity_service::routes::{
    change_password, delete_me_account, discover_users, get_me_profile, get_public_user_profile,
    get_user_by_email, get_user_by_phone, get_user_detail, health_check, list_users, login,
    login_phone, logout, me, oauth_google, refresh_token, register, reset_password,
    update_me_profile,
};

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

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load Config & Infra
    let cfg = Config::from_env();

    // Sinkronisasi dengan config.rs (Gunakan cfg.env)
    let is_prod = cfg.env == "production" || cfg.env == "staging";
    println!("🚀 Starting Identity Service in {} mode", cfg.env);

    let db_pool = db::init_postgres(&cfg).await;

    // Auto-migrate.
    // Dev stack memakai shared database lintas service, jadi versi migrasi lain
    // boleh ada di _sqlx_migrations.
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

    ensure_identity_runtime_schema(&db_pool).await?;

    println!("Initializing Redis...");
    let redis_pool = db::init_redis(&cfg).await;
    println!("Initializing RabbitMQ...");
    let rabbitmq_conn = db::init_rabbitmq(&cfg).await;

    let app_state = Arc::new(AppState {
        db: db_pool,
        redis: redis_pool,
        rabbitmq: rabbitmq_conn,
        config: cfg.clone(),
    });

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
        ])
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
    println!("📡 Listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    println!("🛑 Shutdown signal received...");
}
