pub mod state;

use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    // ... field lama kamu ...
    pub app_name: String,
    pub app_port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub rabbitmq_url: String,
    pub jwt_secret: String,
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
}

impl Config {
    fn parse_cors_origins() -> Vec<String> {
        let raw = env::var("CORS_ORIGINS")
            .ok()
            .or_else(|| env::var("CORS_ORIGIN").ok())
            .unwrap_or_else(|| {
                "http://localhost:3000,http://localhost:3001,http://localhost:3002".into()
            });

        raw.split(',')
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .collect()
    }

    pub fn from_env() -> Self {
        dotenv().ok();

        Self {
            // ... load field lama kamu ...
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "identity_service".into()),
            app_port: env::var("APP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL not set"),
            redis_url: env::var("REDIS_URL").expect("REDIS_URL not set"),
            rabbitmq_url: env::var("RABBITMQ_URL")
                .unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/".into()),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set for security"),
            jwt_issuer: env::var("JWT_ISSUER").unwrap_or_else(|_| "laju".into()),
            jwt_audience: env::var("JWT_AUDIENCE").unwrap_or_else(|_| "laju_users".into()),
            env: env::var("ENV").unwrap_or_else(|_| "development".into()),
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
        }
    }

    /// Helper untuk cek apakah sedang di dev mode
    pub fn is_dev(&self) -> bool {
        self.env == "development"
    }
}

pub use self::state::AppState;
