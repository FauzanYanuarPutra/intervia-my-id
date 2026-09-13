use super::sales::{CreateSaleLineRequest, CreateSaleRequest, SaleRepository};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededUncostedSale {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    product_id: Uuid,
}

async fn seed_uncosted_product(pool: &PgPool) -> SeededUncostedSale {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Warung Test',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("uncosted-sale-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Warung Test','food_beverage','active',$3,$4,$5)
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
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Es Jeruk','Minuman','Rp10.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    SeededUncostedSale {
        actor_id,
        organization_id,
        business_id,
        product_id,
    }
}

fn request(product_id: Uuid) -> CreateSaleRequest {
    CreateSaleRequest {
        occurred_on: NaiveDate::from_ymd_opt(2026, 9, 13).unwrap(),
        channel_key: Some("offline".into()),
        account_key: "cash".into(),
        lines: vec![CreateSaleLineRequest {
            product_id,
            quantity: Decimal::from(2),
            unit_price_amount: 10_000,
            discount_amount: 0,
        }],
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn sale_without_recipe_records_revenue_with_incomplete_cost(pool: PgPool) {
    let seeded = seed_uncosted_product(&pool).await;
    let created = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            request(seeded.product_id),
        )
        .await
        .unwrap();

    assert_eq!(created.sale.sale.final_amount, 20_000);
    assert_eq!(created.sale.sale.cogs_amount, None);
    assert!(!created.sale.sale.cost_complete);
    assert_eq!(created.sale.lines.len(), 1);
    assert_eq!(created.sale.lines[0].unit_cogs_amount, None);
    assert_eq!(created.sale.lines[0].line_cogs_amount, None);
    assert_eq!(
        created.sale.lines[0]
            .cost_snapshot
            .get("status")
            .and_then(|value| value.as_str()),
        Some("incomplete")
    );

    let finance: (String, i64, Option<String>, Option<Uuid>) = sqlx::query_as(
        r#"
        SELECT entry_type, amount, source_type, source_id
        FROM business_finance_entries
        WHERE business_id=$1 AND source_type='business_sale' AND source_id=$2
        "#,
    )
    .bind(seeded.business_id)
    .bind(created.sale.sale.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(finance.0, "sale_income");
    assert_eq!(finance.1, 20_000);
    assert_eq!(finance.2.as_deref(), Some("business_sale"));
    assert_eq!(finance.3, Some(created.sale.sale.id));
}

#[sqlx::test(migrations = "./migrations")]
async fn incomplete_cost_sale_replay_keeps_one_finance_effect(pool: PgPool) {
    let seeded = seed_uncosted_product(&pool).await;
    let repository = SaleRepository::new(pool.clone());
    let key = Uuid::new_v4();

    let first = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            request(seeded.product_id),
        )
        .await
        .unwrap();
    let replay = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            request(seeded.product_id),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(replay.sale.sale.id, first.sale.sale.id);

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
