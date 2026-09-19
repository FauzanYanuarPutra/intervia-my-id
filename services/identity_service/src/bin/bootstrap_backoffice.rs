use anyhow::{anyhow, bail, Context, Result};
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use dotenvy::dotenv;
use rand::thread_rng;
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, Row};
use std::{env, process};
use uuid::Uuid;

#[derive(Clone)]
struct AccountSpec {
    slot: &'static str,
    email: String,
    username: String,
    password: String,
    roles: &'static [&'static str],
}

fn env_bool(name: &str, default: bool) -> Result<bool> {
    match env::var(name) {
        Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Ok(true),
            "0" | "false" | "no" | "off" => Ok(false),
            _ => bail!("{name} must be a boolean"),
        },
        Err(_) => Ok(default),
    }
}

fn required_env(name: &str) -> Result<String> {
    let value = env::var(name)
        .with_context(|| format!("{name} is required when backoffice bootstrap is enabled"))?;
    let value = value.trim().to_string();
    if value.is_empty() {
        bail!("{name} must not be empty");
    }
    Ok(value)
}

fn normalize_email(raw: String) -> Result<String> {
    let value = raw.trim().to_ascii_lowercase();
    let mut parts = value.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    if parts.next().is_some()
        || local.is_empty()
        || domain.len() < 3
        || !domain.contains('.')
        || value.chars().any(char::is_whitespace)
    {
        bail!("invalid backoffice email");
    }
    Ok(value)
}

fn normalize_username(raw: String) -> Result<String> {
    let value = raw.trim().trim_start_matches('@').to_ascii_lowercase();
    if !(3..=30).contains(&value.len())
        || value.starts_with('.')
        || value.ends_with('.')
        || value.contains("..")
        || !value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
    {
        bail!("invalid backoffice username");
    }
    Ok(value)
}

fn validate_password(password: &str) -> Result<()> {
    if password.len() < 15 {
        bail!("backoffice bootstrap passwords must be at least 15 characters");
    }
    if password.chars().any(char::is_whitespace) {
        bail!("backoffice bootstrap passwords must not contain spaces");
    }
    if !password.chars().any(|c| c.is_ascii_uppercase()) {
        bail!("backoffice bootstrap passwords need an uppercase letter");
    }
    if !password.chars().any(|c| c.is_ascii_lowercase()) {
        bail!("backoffice bootstrap passwords need a lowercase letter");
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        bail!("backoffice bootstrap passwords need a number");
    }
    if !password.chars().any(|c| !c.is_ascii_alphanumeric()) {
        bail!("backoffice bootstrap passwords need a symbol");
    }
    Ok(())
}

fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut thread_rng());
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| anyhow!("failed to hash bootstrap password: {error}"))
}

