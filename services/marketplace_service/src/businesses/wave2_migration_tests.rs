use sqlx::PgPool;
use uuid::Uuid;

#[test]
fn wave2_creation_idempotency_migration_has_business_scoped_unique_keys() {
    let migration =
        include_str!("../../migrations/20260918074000_wave2_creation_idempotency.up.sql");

    for table in [
        "business_recurring_obligations",
        "business_material_yield_observations",
    ] {
        assert!(migration.contains(table), "missing idempotency table {table}");
    }
    assert_eq!(
        migration
            .matches("ON business_recurring_obligations (business_id, idempotency_key)")
            .count(),
        1
    );
    assert_eq!(
        migration
            .matches("ON business_material_yield_observations (business_id, idempotency_key)")
            .count(),
        1
    );
    assert_eq!(
        migration
            .matches("ALTER COLUMN idempotency_key SET NOT NULL")
            .count(),
        2
    );
}


#[sqlx::test(migrations = "./migrations")]
async fn wave2_operating_tables_exist(pool: PgPool) {
    for table in [
        "business_finance_plans",
        "business_recurring_obligations",
        "business_purchases",
        "business_cash_shifts",
        "business_product_primary_materials",
        "business_material_yield_observations",
    ] {
        let found: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
            .bind(format!("public.{table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            found.as_deref(),
            Some(table),
            "missing Wave 2 table {table}"
        );
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn finance_plan_rejects_allocation_above_one_hundred_percent(pool: PgPool) {
    let result = sqlx::query(
        r#"
        INSERT INTO business_finance_plans (
          business_id, organization_id, owner_payroll_bps, staff_payroll_bps,
          working_capital_bps, operations_bps, reserve_bps
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), 3000, 3000, 3000, 2000, 1000
        )
        "#,
    )
    .execute(&pool)
    .await;
    assert!(
        result.is_err(),
        "allocation above 100% must fail at storage boundary"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn finance_entry_constraint_accepts_canonical_and_historical_vocabulary(pool: PgPool) {
    let business_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let actor_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Wave 2 Finance Vocabulary','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("7".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    for entry_type in [
        "inventory_expense",
        "ingredient_purchase",
        "owner_draw",
        "owner_drawing",
    ] {
        sqlx::query(
            r#"
            INSERT INTO business_finance_entries (
              business_id, organization_id, entry_type, account_key, amount,
              occurred_on, note, created_by_user_id
            ) VALUES ($1,$2,$3,'cash',1000,CURRENT_DATE,'constraint coverage',$4)
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(entry_type)
        .bind(actor_id)
        .execute(&pool)
        .await
        .unwrap_or_else(|error| panic!("entry type {entry_type} should remain valid: {error}"));
    }

    let invalid = sqlx::query(
        r#"
        INSERT INTO business_finance_entries (
          business_id, organization_id, entry_type, account_key, amount,
          occurred_on, note, created_by_user_id
        ) VALUES ($1,$2,'unknown_finance_type','cash',1000,CURRENT_DATE,'must fail',$3)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .execute(&pool)
    .await;
    assert!(
        invalid.is_err(),
        "unknown finance vocabulary must still fail closed"
    );
}
