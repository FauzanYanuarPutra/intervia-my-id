use anyhow::{Context, Result};
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use rand_core::OsRng;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

const DEV_AGENT_ID: &str = "00000000-0000-0000-0000-000000000005";
const DEV_AGENT_EMAIL: &str = "agent@lajukan.com";
const DEFAULT_DEV_PASSWORD: &str = "Test123!@#";

fn flag_enabled(value: Option<&str>, default: bool) -> bool {
    let Some(value) = value else {
        return default;
    };
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        _ => default,
    }
}

fn should_seed_ops_user(environment: &str, flag: Option<&str>) -> bool {
    environment == "development" && flag_enabled(flag, true)
}

fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| anyhow::anyhow!("failed to hash development ops password: {error}"))
}

pub async fn ensure_development_ops_user(pool: &PgPool, environment: &str) -> Result<bool> {
    if !should_seed_ops_user(environment, env::var("DEV_SEED_OPS_USER").ok().as_deref()) {
        return Ok(false);
    }

    let password = env::var("DEV_SEED_OPS_PASSWORD")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_DEV_PASSWORD.to_string());
    let password_hash = hash_password(&password)?;
    let preferred_id = Uuid::parse_str(DEV_AGENT_ID).context("invalid development agent id")?;

    let mut tx = pool.begin().await?;
    let existing_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM core.users
        WHERE id = $1
           OR lower(COALESCE(email::text, '')) = lower($2)
        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
        LIMIT 1
        "#,
    )
    .bind(preferred_id)
    .bind(DEV_AGENT_EMAIL)
    .fetch_optional(&mut *tx)
    .await?;

    let user_id = existing_id.unwrap_or(preferred_id);
    if existing_id.is_some() {
        sqlx::query(
            r#"
            UPDATE core.users
            SET email = $1,
                email_verified = TRUE,
                password_hash = $2,
                password_changed_at = NOW(),
                is_active = TRUE,
                status = 'active',
                failed_login_attempts = 0,
                lockout_expires_at = NULL,
                deleted_at = NULL,
                updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(DEV_AGENT_EMAIL)
        .bind(&password_hash)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO core.users (
                id,
                email,
                email_verified,
                password_hash,
                password_changed_at,
                is_active,
                status,
                failed_login_attempts,
                created_at,
                updated_at
            )
            VALUES ($1, $2, TRUE, $3, NOW(), TRUE, 'active', 0, NOW(), NOW())
            "#,
        )
        .bind(user_id)
        .bind(DEV_AGENT_EMAIL)
        .bind(&password_hash)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        r#"
        INSERT INTO core.user_profiles (user_id, full_name, updated_at)
        VALUES ($1, 'Lajukan CRM Agent', NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO core.roles (id, name, description, system, role_type)
        VALUES
            (gen_random_uuid(), 'sales', 'CRM sales operator', TRUE, 'global'),
            (gen_random_uuid(), 'support', 'CRM support agent', TRUE, 'global')
        ON CONFLICT (name) DO NOTHING
        "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO core.user_roles (user_id, role_id)
        SELECT $1, id
        FROM core.roles
        WHERE name IN ('sales', 'support')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{flag_enabled, should_seed_ops_user};

    #[test]
    fn development_seed_flag_is_predictable() {
        assert!(flag_enabled(None, true));
        assert!(flag_enabled(Some("yes"), false));
        assert!(!flag_enabled(Some("off"), true));
        assert!(flag_enabled(Some("unexpected"), true));
    }

    #[test]
    fn ops_user_seed_never_runs_outside_development() {
        assert!(should_seed_ops_user("development", Some("true")));
        assert!(!should_seed_ops_user("staging", Some("true")));
        assert!(!should_seed_ops_user("production", Some("true")));
    }
}