async fn ensure_account(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    spec: &AccountSpec,
    rotate_password: bool,
) -> Result<Uuid> {
    let rows = sqlx::query(
        r#"
        SELECT u.id,
               u.email::text AS email,
               up.username::text AS username
        FROM core.users u
        LEFT JOIN core.user_profiles up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND (
              lower(u.email::text) = lower($1)
              OR lower(COALESCE(up.username::text, '')) = lower($2)
          )
        LIMIT 2
        "#,
    )
    .bind(&spec.email)
    .bind(&spec.username)
    .fetch_all(&mut **tx)
    .await?;

    if rows.len() > 1 {
        bail!("{} bootstrap identifiers point to multiple users", spec.slot);
    }

    let user_id = if let Some(row) = rows.first() {
        let user_id: Uuid = row.try_get("id")?;
        let existing_email: String = row.try_get("email")?;
        let existing_username: Option<String> = row.try_get("username")?;

        if !existing_email.eq_ignore_ascii_case(&spec.email) {
            bail!("{} bootstrap username already belongs to another email", spec.slot);
        }
        if let Some(existing_username) = existing_username {
            if !existing_username.eq_ignore_ascii_case(&spec.username) {
                bail!("{} bootstrap email already belongs to another username", spec.slot);
            }
        } else {
            let conflict: Option<Uuid> = sqlx::query_scalar(
                "SELECT user_id FROM core.user_profiles WHERE lower(username::text) = lower($1) LIMIT 1",
            )
            .bind(&spec.username)
            .fetch_optional(&mut **tx)
            .await?;
            if conflict.is_some_and(|id| id != user_id) {
                bail!("{} bootstrap username is already taken", spec.slot);
            }
            sqlx::query(
                "UPDATE core.user_profiles SET username = $1, updated_at = NOW() WHERE user_id = $2",
            )
            .bind(&spec.username)
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        }

        if rotate_password {
            let password_hash = hash_password(&spec.password)?;
            sqlx::query(
                r#"
                UPDATE core.users
                SET password_hash = $1,
                    password_changed_at = NOW(),
                    failed_login_attempts = 0,
                    lockout_expires_at = NULL,
                    email_verified = TRUE,
                    status = 'active',
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE id = $2
                "#,
            )
            .bind(password_hash)
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                UPDATE core.users
                SET email_verified = TRUE,
                    status = 'active',
                    is_active = TRUE,
                    deleted_at = NULL,
                    failed_login_attempts = 0,
                    lockout_expires_at = NULL,
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        }
        user_id
    } else {
        let username_conflict: Option<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM core.user_profiles WHERE lower(username::text) = lower($1) LIMIT 1",
        )
        .bind(&spec.username)
        .fetch_optional(&mut **tx)
        .await?;
        if username_conflict.is_some() {
            bail!("{} bootstrap username is already taken", spec.slot);
        }

        let user_id = Uuid::new_v4();
        let password_hash = hash_password(&spec.password)?;

        sqlx::query(
            r#"
            INSERT INTO core.users (
                id, email, email_verified, password_hash, is_active,
                status, failed_login_attempts, lockout_expires_at,
                created_at, updated_at
            )
            VALUES ($1, $2, TRUE, $3, TRUE, 'active', 0, NULL, NOW(), NOW())
            "#,
        )
        .bind(user_id)
        .bind(&spec.email)
        .bind(password_hash)
        .execute(&mut **tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO core.user_profiles (user_id, full_name, username, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            "#,
        )
        .bind(user_id)
        .bind(if spec.slot == "admin" {
            "Lajukan Backoffice Admin"
        } else {
            "Lajukan CRM Agent"
        })
        .bind(&spec.username)
        .execute(&mut **tx)
        .await?;

        user_id
    };

    for role_name in spec.roles {
        let role_id: Uuid = sqlx::query_scalar(
            r#"
            SELECT id
            FROM roles
            WHERE lower(name::text) = lower($1)
              AND role_type = 'global'
            LIMIT 1
            "#,
        )
        .bind(role_name)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| anyhow!("required global role is missing: {role_name}"))?;

        sqlx::query(
            r#"
            INSERT INTO core.user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(role_id)
        .execute(&mut **tx)
        .await?;
    }

    sqlx::query("UPDATE core.sessions SET revoked = TRUE WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
        VALUES ('user', 'backoffice.bootstrap.provisioned', NULL, $1, $2, NOW())
        "#,
    )
    .bind(user_id)
    .bind(json!({
        "slot": spec.slot,
        "email": spec.email,
        "username": spec.username,
        "roles": spec.roles,
        "password_rotated": rotate_password
    }))
    .execute(&mut **tx)
    .await?;

    Ok(user_id)
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    if let Err(error) = run().await {
        eprintln!("backoffice bootstrap failed: {error:#}");
        process::exit(1);
    }
}

async fn run() -> Result<()> {
    if !env_bool("BACKOFFICE_BOOTSTRAP_ENABLED", false)? {
        println!("backoffice bootstrap disabled");
        return Ok(());
    }

    let database_url = env::var("IDENTITY_DATABASE_URL")
        .or_else(|_| env::var("DATABASE_URL"))
        .context("IDENTITY_DATABASE_URL (or DATABASE_URL) is required")?;

    let admin_password = required_env("BACKOFFICE_ADMIN_PASSWORD")?;
    let agent_password = required_env("BACKOFFICE_AGENT_PASSWORD")?;
    validate_password(&admin_password)?;
    validate_password(&agent_password)?;

    let admin = AccountSpec {
        slot: "admin",
        email: normalize_email(required_env("BACKOFFICE_ADMIN_EMAIL")?)?,
        username: normalize_username(required_env("BACKOFFICE_ADMIN_USERNAME")?)?,
        password: admin_password,
        roles: &["admin", "content_admin", "sales", "support"],
    };
    let agent = AccountSpec {
        slot: "agent",
        email: normalize_email(required_env("BACKOFFICE_AGENT_EMAIL")?)?,
        username: normalize_username(required_env("BACKOFFICE_AGENT_USERNAME")?)?,
        password: agent_password,
        roles: &["sales", "support"],
    };

    let rotate_passwords = env_bool("BACKOFFICE_BOOTSTRAP_ROTATE_PASSWORDS", false)?;

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .min_connections(1)
        .connect(&database_url)
        .await?;

    let mut tx = pool.begin().await?;

    for spec in [&admin, &agent] {
        let slot = sqlx::query(
            "SELECT role_names, enabled FROM core.backoffice_bootstrap_slots WHERE slot = $1",
        )
        .bind(spec.slot)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow!("bootstrap slot '{}' is missing; run identity migrations first", spec.slot))?;

        let enabled_slot: bool = slot.try_get("enabled")?;
        if !enabled_slot {
            bail!("bootstrap slot '{}' is disabled", spec.slot);
        }

        let configured_roles: Vec<String> = slot.try_get("role_names")?;
        let required_roles: Vec<String> = spec.roles.iter().map(|role| role.to_string()).collect();
        if configured_roles != required_roles {
            bail!(
                "bootstrap slot '{}' role contract drifted: database={configured_roles:?}, binary={required_roles:?}",
                spec.slot
            );
        }

        ensure_account(&mut tx, spec, rotate_passwords).await?;
    }

    tx.commit().await?;

    println!("backoffice bootstrap completed");
    println!("admin: {} (@{})", admin.email, admin.username);
    println!("agent: {} (@{})", agent.email, agent.username);
    Ok(())
}
