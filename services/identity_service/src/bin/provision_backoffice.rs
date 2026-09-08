use std::{env, process};

use anyhow::{anyhow, bail, Context, Result};
use identity_service::backoffice::{
    is_backoffice_eligible, normalize_backoffice_target, parse_backoffice_roles, BackofficeTarget,
};
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, Row};
use uuid::Uuid;

fn usage() -> &'static str {
    "usage: provision_backoffice --user <email|@username> --roles <admin,content_admin,sales,support>"
}

fn parse_args() -> Result<(String, String)> {
    let mut args = env::args().skip(1);
    let mut user = None;
    let mut roles = None;

    while let Some(argument) = args.next() {
        match argument.as_str() {
            "--user" => user = args.next(),
            "--roles" => roles = args.next(),
            "--help" | "-h" => bail!(usage()),
            other => bail!("unknown argument: {other}\n{}", usage()),
        }
    }

    match (user, roles) {
        (Some(user), Some(roles)) => Ok((user, roles)),
        _ => bail!(usage()),
    }
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("backoffice provisioning failed: {error:#}");
        process::exit(1);
    }
}

async fn run() -> Result<()> {
    let (raw_target, raw_roles) = parse_args()?;
    let target = normalize_backoffice_target(&raw_target)?;
    let requested_roles = parse_backoffice_roles(&raw_roles)?;
    let database_url = env::var("DATABASE_URL").context("DATABASE_URL is required")?;

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;
    let mut transaction = pool.begin().await?;

    let lookup = match &target {
        BackofficeTarget::Email(email) => {
            sqlx::query(
                r#"
            SELECT u.id, u.email::text AS email, up.username::text AS username,
                   u.is_active, (u.status::text = 'banned') AS is_banned,
                   u.email_verified, u.phone_verified
            FROM core.users u
            LEFT JOIN core.user_profiles up ON up.user_id = u.id
            WHERE u.deleted_at IS NULL AND lower(u.email::text) = lower($1)
            LIMIT 2
            "#,
            )
            .bind(email)
            .fetch_all(&mut *transaction)
            .await?
        }
        BackofficeTarget::Username(username) => {
            sqlx::query(
                r#"
            SELECT u.id, u.email::text AS email, up.username::text AS username,
                   u.is_active, (u.status::text = 'banned') AS is_banned,
                   u.email_verified, u.phone_verified
            FROM core.users u
            JOIN core.user_profiles up ON up.user_id = u.id
            WHERE u.deleted_at IS NULL AND lower(up.username::text) = lower($1)
            LIMIT 2
            "#,
            )
            .bind(username)
            .fetch_all(&mut *transaction)
            .await?
        }
    };

    if lookup.is_empty() {
        bail!("target Lajukan account was not found");
    }
    if lookup.len() > 1 {
        bail!("target is ambiguous; provisioning aborted");
    }

    let row = &lookup[0];
    let user_id: Uuid = row.try_get("id")?;
    let email: String = row.try_get("email")?;
    let username: Option<String> = row.try_get("username")?;
    let is_active: bool = row.try_get("is_active")?;
    let is_banned: bool = row.try_get("is_banned")?;
    let email_verified: bool = row.try_get("email_verified")?;
    let phone_verified: bool = row.try_get("phone_verified")?;

    if !is_backoffice_eligible(is_active, is_banned, email_verified, phone_verified) {
        bail!("target must be active, not banned, and have a verified email or phone");
    }

    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(format!("backoffice-provision:{user_id}"))
        .execute(&mut *transaction)
        .await?;

    let mut granted = Vec::with_capacity(requested_roles.len());
    for requested_role in requested_roles {
        let role_name = requested_role.as_str();
        let role_id: Uuid = sqlx::query_scalar(
            r#"
            SELECT id FROM core.roles
            WHERE lower(name::text) = lower($1) AND role_type = 'global'
            LIMIT 1
            "#,
        )
        .bind(role_name)
        .fetch_optional(&mut *transaction)
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
        .execute(&mut *transaction)
        .await?;
        granted.push(role_name);
    }

    sqlx::query(
        r#"
        INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
        VALUES ('user', 'backoffice.roles.provisioned', NULL, $1, $2, NOW())
        "#,
    )
    .bind(user_id)
    .bind(json!({
        "source": "provision_backoffice_cli",
        "roles": granted,
        "email": email,
        "username": username,
    }))
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;

    println!(
        "provisioned backoffice access for {} ({}) with roles: {}",
        username.as_deref().unwrap_or("no-username"),
        email,
        granted.join(",")
    );
    println!("existing access tokens may need to be refreshed before new roles appear");
    Ok(())
}
