// src/db/postgres.rs

use crate::config::Config;
use sqlx::postgres::PgPoolOptions;
use tokio::time::{sleep, Duration};

pub async fn init_postgres(cfg: &Config) -> sqlx::Pool<sqlx::Postgres> {
    let mut retries = 5;

    loop {
        match PgPoolOptions::new()
            .max_connections(cfg.db_max_connections)
            .min_connections(cfg.db_min_connections)
            .acquire_timeout(Duration::from_secs(cfg.db_acquire_timeout_seconds))
            .idle_timeout(Duration::from_secs(cfg.db_idle_timeout_seconds))
            .max_lifetime(Duration::from_secs(cfg.db_max_lifetime_seconds))
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    sqlx::query("SET search_path TO core, identity, public, events, audit")
                        .execute(conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(&cfg.database_url)
            .await
        {
            Ok(pool) => {
                println!("✅ Connected to Postgres");
                return pool;
            }
            Err(e) => {
                if retries == 0 {
                    panic!("❌ Failed to connect to Postgres after retries: {}", e);
                }
                eprintln!(
                    "⚠️ Failed to connect to Postgres, retrying in 3 seconds... ({} retries left)",
                    retries
                );
                retries -= 1;
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}
