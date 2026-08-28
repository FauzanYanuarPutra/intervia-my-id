use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::domain::{
    organization_slug_candidate, OrganizationMemberView, OrganizationView,
    ValidatedEnsureOrganizationInput, ValidatedOrganizationInput,
};

#[derive(Debug)]
pub struct EnsureOrganizationOutcome {
    pub organization: OrganizationView,
    pub replayed: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum EnsureOrganizationRepositoryError {
    #[error("idempotency key was already used for a different request")]
    IdempotencyConflict,
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

pub struct OrganizationRepository<'a> {
    db: &'a PgPool,
}

impl<'a> OrganizationRepository<'a> {
    pub fn new(db: &'a PgPool) -> Self {
        Self { db }
    }

    pub async fn list_for_actor(
        &self,
        actor_user_id: Uuid,
    ) -> Result<Vec<OrganizationView>, sqlx::Error> {
        sqlx::query_as::<_, OrganizationView>(
            r#"
            SELECT
              o.id,
              o.name::text AS name,
              o.slug::text AS slug,
              o.owner_user_id,
              COALESCE(r.name, 'org_member') AS current_user_role,
              COALESCE(o.created_at, NOW()) AS created_at,
              COALESCE(o.updated_at, o.created_at, NOW()) AS updated_at
            FROM core.organizations o
            JOIN core.organization_users ou ON ou.org_id = o.id
            LEFT JOIN core.roles r ON r.id = ou.role_id
            WHERE ou.user_id = $1
              AND COALESCE(ou.status, 'active') = 'active'
              AND o.deleted_at IS NULL
            ORDER BY o.updated_at DESC NULLS LAST, o.id
            "#,
        )
        .bind(actor_user_id)
        .fetch_all(self.db)
        .await
    }

