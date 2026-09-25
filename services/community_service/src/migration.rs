use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::{migrate::Migrator, FromRow, PgPool, Row};

pub(crate) fn validate_community_migration_versions(
    migrator: &sqlx::migrate::Migrator,
) -> anyhow::Result<()> {
    // Validate the set SQLx will execute forward. Legacy community history
    // contains valid up-only migrations, while reversible migrations may also
    // expose down entries depending on the migration source.
    let mut versions = HashMap::<i64, Vec<String>>::new();

    for migration in migrator.iter() {
        if migration.migration_type.is_down_migration() {
            continue;
        }

        versions
            .entry(migration.version)
            .or_default()
            .push(format!("{} ({:?})", migration.description, migration.migration_type));
    }

    let mut invalid = versions
        .into_iter()
        .filter_map(|(version, migrations)| {
            if migrations.len() <= 1 {
                return None;
            }

            Some(format!(
                "version {version}: [{}]",
                migrations.join(", "),
            ))
        })
        .collect::<Vec<_>>();

    invalid.sort();

    if invalid.is_empty() {
        Ok(())
    } else {
        anyhow::bail!(
            "duplicate SQLx migration version(s) embedded in community_service: {}. Each executable migration version must be unique.",
            invalid.join("; "),
        );
    }
}


#[derive(Debug, FromRow)]
pub(crate) struct CommunityMigrationRecord {
    version: i64,
    description: String,
    installed_on: DateTime<Utc>,
    success: bool,
    checksum: Vec<u8>,
    execution_time: i64,
}

pub(crate) async fn normalize_community_migration_tracking(pool: &PgPool) -> anyhow::Result<()> {
    // SQLx's default tracking table is public._sqlx_migrations. Community
    // migrations change search_path, so pin the bookkeeping table explicitly
    // to public and reconcile any legacy copies created in service schemas.
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS public._sqlx_migrations (
            version BIGINT PRIMARY KEY,
            description TEXT NOT NULL,
            installed_on TIMESTAMPTZ NOT NULL DEFAULT now(),
            success BOOLEAN NOT NULL,
            checksum BYTEA NOT NULL,
            execution_time BIGINT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Legacy runs could have created _sqlx_migrations under any non-system
    // schema after a migration changed search_path. Reconcile every such table
    // into the canonical public tracker so no hidden tracker can cause a
    // migration to execute twice.
    let existing_schemas = sqlx::query(
        r#"
        SELECT n.nspname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND c.relname = '_sqlx_migrations'
          AND n.nspname <> 'public'
          AND n.nspname <> 'information_schema'
          AND n.nspname NOT LIKE 'pg_%'
        ORDER BY n.nspname
        "#,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|row| row.get::<String, _>("nspname"))
    .collect::<Vec<_>>();

    for schema in existing_schemas {
        let escaped_schema = schema.replace('"', "\"\"");
        let table = format!(r#""{}"."_sqlx_migrations""#, escaped_schema);
        let query = sqlx::AssertSqlSafe(format!(
            "SELECT version, description, installed_on, success, checksum, execution_time FROM {table} ORDER BY version"
        ));
        let rows = sqlx::query_as::<_, CommunityMigrationRecord>(query)
            .fetch_all(pool)
            .await?;

        for record in rows {
            if !record.success {
                anyhow::bail!(
                    "community migration tracking is dirty in {} for version {}",
                    table,
                    record.version
                );
            }

            let existing = sqlx::query(
                "SELECT description, checksum FROM public._sqlx_migrations WHERE version = $1",
            )
            .bind(record.version)
            .fetch_optional(pool)
            .await?;

            if let Some(existing) = existing {
                let existing_checksum: Vec<u8> = existing.get("checksum");
                let existing_description: String = existing.get("description");

                if existing_checksum != record.checksum {
                    anyhow::bail!(
                        "conflicting community migration metadata for version {}: public description={:?}, {} description={:?}",
                        record.version,
                        existing_description,
                        table,
                        record.description
                    );
                }

                continue;
            }

            sqlx::query(
                r#"
                INSERT INTO public._sqlx_migrations
                    (version, description, installed_on, success, checksum, execution_time)
                VALUES ($1, $2, $3, TRUE, $4, $5)
                "#,
            )
            .bind(record.version)
            .bind(&record.description)
            .bind(record.installed_on)
            .bind(&record.checksum)
            .bind(record.execution_time)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}
