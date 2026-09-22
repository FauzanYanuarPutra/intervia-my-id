use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::seller_orders::{
    SellerOrderRepository, SellerOrderRepositoryError, TransitionSellerOrderRequest,
};

struct SeededOrderContext {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    order_id: Uuid,
    product_id: Uuid,
}

async fn seed_order_context(pool: &PgPool, status: &str) -> SeededOrderContext {
    let actor_id = Uuid::new_v4();
    let buyer_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let order_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Seller Order Test',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("seller-order-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Seller Order Test','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("7".repeat(64))
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
        ) VALUES ($1,$2,$3,'Jus Alpukat','Minuman','Rp1.000','active','owned')
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
        ) VALUES ($1,$2,'Jus Alpukat',$3,'Minuman',100000,5,TRUE,'{}'::jsonb)
        "#,
    )
    .bind(product_id)
    .bind(store_id)
    .bind(format!(
        "jus-alpukat-{}",
        &product_id.simple().to_string()[..8]
    ))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_inventory (
          id, product_id, business_id, organization_id, stock_count,
          stock_unit, min_stock_alert, stock_mode
        ) VALUES ($1,$2,$3,$4,5,'pcs',1,'manual')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO orders (
          id, order_number, user_id, merchant_id, business_id,
          category_type, base_status, payment_status, currency,
          subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
          idempotency_key, category_specific_metadata, source_type, source_surface, version
        ) VALUES (
          $1,$2,$3,$4,$5,
          'PHYSICAL_GOODS',$6::order_base_status,
          CASE WHEN $6 = 'PAID' THEN 'PAID'::order_payment_status ELSE 'UNPAID'::order_payment_status END,
          'IDR',100000,0,0,0,100000,
          $7,'{"fulfillment_mode":"courier"}'::jsonb,'www','storefront',1
        )
        "#,
    )
    .bind(order_id)
    .bind(format!("LJK-TEST-{}", &order_id.simple().to_string()[..8]))
    .bind(buyer_id)
    .bind(actor_id)
    .bind(business_id)
    .bind(status)
    .bind(Uuid::new_v4().to_string())
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO order_items (
          id, order_id, product_id, item_name, quantity, unit_price, line_total, metadata
        ) VALUES ($1,$2,$3,'Jus Alpukat',1,100000,100000,'{}'::jsonb)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(order_id)
    .bind(product_id)
    .execute(pool)
    .await
    .unwrap();

    SeededOrderContext {
        actor_id,
        organization_id,
        business_id,
        order_id,
        product_id,
    }
}

async fn seed_reservation(pool: &PgPool, seeded: &SeededOrderContext, quantity: i64) {
    sqlx::query(
        r#"
        INSERT INTO business_order_stock_reservations (
          organization_id, business_id, order_id, product_id, quantity, expires_at
        ) VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL '30 minutes')
        "#,
    )
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(seeded.order_id)
    .bind(seeded.product_id)
    .bind(Decimal::from(quantity))
    .execute(pool)
    .await
    .unwrap();
}