    pub async fn get_for_actor(
        &self,
        actor_user_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<OrganizationView>, sqlx::Error> {
        sqlx::query_as::<_, OrganizationView>(
            r#"
            SELECT
              o.id,
              o.name::text AS name,
              o.slug::text AS slug,
              o.owner_user_id,
              COALESCE(r.name, 'org_member') AS current_user_role,
              COALESCE(o.created_at, NOW()) AS created_at,
              COALESCE(o.updated_at, o.created_at, NOW()) AS updated_at
            FROM core.organizations o
            JOIN core.organization_users ou ON ou.org_id = o.id
            LEFT JOIN core.roles r ON r.id = ou.role_id
            WHERE o.id = $1
              AND ou.user_id = $2
              AND COALESCE(ou.status, 'active') = 'active'
              AND o.deleted_at IS NULL
            LIMIT 1
            "#,
        )
        .bind(organization_id)
        .bind(actor_user_id)
        .fetch_optional(self.db)
        .await
    }

    pub async fn list_members_for_actor(
        &self,
        actor_user_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<Vec<OrganizationMemberView>>, sqlx::Error> {
        if self
            .get_for_actor(actor_user_id, organization_id)
            .await?
            .is_none()
        {
            return Ok(None);
        }

        let members = sqlx::query_as::<_, OrganizationMemberView>(
            r#"
            SELECT
              ou.user_id,
              u.email::text AS email,
              up.username::text AS username,
              up.full_name,
              COALESCE(r.name, 'org_member') AS role,
              COALESCE(ou.status, 'active') AS status,
              COALESCE(ou.created_at, NOW()) AS joined_at
            FROM core.organization_users ou
            JOIN core.users u ON u.id = ou.user_id
            LEFT JOIN core.user_profiles up ON up.user_id = ou.user_id
            LEFT JOIN core.roles r ON r.id = ou.role_id
            WHERE ou.org_id = $1
              AND u.deleted_at IS NULL
            ORDER BY
              CASE WHEN r.name = 'org_admin' THEN 0 ELSE 1 END,
              ou.created_at,
              ou.user_id
            "#,
        )
        .bind(organization_id)
        .fetch_all(self.db)
        .await?;

        Ok(Some(members))
    }

    pub async fn create_for_actor(
        &self,
        actor_user_id: Uuid,
        input: &ValidatedOrganizationInput,
    ) -> Result<OrganizationView, sqlx::Error> {
        let mut transaction = self.db.begin().await?;
        let organization_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO core.organizations (name, slug, owner_user_id, updated_by)
            VALUES ($1, $2, NULL, $3)
            RETURNING id
            "#,
        )
        .bind(&input.name)
        .bind(&input.slug)
        .bind(actor_user_id)
        .fetch_one(&mut *transaction)
        .await?;

        let admin_role_id: Uuid =
            sqlx::query_scalar("SELECT id FROM core.roles WHERE name = 'org_admin' LIMIT 1")
                .fetch_one(&mut *transaction)
                .await?;

        sqlx::query(
            r#"
            INSERT INTO core.organization_users (org_id, user_id, role_id, status)
            VALUES ($1, $2, $3, 'active')
            "#,
        )
        .bind(organization_id)
        .bind(actor_user_id)
        .bind(admin_role_id)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            UPDATE core.organizations
            SET owner_user_id = $2, updated_by = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(organization_id)
        .bind(actor_user_id)
        .execute(&mut *transaction)
        .await?;

        record_creation_events(
            &mut transaction,
            organization_id,
            actor_user_id,
            &input.name,
            &input.slug,
        )
        .await?;

        transaction.commit().await?;

        self.get_for_actor(actor_user_id, organization_id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)
    }

    pub async fn ensure_for_actor(
        &self,
        actor_user_id: Uuid,
        idempotency_key: Uuid,
        input: &ValidatedEnsureOrganizationInput,
    ) -> Result<EnsureOrganizationOutcome, EnsureOrganizationRepositoryError> {
        let mut transaction = self.db.begin().await?;
        let idempotency_lock = format!("organization-provision:{actor_user_id}:{idempotency_key}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(idempotency_lock)
            .execute(&mut *transaction)
            .await?;

        let replay = sqlx::query_as::<_, (String, Uuid)>(
            r#"
            SELECT request_hash::text, organization_id
            FROM core.organization_provisioning_idempotency
            WHERE actor_user_id = $1 AND idempotency_key = $2
            FOR UPDATE
            "#,
        )
        .bind(actor_user_id)
        .bind(idempotency_key)
        .fetch_optional(&mut *transaction)
        .await?;

        if let Some((stored_hash, organization_id)) = replay {
            if stored_hash != input.request_hash {
                return Err(EnsureOrganizationRepositoryError::IdempotencyConflict);
            }
            transaction.commit().await?;
            let organization = self
                .get_for_actor(actor_user_id, organization_id)
                .await?
                .ok_or(sqlx::Error::RowNotFound)?;
            return Ok(EnsureOrganizationOutcome {
                organization,
                replayed: true,
            });
        }

        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(format!("organization-slug:{}", input.slug))
            .execute(&mut *transaction)
            .await?;
        let slug = select_available_slug(&mut transaction, &input.slug).await?;
        let organization_id =
            insert_organization(&mut transaction, actor_user_id, &input.name, &slug).await?;

        sqlx::query(
            r#"
            INSERT INTO core.organization_provisioning_idempotency (
              actor_user_id, idempotency_key, request_hash, organization_id
            ) VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(actor_user_id)
        .bind(idempotency_key)
        .bind(&input.request_hash)
        .bind(organization_id)
        .execute(&mut *transaction)
        .await?;

        record_creation_events(
            &mut transaction,
            organization_id,
            actor_user_id,
            &input.name,
            &slug,
        )
        .await?;
        transaction.commit().await?;

        let organization = self
            .get_for_actor(actor_user_id, organization_id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;
        Ok(EnsureOrganizationOutcome {
            organization,
            replayed: false,
        })
    }
}

async fn select_available_slug(
    transaction: &mut Transaction<'_, Postgres>,
    base_slug: &str,
) -> Result<String, sqlx::Error> {
    for collision_index in 0..=10_000 {
        let candidate = organization_slug_candidate(base_slug, collision_index);
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM core.organizations WHERE slug = $1)")
                .bind(&candidate)
                .fetch_one(&mut **transaction)
                .await?;
        if !exists {
            return Ok(candidate);
        }
    }

    Err(sqlx::Error::Protocol(
        "organization slug namespace exhausted".to_string(),
    ))
}

async fn insert_organization(
    transaction: &mut Transaction<'_, Postgres>,
    actor_user_id: Uuid,
    name: &str,
    slug: &str,
) -> Result<Uuid, sqlx::Error> {
    let organization_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO core.organizations (name, slug, owner_user_id, updated_by)
        VALUES ($1, $2, NULL, $3)
        RETURNING id
        "#,
    )
    .bind(name)
    .bind(slug)
    .bind(actor_user_id)
    .fetch_one(&mut **transaction)
    .await?;

    let admin_role_id: Uuid =
        sqlx::query_scalar("SELECT id FROM core.roles WHERE name = 'org_admin' LIMIT 1")
            .fetch_one(&mut **transaction)
            .await?;

    sqlx::query(
        r#"
        INSERT INTO core.organization_users (org_id, user_id, role_id, status)
        VALUES ($1, $2, $3, 'active')
        "#,
    )
    .bind(organization_id)
    .bind(actor_user_id)
    .bind(admin_role_id)
    .execute(&mut **transaction)
    .await?;

    sqlx::query(
        r#"
        UPDATE core.organizations
        SET owner_user_id = $2, updated_by = $2, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(organization_id)
    .bind(actor_user_id)
    .execute(&mut **transaction)
    .await?;

    Ok(organization_id)
}

async fn record_creation_events(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    actor_user_id: Uuid,
    name: &str,
    slug: &str,
) -> Result<(), sqlx::Error> {
    let payload = json!({
        "organization_id": organization_id,
        "owner_user_id": actor_user_id,
        "name": name,
        "slug": slug,
    });

    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
          aggregate_type, aggregate_id, event_type, routing_key, payload
        ) VALUES (
          'organization', $1, 'identity.organization.created',
          'identity.organization.created', $2
        )
        "#,
    )
    .bind(organization_id.to_string())
    .bind(&payload)
    .execute(&mut **transaction)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO events.audit_logs (
          entity, action, actor_id, user_id, metadata, created_at
        ) VALUES ('organization', 'organization.create', $1, $1, $2, NOW())
        "#,
    )
    .bind(actor_user_id)
    .bind(json!({ "organization_id": organization_id, "slug": slug }))
    .execute(&mut **transaction)
    .await?;

    Ok(())
}
