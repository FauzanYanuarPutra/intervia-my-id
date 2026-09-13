use sqlx::PgPool;

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
        assert_eq!(found.as_deref(), Some(table), "missing Wave 2 table {table}");
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
    assert!(result.is_err(), "allocation above 100% must fail at storage boundary");
}
