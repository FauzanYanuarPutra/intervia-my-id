use sqlx::PgPool;
use uuid::Uuid;

// SQLx embeds the migration directory in this test target at compile time.
#[sqlx::test(migrations = "./migrations")]
async fn profile_and_capability_tables_exist_with_vertical_templates(pool: PgPool) {
    for table in [
        "business_templates",
        "business_capability_definitions",
        "business_template_capabilities",
        "business_profiles",
        "business_capabilities",
    ] {
        let found: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
            .bind(format!("public.{table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            found.as_deref(),
            Some(table),
            "missing profile table {table}"
        );
    }

    let templates: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT template_key
        FROM business_templates
        WHERE status = 'active'
        ORDER BY template_key
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        templates,
        vec![
            "ac_field_service",
            "general",
            "juice_fnb",
            "laundry",
            "mart_retail",
        ]
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn legacy_business_insert_receives_a_general_profile_and_capabilities(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Legacy Shop','general','active',$3,$4,$5)
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

    let profile: (String, i32, String, String, String) = sqlx::query_as(
        r#"
        SELECT template_key, template_version, currency, timezone, costing_policy
        FROM business_profiles
        WHERE business_id = $1 AND organization_id = $2
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        profile,
        (
            "general".to_owned(),
            1,
            "IDR".to_owned(),
            "Asia/Jakarta".to_owned(),
            "weighted_average".to_owned(),
        )
    );

    let capabilities: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT capability_key
        FROM business_capabilities
        WHERE business_id = $1 AND organization_id = $2 AND enabled
        ORDER BY capability_key
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        capabilities,
        vec![
            "business_core",
            "catalog",
            "customers",
            "finance_basic",
            "payments",
            "reporting",
            "sales",
            "supporting_documents",
        ]
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn profile_scope_cannot_cross_business_or_organization(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let first_organization_id = Uuid::new_v4();
    let second_organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Scoped Shop','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(first_organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("0".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    let update =
        sqlx::query("UPDATE business_profiles SET organization_id = $1 WHERE business_id = $2")
            .bind(second_organization_id)
            .bind(business_id)
            .execute(&pool)
            .await;
    assert!(
        update.is_err(),
        "profile scope must match the owning business"
    );
}
