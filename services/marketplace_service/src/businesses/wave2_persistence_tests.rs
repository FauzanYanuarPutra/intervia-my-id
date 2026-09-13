use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::wave2::{CreatePurchaseRequest, Wave2Repository};

struct SeededPurchaseContext {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    ingredient_id: Uuid,
}

async fn seed_purchase_context(pool: &PgPool) -> SeededPurchaseContext {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Wave 2 Purchase Test',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("wave2-purchase-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Wave 2 Purchase Test','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("6".repeat(64))
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
        INSERT INTO business_ingredients (
          id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, status
        ) VALUES ($1,$2,$3,'Alpukat','ingredient','kg','gram',1000,0,1,100,0,2,0,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    SeededPurchaseContext {
        actor_id,
        organization_id,
        business_id,
        ingredient_id,
    }
}

fn purchase_request(ingredient_id: Uuid) -> CreatePurchaseRequest {
    CreatePurchaseRequest {
        ingredient_id,
        stock_quantity_delta: Decimal::from(3),
        total_amount: 90_000,
        account_key: "cash".into(),
        occurred_on: NaiveDate::from_ymd_opt(2026, 9, 13).unwrap(),
        note: "Belanja alpukat".into(),
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn purchase_writes_stock_and_finance_exactly_once(pool: PgPool) {
    let seeded = seed_purchase_context(&pool).await;
    let repository = Wave2Repository::new(pool.clone());
    let key = Uuid::new_v4();

    let first = repository
        .create_purchase(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            purchase_request(seeded.ingredient_id),
        )
        .await
        .unwrap();
    let replay = repository
        .create_purchase(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            purchase_request(seeded.ingredient_id),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(replay.purchase.id, first.purchase.id);

    let stock: Decimal = sqlx::query_scalar(
        "SELECT stock_quantity FROM business_ingredients WHERE id=$1",
    )
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(stock, Decimal::from(5));

    let movement_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_inventory_movements WHERE business_id=$1 AND source_type='business_purchase' AND source_id=$2",
    )
    .bind(seeded.business_id)
    .bind(first.purchase.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(movement_count, 1);

    let finance: (i64, String) = sqlx::query_as(
        "SELECT amount, entry_type FROM business_finance_entries WHERE business_id=$1 AND source_type='business_purchase' AND source_id=$2",
    )
    .bind(seeded.business_id)
    .bind(first.purchase.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(finance.0, 90_000);
    assert_eq!(finance.1, "inventory_expense");

    let finance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_finance_entries WHERE business_id=$1 AND source_type='business_purchase' AND source_id=$2",
    )
    .bind(seeded.business_id)
    .bind(first.purchase.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(finance_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn allocation_plan_never_creates_ledger_effect(pool: PgPool) {
    let seeded = seed_purchase_context(&pool).await;
    let repository = Wave2Repository::new(pool.clone());

    repository
        .upsert_finance_plan(
            seeded.business_id,
            seeded.organization_id,
            super::wave2::FinancePlanRequest {
                owner_payroll_bps: 2_000,
                staff_payroll_bps: 1_500,
                working_capital_bps: 2_500,
                operations_bps: 2_000,
                reserve_bps: 1_000,
            },
        )
        .await
        .unwrap();

    let finance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_finance_entries WHERE business_id=$1",
    )
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(finance_count, 0, "planning targets must not move real money");
}
