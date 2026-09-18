use super::public_commerce::{
    CreatePublicOrderRequest, PublicCommerceError, PublicCommerceRepository, PublicFulfillmentMode,
    PublicModifierSelectionInput, PublicOrderItemInput,
};
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededPublicProduct {
    business_id: Uuid,
    store_id: Uuid,
    merchant_id: Uuid,
    product_id: Uuid,
}

async fn seed_public_product(
    pool: &PgPool,
    price_cents: i64,
    stock_count: Option<i64>,
) -> SeededPublicProduct {
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let merchant_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let slug = format!("store-{}", &store_id.simple().to_string()[..12]);

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Wave 2B Merchant','retail','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(merchant_id)
    .bind(Uuid::new_v4())
    .bind("0".repeat(64))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, city, address, lat, lng,
          is_active, online_order_enabled, offline_order_enabled, metadata
        ) VALUES ($1,$2,$3,'Wave 2B Merchant',$4,'Tangerang Selatan','Jl. Test',-6.29,106.72,
                  TRUE,TRUE,TRUE,'{}'::jsonb)
        "#,
    )
    .bind(store_id)
    .bind(merchant_id)
    .bind(organization_id)
    .bind(slug)
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
        ) VALUES ($1,$2,$3,'Produk Canonical','Produk','Rp12.500','active','owned')
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
        INSERT INTO umkm_products (
          id, store_id, name, slug, category, price_cents, stock_qty, is_available, metadata
        ) VALUES ($1,$2,'Produk Canonical',$3,'Produk',$4,$5,TRUE,'{}'::jsonb)
        "#,
    )
    .bind(product_id)
    .bind(store_id)
    .bind(format!(
        "product-{}",
        &product_id.simple().to_string()[..12]
    ))
    .bind(price_cents)
    .bind(stock_count.unwrap_or(0) as i32)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_inventory (
          id, product_id, business_id, organization_id, stock_count,
          stock_unit, min_stock_alert, stock_mode
        ) VALUES ($1,$2,$3,$4,$5,'pcs',1,'manual')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .bind(stock_count.map(|value| value as f64))
    .execute(pool)
    .await
    .unwrap();

    SeededPublicProduct {
        business_id,
        store_id,
        merchant_id,
        product_id,
    }
}

