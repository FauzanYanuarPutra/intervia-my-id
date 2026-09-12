use super::sales::{CreateSaleLineRequest, CreateSaleRequest, SaleRepository, SaleRepositoryError};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededVersionedSale {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    product_id: Uuid,
    ingredient_id: Uuid,
    version_one_id: Uuid,
    version_two_id: Uuid,
}

async fn seed_versioned_sale(pool: &PgPool) -> SeededVersionedSale {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let location_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();
    let legacy_recipe_id = Uuid::new_v4();
    let version_one_id = Uuid::new_v4();
    let version_two_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Versioned Juice',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("versioned-sale-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Versioned Juice','food_beverage','active',$3,$4,$5)
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
    .bind(location_id)
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
        ) VALUES ($1,$2,$3,'Jus Mangga','Minuman','Rp12.000','active','owned')
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
        ) VALUES ($1,$2,$3,'Mangga','ingredient','kg','g',1000,30000,1,100,0,5000,0,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    // Legacy projection deliberately differs from immutable history. A sale on
    // 2026-09-09 must use immutable v1 (100g), not this mutable 150g projection.
    sqlx::query(
        r#"
        INSERT INTO business_recipes (
          id, business_id, organization_id, product_id, name, servings, status, version
        ) VALUES ($1,$2,$3,$4,'Legacy projection',1,'active',99)
        "#,
    )
    .bind(legacy_recipe_id)
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_items (recipe_id, ingredient_id, quantity, position)
        VALUES ($1,$2,150,0)
        "#,
    )
    .bind(legacy_recipe_id)
    .bind(ingredient_id)
    .execute(pool)
    .await
    .unwrap();

    // Build each immutable BOM before inserting its parent version. The
    // deferred FK permits aggregate assembly inside one transaction, while the
    // parent insert seals that BOM against later item changes.
    let mut tx = pool.begin().await.unwrap();
    sqlx::query(
        r#"
        INSERT INTO business_recipe_version_items (
          organization_id, business_id, recipe_version_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,$3,$4,100,0)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(version_one_id)
    .bind(ingredient_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,1,'Immutable v1',1,'published','2026-09-01T00:00:00Z',$5,'initial publish')
        "#,
    )
    .bind(version_one_id)
    .bind(organization_id)
    .bind(business_id)
    .bind(product_id)
    .bind(actor_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        UPDATE business_recipe_versions
        SET status='superseded', effective_until='2026-09-10T00:00:00Z',
            superseded_by_version_id=$2, updated_at=NOW()
        WHERE id=$1
        "#,
    )
    .bind(version_one_id)
    .bind(version_two_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_version_items (
          organization_id, business_id, recipe_version_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,$3,$4,200,0)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(version_two_id)
    .bind(ingredient_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,2,'Immutable v2',1,'published','2026-09-10T00:00:00Z',$5,'second publish')
        "#,
    )
    .bind(version_two_id)
    .bind(organization_id)
    .bind(business_id)
    .bind(product_id)
    .bind(actor_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    SeededVersionedSale {
        actor_id,
        organization_id,
        business_id,
        product_id,
        ingredient_id,
        version_one_id,
        version_two_id,
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn sale_uses_effective_recipe_version_for_snapshot_and_consumption(pool: PgPool) {
    let seeded = seed_versioned_sale(&pool).await;
    let created = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            CreateSaleRequest {
                occurred_on: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
                channel_key: Some("offline".into()),
                account_key: "cash".into(),
                lines: vec![CreateSaleLineRequest {
                    product_id: seeded.product_id,
                    quantity: Decimal::from(2),
                    unit_price_amount: 12_000,
                    discount_amount: 0,
                }],
            },
        )
        .await
        .unwrap();

    let persisted_version_id: Option<Uuid> =
        sqlx::query_scalar("SELECT recipe_version_id FROM business_sale_lines WHERE sale_id=$1")
            .bind(created.sale.sale.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(persisted_version_id, Some(seeded.version_one_id));

    assert_eq!(
        created.sale.lines[0]
            .cost_snapshot
            .get("recipe_version")
            .and_then(|value| value.as_i64()),
        Some(1)
    );

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(4_800));

    let movement_delta: Decimal = sqlx::query_scalar(
        "SELECT quantity_delta FROM business_inventory_movements WHERE source_type='business_sale' AND source_id=$1 AND ingredient_id=$2",
    )
    .bind(created.sale.sale.id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(movement_delta, Decimal::from(-200));
}

#[sqlx::test(migrations = "./migrations")]
async fn sale_before_first_immutable_version_does_not_use_legacy_projection(pool: PgPool) {
    let seeded = seed_versioned_sale(&pool).await;
    let result = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            CreateSaleRequest {
                occurred_on: NaiveDate::from_ymd_opt(2026, 8, 31).unwrap(),
                channel_key: Some("offline".into()),
                account_key: "cash".into(),
                lines: vec![CreateSaleLineRequest {
                    product_id: seeded.product_id,
                    quantity: Decimal::ONE,
                    unit_price_amount: 12_000,
                    discount_amount: 0,
                }],
            },
        )
        .await;

    assert_eq!(result.unwrap_err(), SaleRepositoryError::IncompleteCosting);

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(5_000));

    let sales_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_sales WHERE business_id=$1")
            .bind(seeded.business_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(sales_count, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn current_day_sale_uses_version_effective_at_posting_time(pool: PgPool) {
    let seeded = seed_versioned_sale(&pool).await;
    let version_three_id = Uuid::new_v4();
    let effective_from: DateTime<Utc> = sqlx::query_scalar("SELECT NOW() - INTERVAL '1 second'")
        .fetch_one(&pool)
        .await
        .unwrap();

    let mut tx = pool.begin().await.unwrap();
    sqlx::query(
        r#"
        UPDATE business_recipe_versions
        SET status='superseded', effective_until=$3,
            superseded_by_version_id=$2, updated_at=NOW()
        WHERE id=$1
        "#,
    )
    .bind(seeded.version_two_id)
    .bind(version_three_id)
    .bind(effective_from)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_version_items (
          organization_id, business_id, recipe_version_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,$3,$4,250,0)
        "#,
    )
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(version_three_id)
    .bind(seeded.ingredient_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,3,'Immutable v3',1,'published',$5,$6,'same-day publish')
        "#,
    )
    .bind(version_three_id)
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(seeded.product_id)
    .bind(effective_from)
    .bind(seeded.actor_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let occurred_on: NaiveDate = sqlx::query_scalar("SELECT CURRENT_DATE")
        .fetch_one(&pool)
        .await
        .unwrap();
    let created = SaleRepository::new(pool.clone())
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            CreateSaleRequest {
                occurred_on,
                channel_key: Some("offline".into()),
                account_key: "cash".into(),
                lines: vec![CreateSaleLineRequest {
                    product_id: seeded.product_id,
                    quantity: Decimal::ONE,
                    unit_price_amount: 12_000,
                    discount_amount: 0,
                }],
            },
        )
        .await
        .unwrap();

    let persisted_version_id: Option<Uuid> =
        sqlx::query_scalar("SELECT recipe_version_id FROM business_sale_lines WHERE sale_id=$1")
            .bind(created.sale.sale.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(persisted_version_id, Some(version_three_id));

    let stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, Decimal::from(4_750));
}
