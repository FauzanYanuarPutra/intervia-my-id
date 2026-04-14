use crate::config::Config;
use deadpool_redis::{Config as RedisConfig, Pool};
use redis::AsyncCommands;
use tokio::time::{sleep, timeout, Duration};

pub async fn init_redis(cfg: &Config) -> Pool {
    let mut retries = 5u8;

    loop {
        let redis_cfg = RedisConfig::from_url(&cfg.redis_url);
        let pool = redis_cfg
            .create_pool(None)
            .expect("Failed to create Redis pool");

        let attempt = async {
            let mut conn = pool
                .get()
                .await
                .map_err(|error| format!("failed to get Redis connection from pool: {error}"))?;
            let pong: String = conn
                .ping()
                .await
                .map_err(|error| format!("Redis did not respond to PING: {error}"))?;
            Ok::<String, String>(pong)
        };

        match timeout(Duration::from_secs(8), attempt).await {
            Ok(Ok(pong)) => {
                println!("Redis PING OK: {}", pong);
                return pool;
            }
            Ok(Err(error)) => {
                if retries == 0 {
                    panic!("Failed to initialize Redis after retries: {}", error);
                }
                eprintln!(
                    "Redis init failed, retrying in 2 seconds... ({} retries left): {}",
                    retries, error
                );
            }
            Err(_) => {
                if retries == 0 {
                    panic!("Timed out while initializing Redis after retries");
                }
                eprintln!(
                    "Redis init timed out, retrying in 2 seconds... ({} retries left)",
                    retries
                );
            }
        }

        retries -= 1;
        sleep(Duration::from_secs(2)).await;
    }
}
