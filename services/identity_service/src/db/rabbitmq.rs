use crate::config::Config;
use lapin::{Connection, ConnectionProperties};
use std::sync::Arc;
use tokio::time::{sleep, timeout, Duration};

pub async fn init_rabbitmq(cfg: &Config) -> Arc<Connection> {
    let mut retries = 5u8;

    loop {
        match timeout(
            Duration::from_secs(8),
            Connection::connect(&cfg.rabbitmq_url, ConnectionProperties::default()),
        )
        .await
        {
            Ok(Ok(conn)) => {
                println!("RabbitMQ connected successfully");
                return Arc::new(conn);
            }
            Ok(Err(error)) => {
                if retries == 0 {
                    panic!("Failed to connect to RabbitMQ after retries: {}", error);
                }
                eprintln!(
                    "RabbitMQ init failed, retrying in 2 seconds... ({} retries left): {}",
                    retries, error
                );
            }
            Err(_) => {
                if retries == 0 {
                    panic!("Timed out while connecting to RabbitMQ after retries");
                }
                eprintln!(
                    "RabbitMQ init timed out, retrying in 2 seconds... ({} retries left)",
                    retries
                );
            }
        }

        retries -= 1;
        sleep(Duration::from_secs(2)).await;
    }
}
