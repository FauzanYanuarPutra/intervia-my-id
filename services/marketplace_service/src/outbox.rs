use chrono::{DateTime, Utc};
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use std::env;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

const DEFAULT_BATCH_SIZE: i64 = 50;
const MAX_BATCH_SIZE: i64 = 500;
const DEFAULT_POLL_MS: u64 = 1_500;
const MIN_POLL_MS: u64 = 250;

#[derive(Debug, Clone)]
pub(crate) struct OutboxPublisherConfig {
    rabbitmq_url: String,
    exchange: String,
    batch_size: i64,
    poll_ms: u64,
}

impl OutboxPublisherConfig {
    pub(crate) fn from_env(rabbitmq_url: String) -> Self {
        let exchange =
            env::var("OUTBOX_EXCHANGE").unwrap_or_else(|_| "marketplace.outbox".to_string());
        let batch_size = env::var("OUTBOX_BATCH_SIZE")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .map(normalize_batch_size)
            .unwrap_or(DEFAULT_BATCH_SIZE);
        let poll_ms = env::var("OUTBOX_POLL_INTERVAL_MS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .map(normalize_poll_ms)
            .unwrap_or(DEFAULT_POLL_MS);

        Self {
            rabbitmq_url,
            exchange,
            batch_size,
            poll_ms,
        }
    }
}

const fn normalize_batch_size(value: i64) -> i64 {
    if value < 1 {
        1
    } else if value > MAX_BATCH_SIZE {
        MAX_BATCH_SIZE
    } else {
        value
    }
}

const fn normalize_poll_ms(value: u64) -> u64 {
    if value < MIN_POLL_MS {
        MIN_POLL_MS
    } else {
        value
    }
}

#[derive(Debug, FromRow, Clone)]
struct OutboxEventRow {
    id: Uuid,
    routing_key: String,
    event_type: String,
    event_key: Option<String>,
    payload: Value,
    lease_until: DateTime<Utc>,
}

async fn connect_outbox_channel(rabbitmq_url: &str, exchange: &str) -> anyhow::Result<Channel> {
    let conn = Connection::connect(rabbitmq_url, ConnectionProperties::default()).await?;
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

async fn publish_outbox_batch(
    db: &PgPool,
    channel: &Channel,
    exchange: &str,
    batch_size: i64,
) -> anyhow::Result<usize> {
    let events = sqlx::query_as::<_, OutboxEventRow>(
        r#"
        WITH candidate AS (
          SELECT id
          FROM events.event_outbox
          WHERE status IN ('pending', 'processing')
            AND available_at <= NOW()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE events.event_outbox AS outbox
        SET
          status = 'processing',
          available_at = NOW() + INTERVAL '2 minutes',
          error_message = NULL
        FROM candidate
        WHERE outbox.id = candidate.id
        RETURNING
          outbox.id,
          outbox.routing_key,
          outbox.event_type,
          outbox.event_key,
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

    for event in &events {
        let payload_bytes = serde_json::to_vec(&event.payload)?;
        let publish_result = channel
            .basic_publish(
                exchange,
                &event.routing_key,
                BasicPublishOptions::default(),
                &payload_bytes,
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2u8)
                    .with_message_id(
                        event
                            .event_key
                            .clone()
                            .unwrap_or_else(|| event.id.to_string())
                            .into(),
                    )
                    .with_type(event.event_type.clone().into()),
            )
            .await;

        match publish_result {
            Ok(confirm) => {
                if let Err(err) = confirm.await {
                    let error_text = format!("publish_confirm_failed: {err:?}");
                    let _ = sqlx::query(
                        r#"
                        UPDATE events.event_outbox
                        SET
                          status = 'pending',
                          retry_count = retry_count + 1,
                          available_at = NOW() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
                          error_message = $2
                        WHERE id = $1
                          AND status = 'processing'
                          AND available_at = $3
                        "#,
                    )
                    .bind(event.id)
                    .bind(error_text)
                    .bind(event.lease_until)
                    .execute(db)
                    .await;
                    continue;
                }
            }
            Err(err) => {
                let error_text = format!("publish_failed: {err:?}");
                let _ = sqlx::query(
                    r#"
                    UPDATE events.event_outbox
                    SET
                      status = 'pending',
                      retry_count = retry_count + 1,
                      available_at = NOW() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
                      error_message = $2
                    WHERE id = $1
                      AND status = 'processing'
                      AND available_at = $3
                    "#,
                )
                .bind(event.id)
                .bind(error_text)
                .bind(event.lease_until)
                .execute(db)
                .await;
                continue;
            }
        }

        let published = sqlx::query(
            r#"
            UPDATE events.event_outbox
            SET status = 'published', published_at = NOW(), error_message = NULL
            WHERE id = $1
              AND status = 'processing'
              AND available_at = $2
            "#,
        )
        .bind(event.id)
        .bind(event.lease_until)
        .execute(db)
        .await?;

        if published.rows_affected() == 1 {
            if let Some(event_key) = event.event_key.as_deref() {
                if let Err(error) = sqlx::query(
                    r#"
                    UPDATE public.outbox_events
                    SET published_at = COALESCE(published_at, NOW())
                    WHERE event_key = $1
                    "#,
                )
                .bind(event_key)
                .execute(db)
                .await
                {
                    tracing::warn!(
                        event_key,
                        ?error,
                        "failed to synchronize legacy order outbox publication state"
                    );
                }
            }
        }
    }

    Ok(events.len())
}

pub(crate) async fn run_outbox_publisher(db: PgPool, config: OutboxPublisherConfig) {
    loop {
        match connect_outbox_channel(&config.rabbitmq_url, &config.exchange).await {
            Ok(channel) => loop {
                match publish_outbox_batch(&db, &channel, &config.exchange, config.batch_size).await
                {
                    Ok(0) => sleep(Duration::from_millis(config.poll_ms)).await,
                    Ok(_) => {}
                    Err(error) => {
                        tracing::warn!("outbox publish error: {:?}", error);
                        sleep(Duration::from_secs(2)).await;
                        break;
                    }
                }
            },
            Err(error) => {
                tracing::warn!("outbox connection error: {:?}", error);
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_batch_size, normalize_poll_ms, MAX_BATCH_SIZE, MIN_POLL_MS};

    #[test]
    fn outbox_batch_size_is_bounded() {
        assert_eq!(normalize_batch_size(-5), 1);
        assert_eq!(normalize_batch_size(50), 50);
        assert_eq!(normalize_batch_size(10_000), MAX_BATCH_SIZE);
    }

    #[test]
    fn outbox_poll_interval_has_a_floor() {
        assert_eq!(normalize_poll_ms(1), MIN_POLL_MS);
        assert_eq!(normalize_poll_ms(1_500), 1_500);
    }
}
