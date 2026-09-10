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
async fn sales_tables_are_available_after_migrations(pool: PgPool) {
    let sales_table: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.business_sales')::text")
            .fetch_one(&pool)
            .await
            .unwrap();
    let lines_table: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.business_sale_lines')::text")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(sales_table.as_deref(), Some("business_sales"));
    assert_eq!(lines_table.as_deref(), Some("business_sale_lines"));
}

#[sqlx::test(migrations = "./migrations")]
async fn inventory_movement_table_is_available_after_migrations(pool: PgPool) {
    let movement_table: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.business_inventory_movements')::text")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(
        movement_table.as_deref(),
        Some("business_inventory_movements"),
        "canonical inventory movement ledger must exist before sale consumption is enabled"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn finance_source_reference_is_unique_per_business(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;
    let source_id = Uuid::new_v4();

    for _ in 0..1 {
        sqlx::query(
            r#"
            INSERT INTO business_finance_entries (
              business_id, organization_id, entry_type, account_key, amount,
              occurred_on, note, source_type, source_id, created_by_user_id
            ) VALUES ($1,$2,'sale_income','cash',12000,CURRENT_DATE,'','business_sale',$3,$4)
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(source_id)
        .bind(actor_id)
        .execute(&pool)
        .await
        .unwrap();
    }

    let duplicate = sqlx::query(
        r#"
        INSERT INTO business_finance_entries (
          business_id, organization_id, entry_type, account_key, amount,
          occurred_on, note, source_type, source_id, created_by_user_id
        ) VALUES ($1,$2,'sale_income','cash',12000,CURRENT_DATE,'','business_sale',$3,$4)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(source_id)
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(
        duplicate.is_err(),
        "duplicate source effect must be rejected"
    );
}