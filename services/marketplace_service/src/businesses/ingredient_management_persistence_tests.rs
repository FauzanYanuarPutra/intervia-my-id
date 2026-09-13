use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    ingredient_management::{
        IngredientManagementError, IngredientManagementRepository, UpdateIngredientRequest,
    },
    inventory::{InventoryMutationRequest, InventoryOperation, InventoryRepository},
};

struct SeededIngredientContext {
    owner_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    location_id: Uuid,
    ingredient_id: Uuid,
}

async fn seed_context(pool: &PgPool) -> SeededIngredientContext {
    let owner_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let location_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Ingredient Test',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(owner_id)
    .bind(organization_id)
    .bind(format!("ingredient-test-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Ingredient Test','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(owner_id)
    .bind(Uuid::new_v4())
    .bind("8".repeat(64))
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
    .bind(location_id)
    .bind(store_id)
    .bind(organization_id)
    .bind(business_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_ingredients (
          id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, status
        ) VALUES ($1,$2,$3,'Alpukat','ingredient','kg','gram',1000,0,1,100,0,1000,0,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    SeededIngredientContext {
        owner_id,
        organization_id,
        business_id,
        location_id,
        ingredient_id,
    }
}

fn update_request() -> UpdateIngredientRequest {
    UpdateIngredientRequest {
        name: "Alpukat Mentega".into(),
        kind: "ingredient".into(),
        purchase_unit: "kg".into(),
        recipe_unit: "gram".into(),
        conversion_factor: Decimal::from(1000),
        purchase_price_amount: 34_000,
        purchase_quantity: Decimal::ONE,
        yield_percent: Decimal::from(80),
        waste_percent: Decimal::from(5),
        minimum_stock: Decimal::from(500),
        supplier_name: Some("Pasar Induk".into()),
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn edit_updates_costing_fields_without_overwriting_stock(pool: PgPool) {
    let seeded = seed_context(&pool).await;
    let repository = IngredientManagementRepository::new(pool.clone());

    let updated = repository
        .update(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.ingredient_id,
            update_request(),
        )
        .await
        .unwrap();

    assert_eq!(updated.name, "Alpukat Mentega");
    assert_eq!(updated.purchase_price_amount, 34_000);
    assert_eq!(updated.yield_percent, Decimal::from(80));
    assert_eq!(updated.minimum_stock, Decimal::from(500));
    assert_eq!(updated.stock_quantity, Decimal::from(1000));
    assert_eq!(updated.supplier_name.as_deref(), Some("Pasar Induk"));
}

#[sqlx::test(migrations = "./migrations")]
async fn active_recipe_blocks_archive(pool: PgPool) {
    let seeded = seed_context(&pool).await;
    let product_id = Uuid::new_v4();
    let recipe_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Jus Alpukat','Minuman','Rp15.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(seeded.business_id)
    .bind(seeded.organization_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipes (
          id, business_id, organization_id, product_id, name, servings, status, version
        ) VALUES ($1,$2,$3,$4,'Jus Alpukat',1,'active',1)
        "#,
    )
    .bind(recipe_id)
    .bind(seeded.business_id)
    .bind(seeded.organization_id)
    .bind(product_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_items (
          recipe_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,120,0)
        "#,
    )
    .bind(recipe_id)
    .bind(seeded.ingredient_id)
    .execute(&pool)
    .await
    .unwrap();

    let error = IngredientManagementRepository::new(pool)
        .archive(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.ingredient_id,
        )
        .await
        .unwrap_err();

    assert_eq!(
        error,
        IngredientManagementError::Conflict("ingredient_in_active_recipe")
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn effective_published_recipe_version_blocks_archive_even_without_legacy_recipe(pool: PgPool) {
    let seeded = seed_context(&pool).await;
    let product_id = Uuid::new_v4();
    let version_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Jus Alpukat V2','Minuman','Rp16.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(seeded.business_id)
    .bind(seeded.organization_id)
    .execute(&pool)
    .await
    .unwrap();

    let mut tx = pool.begin().await.unwrap();
    sqlx::query(
        r#"
        INSERT INTO business_recipe_version_items (
          organization_id, business_id, recipe_version_id, ingredient_id,
          quantity, position
        ) VALUES ($1,$2,$3,$4,120,0)
        "#,
    )
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(version_id)
    .bind(seeded.ingredient_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,1,'Jus Alpukat V2',1,'published',NOW() - INTERVAL '1 minute',$5,'test')
        "#,
    )
    .bind(version_id)
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(product_id)
    .bind(seeded.owner_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let error = IngredientManagementRepository::new(pool)
        .archive(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.ingredient_id,
        )
        .await
        .unwrap_err();

    assert_eq!(
        error,
        IngredientManagementError::Conflict("ingredient_in_active_recipe")
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn unused_ingredient_can_be_archived_without_deleting_history(pool: PgPool) {
    let seeded = seed_context(&pool).await;
    let repository = IngredientManagementRepository::new(pool.clone());

    let archived = repository
        .archive(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.ingredient_id,
        )
        .await
        .unwrap();

    assert_eq!(archived.status, "archived");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_ingredients WHERE id=$1 AND status='archived'",
    )
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn primary_history_combines_location_movements_and_sale_consumption(pool: PgPool) {
    let seeded = seed_context(&pool).await;
    let inventory = InventoryRepository::new(pool.clone());

    inventory
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.location_id,
            Uuid::new_v4(),
            InventoryMutationRequest {
                ingredient_id: seeded.ingredient_id,
                operation: InventoryOperation::PurchaseReceipt,
                quantity: Some(Decimal::from(100)),
                quantity_delta: None,
                counted_quantity: None,
                reason: Some("Belanja pasar".into()),
                evidence_refs: vec![],
            },
        )
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_inventory_movements (
          business_id, organization_id, ingredient_id, movement_type,
          quantity_delta, quantity_before, quantity_after,
          source_type, source_id, note, created_by_user_id
        ) VALUES ($1,$2,$3,'sale_consumption',-50,1100,1050,'business_sale',$4,'Konsumsi bahan dari penjualan',$5)
        "#,
    )
    .bind(seeded.business_id)
    .bind(seeded.organization_id)
    .bind(seeded.ingredient_id)
    .bind(Uuid::new_v4())
    .bind(seeded.owner_id)
    .execute(&pool)
    .await
    .unwrap();

    let movements = IngredientManagementRepository::new(pool)
        .list_movements(
            seeded.business_id,
            seeded.organization_id,
            seeded.location_id,
            seeded.ingredient_id,
            100,
        )
        .await
        .unwrap();

    assert_eq!(movements.len(), 2);
    assert!(movements.iter().any(|item| item.location_id.is_some()));
    assert!(movements.iter().any(|item| {
        item.movement_type == "sale_consumption"
            && item.source_type.as_deref() == Some("business_sale")
    }));
}
