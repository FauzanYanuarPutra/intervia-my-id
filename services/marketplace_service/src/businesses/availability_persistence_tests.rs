use super::control::{
    ControlRepository, CreateIngredientRequest, RecipeItemInput, ReplaceRecipeRequest,
};
use super::products::{
    validate_create_request, AdjustBusinessInventoryRequest, CreateBusinessProductRequest,
    ProductRepository, ProductSourceType, ProductStockMode,
};
use super::sales::{CreateSaleLineRequest, CreateSaleRequest, SaleRepository};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

struct RecipeBackedProductContext {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    product_id: Uuid,
}

async fn seed_business(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();

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
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, city, address,
          lat, lng, is_active, online_order_enabled, offline_order_enabled, metadata
        ) VALUES ($1, $2, $3, 'Lajukan Juice', $4, 'Tangerang Selatan', 'Jl. Contoh',
                  -6.3, 106.7, TRUE, TRUE, TRUE, '{}'::JSONB)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("lajukan-juice-{store_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO business_store_links (business_id, store_id, link_type) VALUES ($1, $2, 'primary')",
    )
    .bind(business_id)
    .bind(store_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_locations (
          id, business_id, store_id, organization_id, name, address, city,
          lat, lng, status, is_primary, public_visibility
        ) VALUES ($1, $2, $3, $4, 'Lokasi utama', 'Jl. Contoh', 'Tangerang Selatan',
                  -6.3, 106.7, 'active', TRUE, TRUE)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(business_id)
    .bind(store_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    (actor_id, organization_id, business_id)
}

fn product_request() -> CreateBusinessProductRequest {
    CreateBusinessProductRequest {
        name: "Jus mangga".to_owned(),
        category: "Minuman".to_owned(),
        price_label: "Rp10.000".to_owned(),
        source_type: ProductSourceType::Owned,
        owner_label: None,
        stock_count: Some(10.0),
        stock_unit: "cup".to_owned(),
        min_stock_alert: Some(2.0),
        stock_mode: ProductStockMode::Manual,
        consignment_terms: None,
        notes: None,
    }
}

fn ingredient_request(stock_quantity: Decimal) -> CreateIngredientRequest {
    CreateIngredientRequest {
        name: "Mangga".to_owned(),
        kind: "ingredient".to_owned(),
        purchase_unit: "gram".to_owned(),
        recipe_unit: "gram".to_owned(),
        conversion_factor: Decimal::ONE,
        purchase_price_amount: 30_000,
        purchase_quantity: Decimal::from(1_000),
        yield_percent: Decimal::from(100),
        waste_percent: Decimal::ZERO,
        stock_quantity,
        minimum_stock: Decimal::from(100),
        supplier_name: None,
    }
}

async fn create_recipe_backed_product(
    pool: &PgPool,
    ingredient_stock: Decimal,
) -> RecipeBackedProductContext {
    let (actor_id, organization_id, business_id) = seed_business(pool).await;
    let product_repository = ProductRepository::new(pool.clone());
    let product = product_repository
        .create(
            actor_id,
            business_id,
            organization_id,
            &validate_create_request(product_request()).unwrap(),
        )
        .await
        .unwrap();

    let control_repository = ControlRepository::new(pool.clone());
    let ingredient = control_repository
        .create_ingredient(
            business_id,
            organization_id,
            ingredient_request(ingredient_stock),
        )
        .await
        .unwrap();

    control_repository
        .replace_recipe(
            business_id,
            organization_id,
            product.id,
            ReplaceRecipeRequest {
                name: "Resep jus mangga".to_owned(),
                servings: Decimal::ONE,
                items: vec![RecipeItemInput {
                    ingredient_id: ingredient.id,
                    quantity: Decimal::from(150),
                    waste_percent_override: None,
                }],
            },
        )
        .await
        .unwrap();

    RecipeBackedProductContext {
        actor_id,
        organization_id,
        business_id,
        product_id: product.id,
    }
}

fn sale_request(product_id: Uuid) -> CreateSaleRequest {
    CreateSaleRequest {
        occurred_on: NaiveDate::from_ymd_opt(2026, 9, 10).unwrap(),
        channel_key: Some("offline".to_owned()),
        account_key: "cash".to_owned(),
        lines: vec![CreateSaleLineRequest {
            product_id,
            quantity: Decimal::from(2),
            unit_price_amount: 10_000,
            discount_amount: 0,
        }],
    }
}

async fn public_stock(pool: &PgPool, product_id: Uuid) -> (i32, bool) {
    sqlx::query_as("SELECT stock_qty, is_available FROM umkm_products WHERE id=$1")
        .bind(product_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[sqlx::test(migrations = "./migrations")]
async fn recipe_capacity_limits_public_stock(pool: PgPool) {
    let context = create_recipe_backed_product(&pool, Decimal::from(300)).await;

    assert_eq!(public_stock(&pool, context.product_id).await, (2, true));
}

#[sqlx::test(migrations = "./migrations")]
async fn recipe_without_one_sellable_unit_fails_closed_publicly(pool: PgPool) {
    let context = create_recipe_backed_product(&pool, Decimal::from(149)).await;

    assert_eq!(public_stock(&pool, context.product_id).await, (0, false));
}

#[sqlx::test(migrations = "./migrations")]
async fn product_inventory_adjustments_cannot_override_recipe_capacity(pool: PgPool) {
    let context = create_recipe_backed_product(&pool, Decimal::from(300)).await;
    let repository = ProductRepository::new(pool.clone());

    repository
        .adjust_inventory(
            context.actor_id,
            context.business_id,
            context.organization_id,
            context.product_id,
            AdjustBusinessInventoryRequest {
                stock_count: None,
                reason: Some("Gunakan kapasitas resep".to_owned()),
            },
        )
        .await
        .unwrap();
    assert_eq!(public_stock(&pool, context.product_id).await, (2, true));

    repository
        .adjust_inventory(
            context.actor_id,
            context.business_id,
            context.organization_id,
            context.product_id,
            AdjustBusinessInventoryRequest {
                stock_count: Some(1.0),
                reason: Some("Stok jadi dibatasi barang jadi".to_owned()),
            },
        )
        .await
        .unwrap();
    assert_eq!(public_stock(&pool, context.product_id).await, (1, true));
}

#[sqlx::test(migrations = "./migrations")]
async fn archived_recipe_ingredient_fails_closed_publicly(pool: PgPool) {
    let context = create_recipe_backed_product(&pool, Decimal::from(300)).await;

    sqlx::query(
        "UPDATE business_ingredients SET status='archived', updated_at=NOW() WHERE business_id=$1 AND organization_id=$2",
    )
    .bind(context.business_id)
    .bind(context.organization_id)
    .execute(&pool)
    .await
    .unwrap();

    assert_eq!(public_stock(&pool, context.product_id).await, (0, false));
}

#[sqlx::test(migrations = "./migrations")]
async fn completed_sale_refreshes_public_recipe_capacity_and_replay_does_not_drift(pool: PgPool) {
    let context = create_recipe_backed_product(&pool, Decimal::from(300)).await;
    let repository = SaleRepository::new(pool.clone());
    let idempotency_key = Uuid::new_v4();

    let first = repository
        .create(
            context.actor_id,
            context.business_id,
            context.organization_id,
            idempotency_key,
            sale_request(context.product_id),
        )
        .await
        .unwrap();
    assert!(!first.replayed);
    assert_eq!(public_stock(&pool, context.product_id).await, (0, false));

    let replay = repository
        .create(
            context.actor_id,
            context.business_id,
            context.organization_id,
            idempotency_key,
            sale_request(context.product_id),
        )
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(public_stock(&pool, context.product_id).await, (0, false));

    let remaining_stock: Decimal = sqlx::query_scalar(
        "SELECT stock_quantity FROM business_ingredients WHERE business_id=$1 AND organization_id=$2",
    )
    .bind(context.business_id)
    .bind(context.organization_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(remaining_stock, Decimal::ZERO);
}
