use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = "./migrations")]
async fn governance_tables_exist_after_migrations(pool: PgPool) {
    for table in [
        "business_memberships",
        "business_roles",
        "business_permissions",
        "business_role_permissions",
        "business_member_roles",
        "business_relationships",
        "business_jurisdictions",
        "business_legal_profiles",
        "business_audit_events",
    ] {
        let found: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
            .bind(format!("public.{table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(found.as_deref(), Some(table), "missing governance table {table}");
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn business_locations_expose_branch_semantics(pool: PgPool) {
    let columns: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_locations'
          AND column_name IN ('branch_code', 'branch_kind', 'opened_on', 'closed_on')
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(
        columns,
        vec!["branch_code", "branch_kind", "closed_on", "opened_on"]
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn audit_events_are_append_only(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Audit Test','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("0".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    let audit_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO business_audit_events (
          organization_id, business_id, actor_user_id,
          event_key, subject_type, subject_id, reason, metadata
        ) VALUES ($1,$2,$3,'business.tested','business',$2,'contract test','{}'::jsonb)
        RETURNING id
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(actor_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let update = sqlx::query("UPDATE business_audit_events SET reason = 'tampered' WHERE id = $1")
        .bind(audit_id)
        .execute(&pool)
        .await;
    let delete = sqlx::query("DELETE FROM business_audit_events WHERE id = $1")
        .bind(audit_id)
        .execute(&pool)
        .await;

    assert!(update.is_err(), "audit events must reject UPDATE");
    assert!(delete.is_err(), "audit events must reject DELETE");
}
