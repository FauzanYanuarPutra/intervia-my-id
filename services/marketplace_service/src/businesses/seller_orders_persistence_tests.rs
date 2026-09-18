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
}

async fn seed_order_context(pool: &PgPool, status: &str) -> SeededOrderContext {
    let actor_id = Uuid::new_v4();
    let buyer_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let order_id = Uuid::new_v4();

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
          id, order_id, item_name, quantity, unit_price, line_total, metadata
        ) VALUES ($1,$2,'Jus Alpukat',1,100000,100000,'{}'::jsonb)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(order_id)
    .execute(pool)
    .await
    .unwrap();

    SeededOrderContext {
        actor_id,
        organization_id,
        business_id,
        order_id,
    }
}

fn transition_request(expected_version: i64, next_status: &str) -> TransitionSellerOrderRequest {
    TransitionSellerOrderRequest {
        expected_version,
        next_status: next_status.to_owned(),
        reason: Some("operasional normal".to_owned()),
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
