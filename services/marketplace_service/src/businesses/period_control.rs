use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::event_outbox::enqueue_business_event;

const MAX_REASON: usize = 2_000;
const MAX_SNAPSHOT_BYTES: usize = 64 * 1024;
const MAX_PERIOD_DAYS: i64 = 3_660;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PeriodControlError {
    Validation(&'static str),
    NotFound,
    Conflict,
    PeriodClosed,
    DayClosed,
    Database,
}

impl From<sqlx::Error> for PeriodControlError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(&error, sqlx::Error::Database(db) if db.is_unique_violation()) {
            Self::Conflict
        } else {
            Self::Database
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ClosePeriodRequest {
    pub(crate) period_start: NaiveDate,
    pub(crate) period_end: NaiveDate,
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ReopenPeriodRequest {
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CloseDayRequest {
    pub(crate) location_id: Uuid,
    pub(crate) business_date: NaiveDate,
    pub(crate) reason: String,
    #[serde(default = "default_object")]
    pub(crate) snapshot: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ReopenDayRequest {
    pub(crate) reason: String,
}

fn default_object() -> Value {
    json!({})
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct AccountingPeriodRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) period_start: NaiveDate,
    pub(crate) period_end: NaiveDate,
    pub(crate) status: String,
    pub(crate) version: i64,
    pub(crate) closed_by_user_id: Option<Uuid>,
    pub(crate) closed_at: Option<DateTime<Utc>>,
    pub(crate) close_reason: Option<String>,
    pub(crate) reopened_by_user_id: Option<Uuid>,
    pub(crate) reopened_at: Option<DateTime<Utc>>,
    pub(crate) reopen_reason: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct DayCloseRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Uuid,
    pub(crate) business_date: NaiveDate,
    pub(crate) status: String,
    pub(crate) close_snapshot: Value,
    pub(crate) version: i64,
    pub(crate) closed_by_user_id: Option<Uuid>,
    pub(crate) closed_at: Option<DateTime<Utc>>,
    pub(crate) close_reason: Option<String>,
    pub(crate) reopened_by_user_id: Option<Uuid>,
    pub(crate) reopened_at: Option<DateTime<Utc>>,
    pub(crate) reopen_reason: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CloseOutcome<T> {
    pub(crate) record: T,
    pub(crate) replayed: bool,
}

#[derive(Clone)]
pub(crate) struct PeriodControlRepository {
    db: PgPool,
}

impl PeriodControlRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list_periods(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<AccountingPeriodRecord>, PeriodControlError> {
        sqlx::query_as::<_, AccountingPeriodRecord>(PERIOD_SELECT_LIST)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn list_days(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<DayCloseRecord>, PeriodControlError> {
        sqlx::query_as::<_, DayCloseRecord>(DAY_SELECT_LIST)
            .bind(business_id)
            .bind(organization_id)
            .bind(limit.clamp(1, 500))
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn close_period(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: ClosePeriodRequest,
    ) -> Result<CloseOutcome<AccountingPeriodRecord>, PeriodControlError> {
        validate_period_range(request.period_start, request.period_end)?;
        let reason = normalize_reason(&request.reason)?;
        let fingerprint = json!({
            "period_start": request.period_start,
            "period_end": request.period_end,
            "reason": reason,
        });
        let request_hash = canonical_hash(&fingerprint)?;
        let mut tx = self.db.begin().await?;
        lock_close_control(&mut tx, business_id).await?;

        if let Some(command) =
            load_command_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if command.request_hash != request_hash || command.command_type != "close_period" {
                return Err(PeriodControlError::Conflict);
            }
            let record = load_period_tx(
                &mut tx,
                business_id,
                organization_id,
                command.target_id,
                false,
            )
            .await?
            .ok_or(PeriodControlError::Database)?;
            tx.commit().await?;
            return Ok(CloseOutcome {
                record,
                replayed: true,
            });
        }

        let overlaps: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_accounting_periods
              WHERE business_id=$1 AND organization_id=$2 AND status='closed'
                AND NOT (period_end < $3 OR period_start > $4)
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(request.period_start)
        .bind(request.period_end)
        .fetch_one(&mut *tx)
        .await?;
        if overlaps {
            return Err(PeriodControlError::Conflict);
        }

        let existing = sqlx::query_as::<_, AccountingPeriodRecord>(
            &format!("{PERIOD_SELECT_EXACT} FOR UPDATE"),
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(request.period_start)
        .bind(request.period_end)
        .fetch_optional(&mut *tx)
        .await?;

        let record = match existing {
            Some(existing) if existing.status == "open" => {
                sqlx::query_as::<_, AccountingPeriodRecord>(
                    r#"
                    UPDATE business_accounting_periods
                    SET status='closed',version=version+1,closed_by_user_id=$5,closed_at=NOW(),
                        close_reason=$6,reopened_by_user_id=NULL,reopened_at=NULL,reopen_reason=NULL,
                        updated_at=NOW()
                    WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND version=$4
                    RETURNING id,organization_id,business_id,period_start,period_end,status,version,
                              closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
                              reopen_reason,created_at,updated_at
                    "#,
                )
                .bind(existing.id)
                .bind(business_id)
                .bind(organization_id)
                .bind(existing.version)
                .bind(actor_id)
                .bind(&reason)
                .fetch_one(&mut *tx)
                .await?
            }
            Some(_) => return Err(PeriodControlError::Conflict),
            None => {
                sqlx::query_as::<_, AccountingPeriodRecord>(
                    r#"
                    INSERT INTO business_accounting_periods (
                      organization_id,business_id,period_start,period_end,status,
                      closed_by_user_id,closed_at,close_reason
                    ) VALUES ($1,$2,$3,$4,'closed',$5,NOW(),$6)
                    RETURNING id,organization_id,business_id,period_start,period_end,status,version,
                              closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
                              reopen_reason,created_at,updated_at
                    "#,
                )
                .bind(organization_id)
                .bind(business_id)
                .bind(request.period_start)
                .bind(request.period_end)
                .bind(actor_id)
                .bind(&reason)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        let command_id = insert_command_tx(
            &mut tx,
            organization_id,
            business_id,
            idempotency_key,
            &request_hash,
            "close_period",
            "accounting_period",
            record.id,
            actor_id,
        )
        .await?;
        insert_close_event_tx(
            &mut tx,
            organization_id,
            business_id,
            "accounting_period",
            record.id,
            Some("open"),
            "closed",
            &reason,
            actor_id,
            command_id,
            json!({"period_start":record.period_start,"period_end":record.period_end}),
        )
        .await?;
        emit_close_event(
            &mut tx,
            record.id,
            business_id,
            organization_id,
            "accounting_period",
            "closed",
            record.version,
        )
        .await?;
        tx.commit().await?;
        Ok(CloseOutcome {
            record,
            replayed: false,
        })
    }

    pub(crate) async fn reopen_period(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        period_id: Uuid,
        idempotency_key: Uuid,
        request: ReopenPeriodRequest,
    ) -> Result<CloseOutcome<AccountingPeriodRecord>, PeriodControlError> {
        let reason = normalize_reason(&request.reason)?;
        let fingerprint = json!({"period_id":period_id,"reason":reason});
        let request_hash = canonical_hash(&fingerprint)?;
        let mut tx = self.db.begin().await?;
        lock_close_control(&mut tx, business_id).await?;

        if let Some(command) =
            load_command_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if command.request_hash != request_hash || command.command_type != "reopen_period" {
                return Err(PeriodControlError::Conflict);
            }
            let record = load_period_tx(
                &mut tx,
                business_id,
                organization_id,
                command.target_id,
                false,
            )
            .await?
            .ok_or(PeriodControlError::Database)?;
            tx.commit().await?;
            return Ok(CloseOutcome {
                record,
                replayed: true,
            });
        }

        let current =
            load_period_tx(&mut tx, business_id, organization_id, period_id, true)
                .await?
                .ok_or(PeriodControlError::NotFound)?;
        if current.status != "closed" {
            return Err(PeriodControlError::Conflict);
        }
        let record = sqlx::query_as::<_, AccountingPeriodRecord>(
            r#"
            UPDATE business_accounting_periods
            SET status='open',version=version+1,reopened_by_user_id=$5,reopened_at=NOW(),
                reopen_reason=$6,updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND version=$4
            RETURNING id,organization_id,business_id,period_start,period_end,status,version,
                      closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
                      reopen_reason,created_at,updated_at
            "#,
        )
        .bind(period_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(current.version)
        .bind(actor_id)
        .bind(&reason)
        .fetch_one(&mut *tx)
        .await?;

        let command_id = insert_command_tx(
            &mut tx,
            organization_id,
            business_id,
            idempotency_key,
            &request_hash,
            "reopen_period",
            "accounting_period",
            record.id,
            actor_id,
        )
        .await?;
        insert_close_event_tx(
            &mut tx,
            organization_id,
            business_id,
            "accounting_period",
            record.id,
            Some("closed"),
            "open",
            &reason,
            actor_id,
            command_id,
            json!({"period_start":record.period_start,"period_end":record.period_end}),
        )
        .await?;
        emit_close_event(
            &mut tx,
            record.id,
            business_id,
            organization_id,
            "accounting_period",
            "open",
            record.version,
        )
        .await?;
        tx.commit().await?;
        Ok(CloseOutcome {
            record,
            replayed: false,
        })
    }

    pub(crate) async fn close_day(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CloseDayRequest,
    ) -> Result<CloseOutcome<DayCloseRecord>, PeriodControlError> {
        let reason = normalize_reason(&request.reason)?;
        let snapshot = normalize_snapshot(request.snapshot)?;
        let fingerprint = json!({
            "location_id":request.location_id,
            "business_date":request.business_date,
            "reason":reason,
            "snapshot":snapshot,
        });
        let request_hash = canonical_hash(&fingerprint)?;
        let mut tx = self.db.begin().await?;
        lock_close_control(&mut tx, business_id).await?;
        ensure_location_tx(
            &mut tx,
            business_id,
            organization_id,
            request.location_id,
        )
        .await?;

        if let Some(command) =
            load_command_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if command.request_hash != request_hash || command.command_type != "close_day" {
                return Err(PeriodControlError::Conflict);
            }
            let record = load_day_tx(
                &mut tx,
                business_id,
                organization_id,
                command.target_id,
                false,
            )
            .await?
            .ok_or(PeriodControlError::Database)?;
            tx.commit().await?;
            return Ok(CloseOutcome {
                record,
                replayed: true,
            });
        }

        let existing = sqlx::query_as::<_, DayCloseRecord>(
            &format!("{DAY_SELECT_EXACT} FOR UPDATE"),
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(request.location_id)
        .bind(request.business_date)
        .fetch_optional(&mut *tx)
        .await?;

        let record = match existing {
            Some(existing) if existing.status == "open" => {
                sqlx::query_as::<_, DayCloseRecord>(
                    r#"
                    UPDATE business_day_closes
                    SET status='closed',close_snapshot=$5,version=version+1,
                        closed_by_user_id=$6,closed_at=NOW(),close_reason=$7,
                        reopened_by_user_id=NULL,reopened_at=NULL,reopen_reason=NULL,updated_at=NOW()
                    WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND version=$4
                    RETURNING id,organization_id,business_id,location_id,business_date,status,
                              close_snapshot,version,closed_by_user_id,closed_at,close_reason,
                              reopened_by_user_id,reopened_at,reopen_reason,created_at,updated_at
                    "#,
                )
                .bind(existing.id)
                .bind(business_id)
                .bind(organization_id)
                .bind(existing.version)
                .bind(&snapshot)
                .bind(actor_id)
                .bind(&reason)
                .fetch_one(&mut *tx)
                .await?
            }
            Some(_) => return Err(PeriodControlError::Conflict),
            None => {
                sqlx::query_as::<_, DayCloseRecord>(
                    r#"
                    INSERT INTO business_day_closes (
                      organization_id,business_id,location_id,business_date,status,close_snapshot,
                      closed_by_user_id,closed_at,close_reason
                    ) VALUES ($1,$2,$3,$4,'closed',$5,$6,NOW(),$7)
                    RETURNING id,organization_id,business_id,location_id,business_date,status,
                              close_snapshot,version,closed_by_user_id,closed_at,close_reason,
                              reopened_by_user_id,reopened_at,reopen_reason,created_at,updated_at
                    "#,
                )
                .bind(organization_id)
                .bind(business_id)
                .bind(request.location_id)
                .bind(request.business_date)
                .bind(&snapshot)
                .bind(actor_id)
                .bind(&reason)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        let command_id = insert_command_tx(
            &mut tx,
            organization_id,
            business_id,
            idempotency_key,
            &request_hash,
            "close_day",
            "business_day",
            record.id,
            actor_id,
        )
        .await?;
        insert_close_event_tx(
            &mut tx,
            organization_id,
            business_id,
            "business_day",
            record.id,
            Some("open"),
            "closed",
            &reason,
            actor_id,
            command_id,
            json!({"location_id":record.location_id,"business_date":record.business_date}),
        )
        .await?;
        emit_close_event(
            &mut tx,
            record.id,
            business_id,
            organization_id,
            "business_day",
            "closed",
            record.version,
        )
        .await?;
        tx.commit().await?;
        Ok(CloseOutcome {
            record,
            replayed: false,
        })
    }

    pub(crate) async fn reopen_day(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        day_id: Uuid,
        idempotency_key: Uuid,
        request: ReopenDayRequest,
    ) -> Result<CloseOutcome<DayCloseRecord>, PeriodControlError> {
        let reason = normalize_reason(&request.reason)?;
        let fingerprint = json!({"day_id":day_id,"reason":reason});
        let request_hash = canonical_hash(&fingerprint)?;
        let mut tx = self.db.begin().await?;
        lock_close_control(&mut tx, business_id).await?;

        if let Some(command) =
            load_command_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if command.request_hash != request_hash || command.command_type != "reopen_day" {
                return Err(PeriodControlError::Conflict);
            }
            let record = load_day_tx(
                &mut tx,
                business_id,
                organization_id,
                command.target_id,
                false,
            )
            .await?
            .ok_or(PeriodControlError::Database)?;
            tx.commit().await?;
            return Ok(CloseOutcome {
                record,
                replayed: true,
            });
        }

        let current = load_day_tx(&mut tx, business_id, organization_id, day_id, true)
            .await?
            .ok_or(PeriodControlError::NotFound)?;
        if current.status != "closed" {
            return Err(PeriodControlError::Conflict);
        }
        let record = sqlx::query_as::<_, DayCloseRecord>(
            r#"
            UPDATE business_day_closes
            SET status='open',version=version+1,reopened_by_user_id=$5,reopened_at=NOW(),
                reopen_reason=$6,updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND version=$4
            RETURNING id,organization_id,business_id,location_id,business_date,status,
                      close_snapshot,version,closed_by_user_id,closed_at,close_reason,
                      reopened_by_user_id,reopened_at,reopen_reason,created_at,updated_at
            "#,
        )
        .bind(day_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(current.version)
        .bind(actor_id)
        .bind(&reason)
        .fetch_one(&mut *tx)
        .await?;

        let command_id = insert_command_tx(
            &mut tx,
            organization_id,
            business_id,
            idempotency_key,
            &request_hash,
            "reopen_day",
            "business_day",
            record.id,
            actor_id,
        )
        .await?;
        insert_close_event_tx(
            &mut tx,
            organization_id,
            business_id,
            "business_day",
            record.id,
            Some("closed"),
            "open",
            &reason,
            actor_id,
            command_id,
            json!({"location_id":record.location_id,"business_date":record.business_date}),
        )
        .await?;
        emit_close_event(
            &mut tx,
            record.id,
            business_id,
            organization_id,
            "business_day",
            "open",
            record.version,
        )
        .await?;
        tx.commit().await?;
        Ok(CloseOutcome {
            record,
            replayed: false,
        })
    }
}

pub(crate) async fn assert_business_date_open_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Option<Uuid>,
    business_date: NaiveDate,
) -> Result<(), PeriodControlError> {
    let period_closed: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM business_accounting_periods
          WHERE business_id=$1 AND organization_id=$2 AND status='closed'
            AND $3 BETWEEN period_start AND period_end
        )
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(business_date)
    .fetch_one(&mut **tx)
    .await?;
    if period_closed {
        return Err(PeriodControlError::PeriodClosed);
    }

    if let Some(location_id) = location_id {
        let day_closed: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_day_closes
              WHERE business_id=$1 AND organization_id=$2 AND location_id=$3
                AND business_date=$4 AND status='closed'
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .bind(business_date)
        .fetch_one(&mut **tx)
        .await?;
        if day_closed {
            return Err(PeriodControlError::DayClosed);
        }
    }
    Ok(())
}

#[derive(Debug, FromRow)]
struct CloseCommandRecord {
    request_hash: String,
    command_type: String,
    target_id: Uuid,
}

fn validate_period_range(start: NaiveDate, end: NaiveDate) -> Result<(), PeriodControlError> {
    if end < start || (end - start).num_days() > MAX_PERIOD_DAYS {
        Err(PeriodControlError::Validation("invalid_accounting_period_range"))
    } else {
        Ok(())
    }
}

fn normalize_reason(value: &str) -> Result<String, PeriodControlError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > MAX_REASON {
        Err(PeriodControlError::Validation("close_reason_required"))
    } else {
        Ok(value)
    }
}

fn normalize_snapshot(value: Value) -> Result<Value, PeriodControlError> {
    if !value.is_object() {
        return Err(PeriodControlError::Validation("close_snapshot_must_be_object"));
    }
    let bytes = serde_json::to_vec(&value).map_err(|_| PeriodControlError::Database)?;
    if bytes.len() > MAX_SNAPSHOT_BYTES {
        return Err(PeriodControlError::Validation("close_snapshot_too_large"));
    }
    Ok(value)
}

fn canonical_hash<T: Serialize>(value: &T) -> Result<String, PeriodControlError> {
    let bytes = serde_json::to_vec(value).map_err(|_| PeriodControlError::Database)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

async fn lock_close_control(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
) -> Result<(), PeriodControlError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("business-close-control:{business_id}"))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn ensure_location_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
) -> Result<(), PeriodControlError> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM business_locations
          WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status <> 'closed'
        )
        "#,
    )
    .bind(location_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(PeriodControlError::NotFound)
    }
}

async fn insert_command_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    idempotency_key: Uuid,
    request_hash: &str,
    command_type: &str,
    target_type: &str,
    target_id: Uuid,
    actor_id: Uuid,
) -> Result<Uuid, PeriodControlError> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO business_close_commands (
          organization_id,business_id,idempotency_key,request_hash,command_type,
          target_type,target_id,actor_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(idempotency_key)
    .bind(request_hash)
    .bind(command_type)
    .bind(target_type)
    .bind(target_id)
    .bind(actor_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn load_command_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<CloseCommandRecord>, PeriodControlError> {
    sqlx::query_as::<_, CloseCommandRecord>(
        r#"
        SELECT request_hash,command_type,target_id
        FROM business_close_commands
        WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

#[allow(clippy::too_many_arguments)]
async fn insert_close_event_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    target_type: &str,
    target_id: Uuid,
    from_status: Option<&str>,
    to_status: &str,
    reason: &str,
    actor_id: Uuid,
    command_id: Uuid,
    metadata: Value,
) -> Result<(), PeriodControlError> {
    sqlx::query(
        r#"
        INSERT INTO business_close_events (
          organization_id,business_id,target_type,target_id,from_status,to_status,
          reason,actor_user_id,command_id,metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(target_type)
    .bind(target_id)
    .bind(from_status)
    .bind(to_status)
    .bind(reason)
    .bind(actor_id)
    .bind(command_id)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn emit_close_event(
    tx: &mut Transaction<'_, Postgres>,
    target_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    target_type: &str,
    status: &str,
    version: i64,
) -> Result<(), PeriodControlError> {
    let event_id = Uuid::new_v4();
    let event_type = "marketplace.business.period_control_changed";
    let payload = json!({
        "event_version":1,
        "target_type":target_type,
        "target_id":target_id,
        "business_id":business_id,
        "organization_id":organization_id,
        "status":status,
        "version":version,
    });
    enqueue_business_event(
        tx,
        event_id,
        "business_period_control",
        target_id,
        event_type,
        &payload,
        &format!("period-control:{target_type}:{target_id}:v{version}"),
        event_type,
    )
    .await?;
    Ok(())
}

async fn load_period_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    period_id: Uuid,
    for_update: bool,
) -> Result<Option<AccountingPeriodRecord>, PeriodControlError> {
    let suffix = if for_update { " FOR UPDATE" } else { "" };
    let sql = format!("{PERIOD_SELECT_ONE}{suffix}");
    sqlx::query_as::<_, AccountingPeriodRecord>(&sql)
        .bind(period_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_day_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    day_id: Uuid,
    for_update: bool,
) -> Result<Option<DayCloseRecord>, PeriodControlError> {
    let suffix = if for_update { " FOR UPDATE" } else { "" };
    let sql = format!("{DAY_SELECT_ONE}{suffix}");
    sqlx::query_as::<_, DayCloseRecord>(&sql)
        .bind(day_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

const PERIOD_SELECT_LIST: &str = r#"
SELECT id,organization_id,business_id,period_start,period_end,status,version,
       closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_accounting_periods
WHERE business_id=$1 AND organization_id=$2
ORDER BY period_start DESC,period_end DESC,id DESC
"#;

const PERIOD_SELECT_ONE: &str = r#"
SELECT id,organization_id,business_id,period_start,period_end,status,version,
       closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_accounting_periods
WHERE id=$1 AND business_id=$2 AND organization_id=$3
"#;

const PERIOD_SELECT_EXACT: &str = r#"
SELECT id,organization_id,business_id,period_start,period_end,status,version,
       closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_accounting_periods
WHERE business_id=$1 AND organization_id=$2 AND period_start=$3 AND period_end=$4
"#;

const DAY_SELECT_LIST: &str = r#"
SELECT id,organization_id,business_id,location_id,business_date,status,close_snapshot,
       version,closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_day_closes
WHERE business_id=$1 AND organization_id=$2
ORDER BY business_date DESC,created_at DESC,id DESC
LIMIT $3
"#;

const DAY_SELECT_ONE: &str = r#"
SELECT id,organization_id,business_id,location_id,business_date,status,close_snapshot,
       version,closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_day_closes
WHERE id=$1 AND business_id=$2 AND organization_id=$3
"#;

const DAY_SELECT_EXACT: &str = r#"
SELECT id,organization_id,business_id,location_id,business_date,status,close_snapshot,
       version,closed_by_user_id,closed_at,close_reason,reopened_by_user_id,reopened_at,
       reopen_reason,created_at,updated_at
FROM business_day_closes
WHERE business_id=$1 AND organization_id=$2 AND location_id=$3 AND business_date=$4
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn period_range_is_bounded_and_reason_required() {
        let start = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        assert!(validate_period_range(start, end).is_ok());
        assert!(validate_period_range(end, start).is_err());
        assert!(normalize_reason(" tutup bulan ").is_ok());
        assert!(normalize_reason("   ").is_err());
    }

    #[test]
    fn close_snapshot_must_remain_bounded_object() {
        assert!(normalize_snapshot(json!({"cash":1000})).is_ok());
        assert!(normalize_snapshot(json!([1,2,3])).is_err());
    }
}
