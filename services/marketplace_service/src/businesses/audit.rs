use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::{Postgres, PgPool, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub(crate) struct BusinessAuditEvent {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) location_id: Option<Uuid>,
    pub(crate) actor_user_id: Option<Uuid>,
    pub(crate) event_key: String,
    pub(crate) subject_type: String,
    pub(crate) subject_id: Option<Uuid>,
    pub(crate) reason: Option<String>,
    pub(crate) metadata: Value,
    pub(crate) occurred_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn record_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    location_id: Option<Uuid>,
    actor_user_id: Option<Uuid>,
    event_key: &str,
    subject_type: &str,
    subject_id: Option<Uuid>,
    reason: Option<&str>,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO business_audit_events (
          organization_id, business_id, location_id, actor_user_id,
          event_key, subject_type, subject_id, reason, metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(location_id)
    .bind(actor_user_id)
    .bind(event_key)
    .bind(subject_type)
    .bind(subject_id)
    .bind(reason.map(str::trim).filter(|value| !value.is_empty()))
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Clone, Default)]
pub(crate) struct AuditFilter {
    pub(crate) subject_type: Option<String>,
    pub(crate) subject_id: Option<Uuid>,
    pub(crate) limit: i64,
}

pub(crate) async fn list(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
    filter: AuditFilter,
) -> Result<Vec<BusinessAuditEvent>, sqlx::Error> {
    let limit = filter.limit.clamp(1, 250);
    sqlx::query_as::<_, BusinessAuditEvent>(
        r#"
        SELECT id, business_id, organization_id, location_id, actor_user_id,
               event_key, subject_type, subject_id, reason, metadata, occurred_at
        FROM business_audit_events
        WHERE business_id=$1
          AND organization_id=$2
          AND ($3::text IS NULL OR subject_type=$3)
          AND ($4::uuid IS NULL OR subject_id=$4)
        ORDER BY occurred_at DESC, id DESC
        LIMIT $5
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(filter.subject_type)
    .bind(filter.subject_id)
    .bind(limit)
    .fetch_all(db)
    .await
}
