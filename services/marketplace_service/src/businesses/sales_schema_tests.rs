use sqlx::PgPool;
use uuid::Uuid;

async fn seed_business(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let primary_location_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Lajukan Juice',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("sales-schema-test-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

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

    sqlx::query(
        "INSERT INTO business_store_links (business_id, store_id, link_type) VALUES ($1,$2,'primary')",
    )
    .bind(business_id)
    .bind(store_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_locations (
          id, store_id, organization_id, business_id, name,
          branch_code, branch_kind, is_primary, public_visibility
        ) VALUES ($1,$2,$3,$4,'Kios Utama','MAIN','kiosk',TRUE,TRUE)
        "#,
    )
    .bind(primary_location_id)
    .bind(store_id)
    .bind(organization_id)
    .bind(business_id)
    .execute(pool)
    .await
    .unwrap();

    (actor_id, organization_id, business_id)
}

async fn seed_ingredient(pool: &PgPool, business_id: Uuid, organization_id: Uuid) -> Uuid {
    let ingredient_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO business_ingredients (
          id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, status
        ) VALUES ($1,$2,$3,'Gula','ingredient','kg','g',1000,18000,1,100,0,1000,0,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();
    ingredient_id
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
async fn sale_consumption_movement_must_decrease_stock(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;
    let ingredient_id = seed_ingredient(&pool, business_id, organization_id).await;

    let invalid = sqlx::query(
        r#"
        INSERT INTO business_inventory_movements (
          business_id, organization_id, ingredient_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          source_type, source_id, created_by_user_id
        ) VALUES ($1,$2,$3,'sale_consumption',10,1000,1010,'business_sale',$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(ingredient_id)
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(
        invalid.is_err(),
        "sale consumption must use a negative delta"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn sale_consumption_movement_requires_sale_source(pool: PgPool) {
    let (actor_id, organization_id, business_id) = seed_business(&pool).await;
    let ingredient_id = seed_ingredient(&pool, business_id, organization_id).await;

    let missing_source = sqlx::query(
        r#"
        INSERT INTO business_inventory_movements (
          business_id, organization_id, ingredient_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          source_type, source_id, created_by_user_id
        ) VALUES ($1,$2,$3,'sale_consumption',-10,1000,990,NULL,NULL,$4)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(ingredient_id)
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(
        missing_source.is_err(),
        "sale consumption must be linked to a canonical business sale"
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
