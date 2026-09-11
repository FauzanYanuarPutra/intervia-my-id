use super::sales::{CreateSaleLineRequest, CreateSaleRequest, SaleRepository, SaleRepositoryError};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededSaleContext {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    primary_location_id: Uuid,
    product_id: Uuid,
    ingredient_id: Uuid,
}

async fn seed_costed_product(pool: &PgPool) -> SeededSaleContext {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let primary_location_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();
    let recipe_id = Uuid::new_v4();

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
    .bind(format!("sale-test-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Lajukan Juice','food_beverage','active',$3,$4,$5)
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

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Jus Alpukat','Minuman','Rp12.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_ingredients (
          id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, status
        ) VALUES ($1,$2,$3,'Alpukat','ingredient','kg','g',1000,34000,1,80,5,5000,0,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipes (
          id, business_id, organization_id, product_id, name, servings, status, version
        ) VALUES ($1,$2,$3,$4,'Jus Alpukat',1,'active',3)
        "#,
    )
    .bind(recipe_id)
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_items (
          id, recipe_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,$3,150,0)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(recipe_id)
    .bind(ingredient_id)
    .execute(pool)
    .await
    .unwrap();

    SeededSaleContext {
        actor_id,
        organization_id,
        business_id,
        primary_location_id,
        product_id,
        ingredient_id,
    }
}

fn sale_request(product_id: Uuid) -> CreateSaleRequest {
    CreateSaleRequest {
        occurred_on: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
        channel_key: Some("offline".into()),
        account_key: "cash".into(),
        lines: vec![CreateSaleLineRequest {
            product_id,
            quantity: Decimal::from(2),
            unit_price_amount: 12_000,
            discount_amount: 0,
        }],
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn posting_sale_persists_snapshot_and_exactly_one_finance_effect(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    let repository = SaleRepository::new(pool.clone());
    let idempotency_key = Uuid::new_v4();

    let first = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            idempotency_key,
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert_eq!(first.sale.lines.len(), 1);
    assert_eq!(first.sale.sale.final_amount, 24_000);
    assert!(first.sale.sale.cost_complete);
    assert!(first.sale.sale.cogs_amount.unwrap() > 0);
    assert!(first.sale.lines[0].line_cogs_amount.unwrap() > 0);
    assert!(first.sale.lines[0]
        .cost_snapshot
        .get("production_hpp_per_unit")
        .is_some());

    let replay = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            idempotency_key,
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.sale.sale.id, first.sale.sale.id);

    let sale_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_sales WHERE business_id=$1 AND idempotency_key=$2",
    )
    .bind(seeded.business_id)
    .bind(idempotency_key)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(sale_count, 1);

    let finance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_finance_entries WHERE business_id=$1 AND source_type='business_sale' AND source_id=$2",
    )
    .bind(seeded.business_id)
    .bind(first.sale.sale.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(finance_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn historical_cogs_snapshot_does_not_drift_after_purchase_price_changes(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    let repository = SaleRepository::new(pool.clone());
    let created = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();

    let before_unit = created.sale.lines[0].unit_cogs_amount;
    let before_line = created.sale.lines[0].line_cogs_amount;
    let before_snapshot = created.sale.lines[0].cost_snapshot.clone();

    sqlx::query(
        "UPDATE business_ingredients SET purchase_price_amount=68000, updated_at=NOW() WHERE id=$1",
    )
    .bind(seeded.ingredient_id)
    .execute(&pool)
    .await
    .unwrap();

    let listed = repository
        .list(seeded.business_id, seeded.organization_id, 10)
        .await
        .unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].lines[0].unit_cogs_amount, before_unit);
    assert_eq!(listed[0].lines[0].line_cogs_amount, before_line);
    assert_eq!(listed[0].lines[0].cost_snapshot, before_snapshot);
}

#[sqlx::test(migrations = "./migrations")]
async fn sale_requires_complete_costing(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    sqlx::query("DELETE FROM business_recipe_items")
        .execute(&pool)
        .await
        .unwrap();

    let error = SaleRepository::new(pool)
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            sale_request(seeded.product_id),
        )
        .await
        .unwrap_err();
    assert_eq!(error, SaleRepositoryError::IncompleteCosting);
}

#[sqlx::test(migrations = "./migrations")]
async fn posting_sale_consumes_recipe_stock_and_writes_one_movement(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    let created = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(4_700));

    let primary_balance: Decimal = sqlx::query_scalar(
        "SELECT quantity FROM business_ingredient_balances WHERE location_id=$1 AND ingredient_id=$2",
    )
    .bind(seeded.primary_location_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(primary_balance, Decimal::from(4_700));

    let movement: (Decimal, Decimal, Decimal, Uuid, String, String, Uuid) = sqlx::query_as(
        r#"
        SELECT quantity_delta, quantity_before, quantity_after, source_id,
               source_type, movement_type, location_id
        FROM business_inventory_movements
        WHERE business_id=$1 AND ingredient_id=$2
        "#,
    )
    .bind(seeded.business_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(movement.0, Decimal::from(-300));
    assert_eq!(movement.1, Decimal::from(5_000));
    assert_eq!(movement.2, Decimal::from(4_700));
    assert_eq!(movement.3, created.sale.sale.id);
    assert_eq!(movement.4, "business_sale");
    assert_eq!(movement.5, "sale_consumption");
    assert_eq!(movement.6, seeded.primary_location_id);
}

#[sqlx::test(migrations = "./migrations")]
async fn replayed_sale_does_not_consume_inventory_twice(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    let repository = SaleRepository::new(pool.clone());
    let idempotency_key = Uuid::new_v4();

    let first = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            idempotency_key,
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();
    let replay = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            idempotency_key,
            sale_request(seeded.product_id),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(replay.sale.sale.id, first.sale.sale.id);

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(4_700));

    let movement_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_inventory_movements WHERE business_id=$1 AND source_type='business_sale' AND source_id=$2",
    )
    .bind(seeded.business_id)
    .bind(first.sale.sale.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(movement_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn insufficient_stock_rejects_sale_without_business_effects(pool: PgPool) {
    let seeded = seed_costed_product(&pool).await;
    sqlx::query("UPDATE business_ingredients SET stock_quantity=200 WHERE id=$1")
        .bind(seeded.ingredient_id)
        .execute(&pool)
        .await
        .unwrap();

    let error = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            sale_request(seeded.product_id),
        )
        .await
        .unwrap_err();
    assert_eq!(error, SaleRepositoryError::InsufficientStock);

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(200));

    let sale_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_sales WHERE business_id=$1")
            .bind(seeded.business_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let finance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_finance_entries WHERE business_id=$1 AND source_type='business_sale'",
    )
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let movement_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_inventory_movements WHERE business_id=$1",
    )
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(sale_count, 0);
    assert_eq!(finance_count, 0);
    assert_eq!(movement_count, 0);
}
