use super::products::{
    stock_health, validate_create_request, CreateBusinessProductRequest, ProductRepository,
    ProductRepositoryError, ProductSourceType, ProductStockMode,
};
use sqlx::PgPool;
use uuid::Uuid;

fn request() -> CreateBusinessProductRequest {
    CreateBusinessProductRequest {
        name: "Jus mangga".to_owned(),
        category: "Minuman".to_owned(),
        price_label: "Rp10.000".to_owned(),
        source_type: ProductSourceType::Owned,
        owner_label: None,
        stock_count: Some(2.0),
        stock_unit: "cup".to_owned(),
        min_stock_alert: Some(2.0),
        stock_mode: ProductStockMode::Manual,
        consignment_terms: None,
        notes: None,
    }
}

#[test]
fn minimum_stock_boundary_is_low_stock() {
    assert_eq!(stock_health(Some(2.0), Some(2.0)), "tipis");
}

#[sqlx::test(migrations = "./migrations")]
async fn canonical_product_is_persisted_and_tenant_scoped(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let other_organization_id = Uuid::new_v4();
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
    .execute(&pool)
    .await
    .unwrap();

    let command = validate_create_request(request()).unwrap();
    let repository = ProductRepository::new(pool.clone());
    let created = repository
        .create(actor_id, business_id, organization_id, &command)
        .await
        .unwrap();

    assert_eq!(created.name, "Jus mangga");
    assert_eq!(created.stock_count, Some(2.0));
    assert_eq!(created.stock_health, "tipis");

    let mine = repository
        .list_for_business(business_id, organization_id)
        .await
        .unwrap();
    assert_eq!(mine.len(), 1);
    assert_eq!(mine[0].id, created.id);

    let other_tenant = repository
        .list_for_business(business_id, other_organization_id)
        .await
        .unwrap();
    assert!(other_tenant.is_empty());

    let missing_business = repository
        .create(actor_id, Uuid::new_v4(), organization_id, &command)
        .await
        .unwrap_err();
    assert!(matches!(
        missing_business,
        ProductRepositoryError::BusinessNotFound
    ));

    let outbox_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM events.event_outbox WHERE aggregate_id = $1 AND event_type = 'marketplace.business.product_created'",
    )
    .bind(business_id.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(outbox_count, 1);
}
