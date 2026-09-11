use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::repository::RepositoryError;

pub(crate) async fn ensure_creator_governance_access(
    transaction: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    event_key: &'static str,
) -> Result<(), RepositoryError> {
    let role_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO business_roles (
          organization_id, business_id, role_key, name, is_system
        ) VALUES ($1, $2, 'owner', 'Owner access', TRUE)
        ON CONFLICT (business_id, role_key)
        DO UPDATE SET updated_at = business_roles.updated_at
        RETURNING id
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .fetch_one(&mut **transaction)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO business_role_permissions (role_id, permission_key)
        SELECT $1, permission_key FROM business_permissions
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(role_id)
    .execute(&mut **transaction)
    .await?;

    let membership_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO business_memberships (
          organization_id, business_id, user_id, status,
          effective_from, metadata
        ) VALUES ($1, $2, $3, 'active', NOW(), $4)
        ON CONFLICT (business_id, user_id)
        DO UPDATE SET
          status = 'active',
          effective_until = NULL,
          updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(actor_id)
    .bind(json!({ "source": "business_provisioning" }))
    .fetch_one(&mut **transaction)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO business_member_roles (
          organization_id, business_id, membership_id, role_id,
          effective_from
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(membership_id)
    .bind(role_id)
    .execute(&mut **transaction)
    .await?;

    // This records a technical-access fact only. It intentionally does not
    // create a legal/business_relationships row for the creator.
    sqlx::query(
        r#"
        INSERT INTO business_audit_events (
          organization_id, business_id, actor_user_id,
          event_key, subject_type, subject_id, reason, metadata
        ) VALUES ($1, $2, $3, $4, 'business', $2,
                  'Creator technical governance access initialized',
                  jsonb_build_object('role_key', 'owner', 'legal_relationship_inferred', false))
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(actor_id)
    .bind(event_key)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}
