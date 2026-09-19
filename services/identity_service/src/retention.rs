use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tokio::time::{sleep, Duration};

const DEFAULT_INTERVAL_SECONDS: u64 = 3_600;
const MIN_INTERVAL_SECONDS: u64 = 300;
const BATCH_SIZE: i64 = 500;

fn interval_seconds() -> u64 {
    std::env::var("RETENTION_SWEEP_INTERVAL_SECONDS")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(DEFAULT_INTERVAL_SECONDS)
        .max(MIN_INTERVAL_SECONDS)
}

fn cutoff(retention_days: i32, now: DateTime<Utc>) -> DateTime<Utc> {
    now - chrono::Duration::days(i64::from(retention_days))
}

async fn policy_days(db: &PgPool, key: &str) -> Result<Option<i32>> {
    let row = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT retention_days
        FROM core.retention_policies
        WHERE policy_key = $1
          AND enabled = TRUE
        "#,
    )
    .bind(key)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

async fn delete_batch(db: &PgPool, policy_key: &str, retention_days: i32) -> Result<i64> {
    let now = Utc::now();
    let cutoff = cutoff(retention_days, now);

    let deleted: i64 = match policy_key {
        "privacy_requests_closed" => {
            sqlx::query_scalar(
                r#"
                WITH victims AS (
                  SELECT id
                  FROM core.privacy_requests
                  WHERE completed_at IS NOT NULL
                    AND completed_at < $1
                    AND legal_hold = FALSE
                  ORDER BY completed_at ASC
                  LIMIT $2
                )
                DELETE FROM core.privacy_requests target
                USING victims
                WHERE target.id = victims.id
                RETURNING 1
                "#,
            )
            .bind(cutoff)
            .bind(BATCH_SIZE)
            .fetch_all(db)
            .await?
            .len() as i64
        }
        "security_incidents_closed" => {
            sqlx::query_scalar(
                r#"
                WITH victims AS (
                  SELECT id
                  FROM core.security_incidents
                  WHERE closed_at IS NOT NULL
                    AND closed_at < $1
                    AND legal_hold = FALSE
                  ORDER BY closed_at ASC
                  LIMIT $2
                )
                DELETE FROM core.security_incidents target
                USING victims
                WHERE target.id = victims.id
                RETURNING 1
                "#,
            )
            .bind(cutoff)
            .bind(BATCH_SIZE)
            .fetch_all(db)
            .await?
            .len() as i64
        }
        "governance_audit_events" => {
            sqlx::query_scalar(
                r#"
                WITH victims AS (
                  SELECT id
                  FROM core.governance_audit_events
                  WHERE created_at < $1
                  ORDER BY created_at ASC
                  LIMIT $2
                )
                DELETE FROM core.governance_audit_events target
                USING victims
                WHERE target.id = victims.id
                RETURNING 1
                "#,
            )
            .bind(cutoff)
            .bind(BATCH_SIZE)
            .fetch_all(db)
            .await?
            .len() as i64
        }
        "user_moderation_actions" => {
            sqlx::query_scalar(
                r#"
                WITH victims AS (
                  SELECT id
                  FROM core.user_moderation_actions
                  WHERE created_at < $1
                  ORDER BY created_at ASC
                  LIMIT $2
                )
                DELETE FROM core.user_moderation_actions target
                USING victims
                WHERE target.id = victims.id
                RETURNING 1
                "#,
            )
            .bind(cutoff)
            .bind(BATCH_SIZE)
            .fetch_all(db)
            .await?
            .len() as i64
        }
        _ => 0,
    };

    Ok(deleted)
}

async fn run_policy(db: &PgPool, policy_key: &str) -> Result<i64> {
    let Some(retention_days) = policy_days(db, policy_key).await? else {
        return Ok(0);
    };

    let run_id: uuid::Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO core.retention_runs (policy_key, status)
        VALUES ($1, 'running')
        RETURNING id
        "#,
    )
    .bind(policy_key)
    .fetch_one(db)
    .await?;

    let result = delete_batch(db, policy_key, retention_days).await;

    match result {
        Ok(count) => {
            sqlx::query(
                r#"
                UPDATE core.retention_runs
                SET finished_at = NOW(), rows_deleted = $2, status = 'completed'
                WHERE id = $1
                "#,
            )
            .bind(run_id)
            .bind(count)
            .execute(db)
            .await?;
            Ok(count)
        }
        Err(error) => {
            let message = error.to_string();
            let _ = sqlx::query(
                r#"
                UPDATE core.retention_runs
                SET finished_at = NOW(), status = 'failed', error_message = $2
                WHERE id = $1
                "#,
            )
            .bind(run_id)
            .bind(&message)
            .execute(db)
            .await;
            Err(error)
        }
    }
}

pub(crate) async fn run_retention_sweep(db: PgPool) {
    let interval = interval_seconds();
    let policies = [
        "privacy_requests_closed",
        "security_incidents_closed",
        "governance_audit_events",
        "user_moderation_actions",
    ];

    loop {
        for policy_key in policies {
            match run_policy(&db, policy_key).await {
                Ok(count) if count > 0 => {
                    tracing::info!(policy_key, rows_deleted = count, "retention sweep applied");
                }
                Ok(_) => {}
                Err(error) => {
                    tracing::error!(policy_key, ?error, "retention sweep failed");
                }
            }
        }

        sleep(Duration::from_secs(interval)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{cutoff, interval_seconds, MIN_INTERVAL_SECONDS};
    use chrono::{Duration, Utc};

    #[test]
    fn retention_interval_has_a_safe_floor() {
        std::env::remove_var("RETENTION_SWEEP_INTERVAL_SECONDS");
        assert!(interval_seconds() >= MIN_INTERVAL_SECONDS);
    }

    #[test]
    fn cutoff_is_older_than_now() {
        let now = Utc::now();
        assert!(cutoff(30, now) <= now - Duration::days(30));
    }
}
