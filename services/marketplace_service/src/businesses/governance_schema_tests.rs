use sqlx::PgPool;
use uuid::Uuid;

async fn seed_business(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1, $2, 'Lajukan Juice', 'food_beverage', 'active', $3, $4, $5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("0".repeat(64))
    .execute(pool)
    .await
    .unwrap();

    (actor_id, organization_id, business_id)
}

#[sqlx::test(migrations = "./migrations")]
async fn governance_tables_are_available_after_migrations(pool: PgPool) {
    for table in [
        "business_branches",
        "business_relationships",
        "business_access_grants",
        "business_role_permissions",
        "business_jurisdictions",
        "business_evidence",
        "business_audit_events",
    ] {
        let regclass: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
            .bind(format!("public.{table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(regclass.as_deref(), Some(table), "missing {table}");
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn relationships_fail_closed_on_cross_tenant_business(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;

    let result = sqlx::query(
        r#"
        INSERT INTO business_relationships (
          business_id, organization_id, subject_kind, subject_id,
          relationship_type, effective_from, created_by_user_id
        ) VALUES ($1, $2, 'user', $3, 'employee', NOW(), $3)
        "#,
    )
    .bind(business_id)
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(
        result.is_err(),
        "a relationship must not cross the business organization boundary"
    );

    let valid = sqlx::query(
        r#"
        INSERT INTO business_relationships (
          business_id, organization_id, subject_kind, subject_id,
          relationship_type, effective_from, created_by_user_id
        ) VALUES ($1, $2, 'user', $3, 'employee', NOW(), $3)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(valid.is_ok());
}

#[sqlx::test(migrations = "./migrations")]
async fn access_grants_require_known_permission_role_and_tenant(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;

    let unknown_role = sqlx::query(
        r#"
        INSERT INTO business_access_grants (
          business_id, organization_id, user_id, role_key,
          effective_from, granted_by_user_id
        ) VALUES ($1, $2, $3, 'super_unbounded_admin', NOW(), $3)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .execute(&pool)
    .await;
    assert!(unknown_role.is_err(), "unknown roles must fail closed");

    let cross_tenant = sqlx::query(
        r#"
        INSERT INTO business_access_grants (
          business_id, organization_id, user_id, role_key,
          effective_from, granted_by_user_id
        ) VALUES ($1, $2, $3, 'owner', NOW(), $3)
        "#,
    )
    .bind(business_id)
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .execute(&pool)
    .await;
    assert!(cross_tenant.is_err(), "grants must be tenant-scoped");
}

#[sqlx::test(migrations = "./migrations")]
async fn audit_and_evidence_records_are_append_only(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;

    let evidence_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO business_evidence (
          business_id, organization_id, evidence_type, content_sha256,
          storage_ref, captured_at, created_by_user_id
        ) VALUES ($1, $2, 'document', $3, 'evidence://test', NOW(), $4)
        RETURNING id
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind("a".repeat(64))
    .bind(actor_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let audit_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO business_audit_events (
          business_id, organization_id, actor_user_id, action,
          entity_type, entity_id, effective_at, evidence_id, payload
        ) VALUES ($1, $2, $3, 'business.profile_changed', 'business', $1, NOW(), $4, '{}'::jsonb)
        RETURNING id
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(evidence_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let evidence_update = sqlx::query("UPDATE business_evidence SET storage_ref = 'changed' WHERE id = $1")
        .bind(evidence_id)
        .execute(&pool)
        .await;
    assert!(evidence_update.is_err(), "evidence must be immutable");

    let audit_delete = sqlx::query("DELETE FROM business_audit_events WHERE id = $1")
        .bind(audit_id)
        .execute(&pool)
        .await;
    assert!(audit_delete.is_err(), "audit events must be append-only");
}

#[sqlx::test(migrations = "./migrations")]
async fn effective_periods_reject_inverted_rights_windows(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;

    let result = sqlx::query(
        r#"
        INSERT INTO business_relationships (
          business_id, organization_id, subject_kind, subject_id,
          relationship_type, effective_from, effective_until, created_by_user_id
        ) VALUES ($1, $2, 'user', $3, 'employee', NOW(), NOW() - INTERVAL '1 day', $3)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(result.is_err(), "effective_until must be later than effective_from");
}
