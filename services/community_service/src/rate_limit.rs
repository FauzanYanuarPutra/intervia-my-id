use axum::http::{HeaderMap, StatusCode};
use sqlx::PgPool;
use tokio::time::{sleep, Duration};

use crate::{
    auth::{request_ip, AuthActor},
    ApiError, ApiResult, AppState,
};

pub(crate) async fn enforce_rate_limit(
    state: &AppState,
    key: String,
    limit: u32,
    window_seconds: i64,
) -> ApiResult<()> {
    let window_seconds = window_seconds.max(1);
    let count = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO community_rate_limit_counters (
          rate_key,
          window_bucket,
          count,
          expires_at
        )
        VALUES (
          $1,
          FLOOR(
            EXTRACT(EPOCH FROM clock_timestamp())
            / GREATEST($2::bigint, 1)
          )::bigint,
          1,
          clock_timestamp()
            + (GREATEST($2::bigint, 1) * INTERVAL '1 second')
        )
        ON CONFLICT (rate_key, window_bucket)
        DO UPDATE
        SET
          count = community_rate_limit_counters.count + 1,
          expires_at = GREATEST(
            community_rate_limit_counters.expires_at,
            EXCLUDED.expires_at
          )
        RETURNING count::bigint
        "#,
    )
    .bind(key)
    .bind(window_seconds)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::warn!(error = ?error, "shared rate limiter unavailable");
        ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "Rate limit service unavailable",
        )
    })?;

    if count > i64::from(limit) {
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "Rate limit exceeded",
        ));
    }

    Ok(())
}

pub(crate) async fn run_rate_limit_cleanup(db: PgPool) {
    loop {
        sleep(Duration::from_secs(600)).await;
        let result = sqlx::query(
            r#"
            WITH expired AS (
              SELECT ctid
              FROM community_rate_limit_counters
              WHERE expires_at < now() - INTERVAL '1 hour'
              ORDER BY expires_at ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 5000
            )
            DELETE FROM community_rate_limit_counters AS counters
            USING expired
            WHERE counters.ctid = expired.ctid
            "#,
        )
        .execute(&db)
        .await;

        match result {
            Ok(result) if result.rows_affected() > 0 => {
                tracing::info!(
                    deleted = result.rows_affected(),
                    "cleaned expired shared rate-limit counters"
                );
            }
            Ok(_) => {}
            Err(error) => {
                tracing::warn!(error = ?error, "rate-limit cleanup failed");
            }
        }
    }
}

pub(crate) async fn mutation_rate_limit(
    state: &AppState,
    headers: &HeaderMap,
    actor: &AuthActor,
    scope: &str,
    ip_limit: u32,
    user_limit: u32,
) -> ApiResult<()> {
    let ip = request_ip(headers);
    enforce_rate_limit(state, format!("{scope}:ip:{ip}"), ip_limit, 3600).await?;
    enforce_rate_limit(
        state,
        format!("{scope}:user:{}", actor.user_id),
        user_limit,
        3600,
    )
    .await
}