fn transition_request(expected_version: i64, next_status: &str) -> TransitionSellerOrderRequest {
    TransitionSellerOrderRequest {
        expected_version,
        next_status: next_status.to_owned(),
        reason: Some("operasional normal".to_owned()),
        metadata: None,
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn seller_transition_is_atomic_and_replay_safe(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PAID").await;
    let repository = SellerOrderRepository::new(pool.clone());
    let key = Uuid::new_v4();

    let first = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            transition_request(1, "PROCESSING"),
        )
        .await
        .unwrap();
    let replay = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            transition_request(1, "PROCESSING"),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(first.order.order.base_status, "PROCESSING");
    assert_eq!(first.order.order.version, 2);
    assert_eq!(replay.order.order.version, 2);

    let transition_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM order_state_transitions WHERE order_id=$1 AND idempotency_key=$2",
    )
    .bind(seeded.order_id)
    .bind(key)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(transition_count, 1);

    let outbox_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM outbox_events WHERE aggregate_id=$1 AND event_type='order.processing'",
    )
    .bind(seeded.order_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(outbox_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn seller_can_confirm_manual_payment_from_pending_payment(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PENDING_PAYMENT").await;
    let repository = SellerOrderRepository::new(pool.clone());
    let mut request = transition_request(1, "PAID");
    request.reason = Some("Pembayaran manual dikonfirmasi".to_owned());
    request.metadata = Some(serde_json::json!({
        "payment_confirmation": {
            "mode": "manual",
            "method": "cash",
            "reference": "",
            "note": "Dibayar tunai di toko"
        }
    }));

    let outcome = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            Uuid::new_v4(),
            request,
        )
        .await
        .unwrap();

    assert_eq!(outcome.order.order.base_status, "PAID");
    assert_eq!(outcome.order.order.payment_status, "PAID");

    let (base_status, payment_status, paid_at, provider, metadata): (
        String,
        String,
        Option<chrono::DateTime<chrono::Utc>>,
        Option<String>,
        serde_json::Value,
    ) = sqlx::query_as(
        "SELECT base_status::text, payment_status::text, paid_at, payment_provider, category_specific_metadata FROM orders WHERE id=$1",
    )
    .bind(seeded.order_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(base_status, "PAID");
    assert_eq!(payment_status, "PAID");
    assert!(paid_at.is_some());
    assert_eq!(provider.as_deref(), Some("manual"));
    assert_eq!(
        metadata["payment_confirmation"]["method"].as_str(),
        Some("cash")
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn processing_consumes_reservation_and_stock_exactly_once(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PAID").await;
    seed_reservation(&pool, &seeded, 2).await;
    let repository = SellerOrderRepository::new(pool.clone());
    let key = Uuid::new_v4();

    let first = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            transition_request(1, "PROCESSING"),
        )
        .await
        .unwrap();
    let replay = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            transition_request(1, "PROCESSING"),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);

    let stock: Option<f64> =
        sqlx::query_scalar("SELECT stock_count FROM business_inventory WHERE product_id=$1")
            .bind(seeded.product_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Some(3.0));

    let public_stock: i32 = sqlx::query_scalar("SELECT stock_qty FROM umkm_products WHERE id=$1")
        .bind(seeded.product_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(public_stock, 3);

    let reservation: (String, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
        "SELECT state, consumed_at FROM business_order_stock_reservations WHERE order_id=$1 AND product_id=$2",
    )
    .bind(seeded.order_id)
    .bind(seeded.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation.0, "consumed");
    assert!(reservation.1.is_some());
}

#[sqlx::test(migrations = "./migrations")]
async fn rejecting_unpaid_order_releases_hold_without_consuming_stock(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PENDING_PAYMENT").await;
    seed_reservation(&pool, &seeded, 2).await;
    let repository = SellerOrderRepository::new(pool.clone());

    let outcome = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            Uuid::new_v4(),
            transition_request(1, "REJECTED"),
        )
        .await
        .unwrap();
    assert_eq!(outcome.order.order.base_status, "REJECTED");

    let stock: Option<f64> =
        sqlx::query_scalar("SELECT stock_count FROM business_inventory WHERE product_id=$1")
            .bind(seeded.product_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Some(5.0));

    let reservation: (String, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
        "SELECT state, released_at FROM business_order_stock_reservations WHERE order_id=$1 AND product_id=$2",
    )
    .bind(seeded.order_id)
    .bind(seeded.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reservation.0, "released");
    assert!(reservation.1.is_some());
}

#[sqlx::test(migrations = "./migrations")]
async fn seller_transition_rejects_changed_payload_for_same_key(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PAID").await;
    let repository = SellerOrderRepository::new(pool.clone());
    let key = Uuid::new_v4();

    repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            transition_request(1, "PROCESSING"),
        )
        .await
        .unwrap();

    let mut changed = transition_request(1, "PROCESSING");
    changed.reason = Some("alasan berbeda".to_owned());
    let result = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            key,
            changed,
        )
        .await;

    assert!(matches!(
        result,
        Err(SellerOrderRepositoryError::IdempotencyConflict)
    ));
}

#[sqlx::test(migrations = "./migrations")]
async fn seller_transition_rejects_stale_version_without_side_effect(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PAID").await;
    let repository = SellerOrderRepository::new(pool.clone());

    let result = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.order_id,
            Uuid::new_v4(),
            transition_request(2, "PROCESSING"),
        )
        .await;

    assert!(matches!(
        result,
        Err(SellerOrderRepositoryError::VersionConflict)
    ));

    let state: (String, i64) =
        sqlx::query_as("SELECT base_status::text, version FROM orders WHERE id=$1")
            .bind(seeded.order_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(state.0, "PAID");
    assert_eq!(state.1, 1);

    let transition_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM order_state_transitions WHERE order_id=$1")
            .bind(seeded.order_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(transition_count, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn seller_orders_are_tenant_scoped(pool: PgPool) {
    let seeded = seed_order_context(&pool, "PAID").await;
    let repository = SellerOrderRepository::new(pool.clone());

    let visible = repository
        .list(seeded.business_id, seeded.organization_id, 200)
        .await
        .unwrap();
    assert_eq!(visible.len(), 1);
    assert_eq!(visible[0].order.id, seeded.order_id);
    assert_eq!(visible[0].items.len(), 1);
    assert_eq!(visible[0].order.total_amount, Decimal::from(100000));

    let hidden = repository
        .list(seeded.business_id, Uuid::new_v4(), 200)
        .await
        .unwrap();
    assert!(hidden.is_empty());

    let result = repository
        .transition(
            seeded.actor_id,
            seeded.business_id,
            Uuid::new_v4(),
            seeded.order_id,
            Uuid::new_v4(),
            transition_request(1, "PROCESSING"),
        )
        .await;
    assert!(matches!(result, Err(SellerOrderRepositoryError::NotFound)));
}
