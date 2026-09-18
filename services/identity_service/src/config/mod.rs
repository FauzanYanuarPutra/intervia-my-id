pub mod state;

use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    // ... field lama kamu ...
    pub app_name: String,
    pub app_port: u16,
    pub database_url: String,
    pub db_max_connections: u32,
    pub db_min_connections: u32,
    pub db_acquire_timeout_seconds: u64,
    pub db_idle_timeout_seconds: u64,
    pub db_max_lifetime_seconds: u64,
    pub redis_url: String,
    pub rabbitmq_url: String,
    pub jwt_secret: String,
    pub jwt_private_key_pem: Option<String>,
    pub jwt_public_key_pem: Option<String>,
    pub jwt_key_id: String,
    pub jwt_allow_legacy_hs256: bool,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub env: String,
    pub version: String,

    // --- TAMBAHAN BARU ---
    pub app_domain: Option<String>,
    pub access_token_exp_hours: i64,
    pub refresh_token_exp_days: i64,
    pub max_login_attempts: i16,
    pub lockout_duration_min: i64,
    pub failed_login_delay_ms: u64,
    pub cors_origins: Vec<String>,
    pub google_client_id: Option<String>,
}

impl Config {
    fn parse_cors_origins() -> Vec<String> {
        let raw = env::var("CORS_ORIGINS")
            .ok()
            .or_else(|| env::var("CORS_ORIGIN").ok())
            .unwrap_or_default();

        raw.split(',')
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .collect()
    }

    fn parse_u32_env(name: &str, default: u32, min: u32, max: u32) -> u32 {
        env::var(name)
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(default)
            .clamp(min, max)
    }

    fn parse_u64_env(name: &str, default: u64, min: u64, max: u64) -> u64 {
        env::var(name)
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(default)
            .clamp(min, max)
    }

    fn optional_pem_env(name: &str) -> Option<String> {
        env::var(name)
            .ok()
            .map(|value| value.replace("\\n", "\n").trim().to_string())
            .filter(|value| !value.is_empty())
    }

    fn bool_env(name: &str, default: bool) -> bool {
        env::var(name)
            .ok()
            .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(default)
    }

    pub fn from_env() -> Self {
        dotenv().ok();

        let app_env = env::var("ENV").unwrap_or_else(|_| "development".into());
        let db_max_connections = Self::parse_u32_env("IDENTITY_DB_MAX_CONNECTIONS", 10, 2, 100);
        let db_min_connections =
            Self::parse_u32_env("IDENTITY_DB_MIN_CONNECTIONS", 1, 0, db_max_connections);
        let db_acquire_timeout_seconds =
            Self::parse_u64_env("IDENTITY_DB_ACQUIRE_TIMEOUT_SECONDS", 5, 1, 30);
        let db_idle_timeout_seconds =
            Self::parse_u64_env("IDENTITY_DB_IDLE_TIMEOUT_SECONDS", 300, 30, 3_600);
        let db_max_lifetime_seconds =
            Self::parse_u64_env("IDENTITY_DB_MAX_LIFETIME_SECONDS", 1_800, 300, 86_400);
        let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set for security");
        let jwt_private_key_pem = Self::optional_pem_env("JWT_PRIVATE_KEY_PEM");
        let jwt_public_key_pem = Self::optional_pem_env("JWT_PUBLIC_KEY_PEM");
        let jwt_key_id = env::var("JWT_KEY_ID")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "lajukan-primary".to_string());
        let jwt_allow_legacy_hs256 = Self::bool_env("JWT_ALLOW_LEGACY_HS256", true);
        let strict_secrets =
            app_env.eq_ignore_ascii_case("production") || app_env.eq_ignore_ascii_case("staging");
        let normalized_secret = jwt_secret.trim().to_ascii_lowercase();
        if strict_secrets
            && (jwt_secret.trim().len() < 32
                || matches!(
                    normalized_secret.as_str(),
                    "change_me" | "changeme" | "secret" | "your_secret_here"
                ))
        {
            panic!("JWT_SECRET must be at least 32 characters and not a placeholder");
        }

        if strict_secrets && jwt_private_key_pem.is_some() != jwt_public_key_pem.is_some() {
            panic!("JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM must be configured together");
        }
        if strict_secrets && !jwt_allow_legacy_hs256 && jwt_private_key_pem.is_none() {
            panic!("JWT_PRIVATE_KEY_PEM is required when legacy HS256 verification is disabled");
        }

        Self {
            // ... load field lama kamu ...
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "identity_service".into()),
            app_port: env::var("APP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            database_url: env::var("IDENTITY_DATABASE_URL")
                .expect("IDENTITY_DATABASE_URL must be set"),
            db_max_connections,
            db_min_connections,
            db_acquire_timeout_seconds,
            db_idle_timeout_seconds,
            db_max_lifetime_seconds,
            redis_url: env::var("REDIS_URL").expect("REDIS_URL not set"),
            rabbitmq_url: env::var("RABBITMQ_URL")
                .unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/".into()),
            jwt_secret,
            jwt_private_key_pem,
            jwt_public_key_pem,
            jwt_key_id,
            jwt_allow_legacy_hs256,
            jwt_issuer: env::var("JWT_ISSUER").unwrap_or_else(|_| "laju".into()),
            jwt_audience: env::var("JWT_AUDIENCE").unwrap_or_else(|_| "laju_users".into()),
            env: app_env,
            version: env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".into()),

            // --- LOAD TAMBAHAN BARU ---
            app_domain: env::var("APP_DOMAIN").ok(),
            access_token_exp_hours: env::var("ACCESS_TOKEN_EXP_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1),
            refresh_token_exp_days: env::var("REFRESH_TOKEN_EXP_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            max_login_attempts: env::var("MAX_LOGIN_ATTEMPTS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5),
            lockout_duration_min: env::var("LOCKOUT_DURATION_MIN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(15),
            failed_login_delay_ms: env::var("FAILED_LOGIN_DELAY_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1000),
            cors_origins: Self::parse_cors_origins(),
            google_client_id: env::var("GOOGLE_CLIENT_ID")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        }
    }

    /// Helper untuk cek apakah sedang di dev mode
    pub fn is_dev(&self) -> bool {
        self.env == "development"
    }
}

pub use self::state::AppState;
