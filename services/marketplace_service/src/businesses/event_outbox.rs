use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Persist a business event into both the legacy Business OS outbox and the
/// canonical Marketplace publisher outbox within the caller's transaction.
///
/// The legacy write is intentionally retained during convergence. Producers
/// must call this boundary instead of duplicating outbox SQL so the eventual
/// legacy cutover has one owner.
pub(crate) async fn enqueue_business_event(
    tx: &mut Transaction<'_, Postgres>,
    event_id: Uuid,
    aggregate_type: &str,
    aggregate_id: Uuid,
    event_type: &str,
    payload: &Value,
    event_key: &str,
    routing_key: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO outbox_events (
          id, aggregate_type, aggregate_id, event_type, payload, event_key
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (event_key) DO NOTHING
        "#,
    )
    .bind(event_id)
    .bind(aggregate_type)
    .bind(aggregate_id)
    .bind(event_type)
    .bind(payload)
    .bind(event_key)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
          id, aggregate_type, aggregate_id, event_type, payload, routing_key, event_key
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
        "#,
    )
    .bind(event_id)
    .bind(aggregate_type)
    .bind(aggregate_id.to_string())
    .bind(event_type)
    .bind(payload)
    .bind(routing_key)
    .bind(event_key)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn convergence_boundary_keeps_one_owner() {
        let source = include_str!("event_outbox.rs");
        let legacy_insert = ["INSERT INTO", "outbox_events"].join(" ");
        let canonical_insert = ["INSERT INTO", "events.event_outbox"].join(" ");
        assert_eq!(source.matches(&legacy_insert).count(), 1);
        assert_eq!(source.matches(&canonical_insert).count(), 1);
        assert!(source.contains("ON CONFLICT (event_key)"));
    }
}
