// src/db/postgres.rs

use crate::config::Config;
use sqlx::postgres::PgPoolOptions;
use tokio::time::{sleep, Duration};

pub async fn init_postgres(cfg: &Config) -> sqlx::Pool<sqlx::Postgres> {
    let mut retries = 5;

    loop {
        match PgPoolOptions::new()
            .max_connections(10)
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