fn order_request(items: Vec<(Uuid, i32)>) -> CreatePublicOrderRequest {
    CreatePublicOrderRequest {
        items: items
            .into_iter()
            .map(|(product_id, quantity)| PublicOrderItemInput {
                product_id,
                quantity,
                note: None,
                selected_options: Vec::new(),
            })
            .collect(),
        fulfillment_mode: Some(PublicFulfillmentMode::Pickup),
        note: Some("Tolong dikemas rapi".into()),
        source_surface: Some("www_umkm_storefront".into()),
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn creates_server_authoritative_canonical_order(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let buyer_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();

    let created = PublicCommerceRepository::new(pool.clone())
        .create_product_order(
            buyer_id,
            idempotency_key,
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();

    assert!(!created.replayed);
    assert_eq!(created.order.business_id, seeded.business_id);
    assert_eq!(created.order.source_type, "www");
    assert_eq!(
        created.order.source_surface.as_deref(),
        Some("www_umkm_storefront")
    );
    assert_eq!(created.order.currency, "IDR");
    assert_eq!(created.order.subtotal_amount, Decimal::from(25_000));
    assert_eq!(created.order.total_amount, Decimal::from(25_000));
    assert_eq!(created.items.len(), 1);
    assert_eq!(created.items[0].item_name, "Produk Canonical");
    assert_eq!(created.items[0].unit_price, Decimal::from(12_500));
    assert_eq!(created.items[0].line_total, Decimal::from(25_000));

    let stored: (Uuid, Uuid, Uuid, String, Option<String>) = sqlx::query_as(
        "SELECT user_id, merchant_id, business_id, source_type, source_surface FROM orders WHERE id=$1",
    )
    .bind(created.order.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(stored.0, buyer_id);
    assert_eq!(stored.1, seeded.merchant_id);
    assert_eq!(stored.2, seeded.business_id);
    assert_eq!(stored.3, "www");
    assert_eq!(stored.4.as_deref(), Some("www_umkm_storefront"));
}

#[sqlx::test(migrations = "./migrations")]
async fn same_product_with_different_configurations_stays_separate(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let groups = json!([{
        "id": "sugar",
        "name": "Tingkat gula",
        "selection_mode": "single",
        "required": true,
        "min_selections": 1,
        "max_selections": 1,
        "options": [
            {"id":"less","label":"Less Sugar","price_delta_cents":0,"is_default":false,"enabled":true},
            {"id":"normal","label":"Normal","price_delta_cents":0,"is_default":true,"enabled":true}
        ]
    }]);
    sqlx::query("UPDATE umkm_products SET metadata=jsonb_set(metadata,'{modifier_groups}',$2,true) WHERE id=$1")
        .bind(seeded.product_id)
        .bind(groups)
        .execute(&pool)
        .await
        .unwrap();

    let request = CreatePublicOrderRequest {
        items: vec![
            PublicOrderItemInput {
                product_id: seeded.product_id,
                quantity: 1,
                note: None,
                selected_options: vec![PublicModifierSelectionInput {
                    group_id: "sugar".into(),
                    option_ids: vec!["less".into()],
                }],
            },
            PublicOrderItemInput {
                product_id: seeded.product_id,
                quantity: 1,
                note: None,
                selected_options: vec![PublicModifierSelectionInput {
                    group_id: "sugar".into(),
                    option_ids: vec!["normal".into()],
                }],
            },
        ],
        fulfillment_mode: Some(PublicFulfillmentMode::Pickup),
        note: None,
        source_surface: Some("www_umkm_storefront".into()),
    };

    let created = PublicCommerceRepository::new(pool.clone())
        .create_product_order(Uuid::new_v4(), Uuid::new_v4(), request)
        .await
        .unwrap();
    assert_eq!(created.items.len(), 2);

    let signatures: Vec<String> = sqlx::query_scalar(
        "SELECT metadata->>'configuration_signature' FROM order_items WHERE order_id=$1 ORDER BY metadata->>'configuration_signature'",
    )
    .bind(created.order.id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(signatures, vec!["sugar=less", "sugar=normal"]);
}

#[sqlx::test(migrations = "./migrations")]
async fn stock_is_checked_across_all_configurations_of_same_product(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(1)).await;
    let request = CreatePublicOrderRequest {
        items: vec![
            PublicOrderItemInput {
                product_id: seeded.product_id,
                quantity: 1,
                note: None,
                selected_options: Vec::new(),
            },
            PublicOrderItemInput {
                product_id: seeded.product_id,
                quantity: 1,
                note: None,
                selected_options: Vec::new(),
            },
        ],
        fulfillment_mode: Some(PublicFulfillmentMode::Pickup),
        note: None,
        source_surface: None,
    };
    let error = PublicCommerceRepository::new(pool)
        .create_product_order(Uuid::new_v4(), Uuid::new_v4(), request)
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::InsufficientStock);
}

#[sqlx::test(migrations = "./migrations")]
async fn idempotent_retry_reuses_order_items_and_outbox(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let buyer_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();
    let repository = PublicCommerceRepository::new(pool.clone());

    let first = repository
        .create_product_order(
            buyer_id,
            idempotency_key,
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();
    let replay = repository
        .create_product_order(
            buyer_id,
            idempotency_key,
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(replay.order.id, first.order.id);

    let order_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM orders WHERE user_id=$1 AND idempotency_key=$2")
            .bind(buyer_id)
            .bind(idempotency_key.to_string())
            .fetch_one(&pool)
            .await
            .unwrap();
    let item_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM order_items WHERE order_id=$1")
        .bind(first.order.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM outbox_events WHERE aggregate_type='order' AND aggregate_id=$1 AND event_type='order.created'",
    )
    .bind(first.order.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(order_count, 1);
    assert_eq!(item_count, 1);
    assert_eq!(event_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn idempotency_key_rejects_a_different_order_payload(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let buyer_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();
    let repository = PublicCommerceRepository::new(pool.clone());

    repository
        .create_product_order(
            buyer_id,
            idempotency_key,
            order_request(vec![(seeded.product_id, 1)]),
        )
        .await
        .unwrap();

    let error = repository
        .create_product_order(
            buyer_id,
            idempotency_key,
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap_err();

    assert_eq!(error, PublicCommerceError::IdempotencyConflict);

    let stored_hash: Option<String> = sqlx::query_scalar(
        "SELECT category_specific_metadata->>'idempotency_request_hash' FROM orders WHERE user_id=$1 AND idempotency_key=$2",
    )
    .bind(buyer_id)
    .bind(idempotency_key.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(stored_hash.is_some_and(|value| value.len() == 64));
}

#[test]
fn stock_reservation_migration_is_tenant_scoped_and_fail_closed() {
    let migration =
        include_str!("../../migrations/20260918173000_business_order_stock_reservations.up.sql");
    let rollback =
        include_str!("../../migrations/20260918173000_business_order_stock_reservations.down.sql");

    for marker in [
        "organization_id UUID NOT NULL",
        "business_id UUID NOT NULL",
        "order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT",
        "UNIQUE (order_id, product_id)",
        "state IN ('reserved', 'released', 'consumed')",
        "idx_business_order_stock_reservations_active",
    ] {
        assert!(
            migration.contains(marker),
            "missing reservation invariant: {marker}"
        );
    }
    assert!(rollback.contains("refusing to drop business_order_stock_reservations"));
}

#[sqlx::test(migrations = "./migrations")]
async fn active_reservations_prevent_overselling_without_consuming_on_hand(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(2)).await;
    let repository = PublicCommerceRepository::new(pool.clone());

    let first = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();

    let error = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 1)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::InsufficientStock);

    let reservation: (Decimal, String) = sqlx::query_as(
        "SELECT quantity, state FROM business_order_stock_reservations WHERE order_id=$1 AND product_id=$2",
    )
    .bind(first.order.id)
    .bind(seeded.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation.0, Decimal::from(2));
    assert_eq!(reservation.1, "reserved");

    let stock: Option<f64> = sqlx::query_scalar(
        "SELECT stock_count FROM business_inventory WHERE product_id=$1 AND business_id=$2",
    )
    .bind(seeded.product_id)
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(stock, Some(2.0));
}

#[sqlx::test(migrations = "./migrations")]
async fn expired_reservation_no_longer_blocks_checkout(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(2)).await;
    let repository = PublicCommerceRepository::new(pool.clone());

    let first = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();
    sqlx::query(
        "UPDATE business_order_stock_reservations SET expires_at=NOW()-INTERVAL '1 second' WHERE order_id=$1",
    )
    .bind(first.order.id)
    .execute(&pool)
    .await
    .unwrap();

    let second = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();
    assert_ne!(first.order.id, second.order.id);
}

#[sqlx::test(migrations = "./migrations")]
async fn concurrent_buyers_cannot_both_reserve_the_last_unit(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(1)).await;
    let repository = PublicCommerceRepository::new(pool.clone());
    let first = repository.create_product_order(
        Uuid::new_v4(),
        Uuid::new_v4(),
        order_request(vec![(seeded.product_id, 1)]),
    );
    let second = repository.create_product_order(
        Uuid::new_v4(),
        Uuid::new_v4(),
        order_request(vec![(seeded.product_id, 1)]),
    );

    let (first, second) = tokio::join!(first, second);
    let successes = usize::from(first.is_ok()) + usize::from(second.is_ok());
    assert_eq!(successes, 1);
    let failures = [first.err(), second.err()]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    assert_eq!(failures, vec![PublicCommerceError::InsufficientStock]);

    let reservation_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_order_stock_reservations WHERE business_id=$1 AND product_id=$2 AND state='reserved'",
    )
    .bind(seeded.business_id)
    .bind(seeded.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn concurrent_identical_retries_share_one_order_and_one_reservation(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(1)).await;
    let repository = PublicCommerceRepository::new(pool.clone());
    let buyer_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();

    let first = repository.create_product_order(
        buyer_id,
        idempotency_key,
        order_request(vec![(seeded.product_id, 1)]),
    );
    let second = repository.create_product_order(
        buyer_id,
        idempotency_key,
        order_request(vec![(seeded.product_id, 1)]),
    );

    let (first, second) = tokio::join!(first, second);
    let first = first.unwrap();
    let second = second.unwrap();
    assert_eq!(first.order.id, second.order.id);
    assert_ne!(first.replayed, second.replayed);

    let reservation_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_order_stock_reservations WHERE order_id=$1",
    )
    .bind(first.order.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn order_creation_does_not_consume_inventory_or_create_sale_finance(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let repository = PublicCommerceRepository::new(pool.clone());

    let before: Option<f64> = sqlx::query_scalar(
        "SELECT stock_count FROM business_inventory WHERE product_id=$1 AND business_id=$2",
    )
    .bind(seeded.product_id)
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap();

    let after: Option<f64> = sqlx::query_scalar(
        "SELECT stock_count FROM business_inventory WHERE product_id=$1 AND business_id=$2",
    )
    .bind(seeded.product_id)
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let sale_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_sales WHERE business_id=$1")
            .bind(seeded.business_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let finance_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_finance_entries WHERE business_id=$1")
            .bind(seeded.business_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(before, after);
    assert_eq!(sale_count, 0);
    assert_eq!(finance_count, 0);

    let reservation: (Decimal, String) = sqlx::query_as(
        "SELECT quantity, state FROM business_order_stock_reservations WHERE business_id=$1 AND product_id=$2",
    )
    .bind(seeded.business_id)
    .bind(seeded.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation.0, Decimal::from(2));
    assert_eq!(reservation.1, "reserved");
}

#[sqlx::test(migrations = "./migrations")]
async fn rejects_known_insufficient_stock(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(1)).await;
    let error = PublicCommerceRepository::new(pool)
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 2)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::InsufficientStock);
}

#[sqlx::test(migrations = "./migrations")]
async fn rejects_unavailable_or_online_disabled_products(pool: PgPool) {
    let seeded = seed_public_product(&pool, 1_250_000, Some(10)).await;
    sqlx::query("UPDATE business_products SET status='archived' WHERE id=$1")
        .bind(seeded.product_id)
        .execute(&pool)
        .await
        .unwrap();

    let projection_available: bool =
        sqlx::query_scalar("SELECT is_available FROM umkm_products WHERE id=$1")
            .bind(seeded.product_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!projection_available);

    let repository = PublicCommerceRepository::new(pool.clone());
    let error = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 1)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::Unavailable);

    sqlx::query("UPDATE business_products SET status='active' WHERE id=$1")
        .bind(seeded.product_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE umkm_stores SET online_order_enabled=FALSE WHERE id=$1")
        .bind(seeded.store_id)
        .execute(&pool)
        .await
        .unwrap();

    let error = repository
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(seeded.product_id, 1)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::Unavailable);
}

#[sqlx::test(migrations = "./migrations")]
async fn rejects_cross_business_cart(pool: PgPool) {
    let first = seed_public_product(&pool, 1_250_000, Some(10)).await;
    let second = seed_public_product(&pool, 2_000_000, Some(10)).await;
    let error = PublicCommerceRepository::new(pool)
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(first.product_id, 1), (second.product_id, 1)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::MixedBusiness);
}

#[sqlx::test(migrations = "./migrations")]
async fn missing_product_fails_closed(pool: PgPool) {
    let error = PublicCommerceRepository::new(pool)
        .create_product_order(
            Uuid::new_v4(),
            Uuid::new_v4(),
            order_request(vec![(Uuid::new_v4(), 1)]),
        )
        .await
        .unwrap_err();
    assert_eq!(error, PublicCommerceError::NotFound);
}
