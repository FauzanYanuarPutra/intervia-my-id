use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    control::{ControlRepository, RecipeItemInput, ReplaceRecipeRequest},
    recipes::RecipeRepository,
};

struct RecipeAuditScope {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    product_id: Uuid,
    ingredient_id: Uuid,
}

async fn seed_recipe_audit_scope(pool: &PgPool) -> RecipeAuditScope {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();
    let role_id = Uuid::new_v4();
    let membership_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Recipe Audit Business','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("5".repeat(64))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_roles (
          id, organization_id, business_id, role_key, name, is_system
        ) VALUES ($1,$2,$3,'owner','Owner access',TRUE)
        "#,
    )
    .bind(role_id)
    .bind(organization_id)
    .bind(business_id)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        r#"
        INSERT INTO business_role_permissions (role_id, permission_key)
        VALUES ($1,'recipe.view'), ($1,'recipe.manage')
        "#,
    )
    .bind(role_id)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        r#"
        INSERT INTO business_memberships (
          id, organization_id, business_id, user_id, status
        ) VALUES ($1,$2,$3,$4,'active')
        "#,
    )
    .bind(membership_id)
    .bind(organization_id)
    .bind(business_id)
    .bind(actor_id)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        r#"
        INSERT INTO business_member_roles (
          organization_id, business_id, membership_id, role_id
        ) VALUES ($1,$2,$3,$4)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(membership_id)
    .bind(role_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Audit Product','Minuman','Rp10.000','active','owned')
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
        ) VALUES ($1,$2,$3,'Mangga','ingredient','kg','gram',1000,30000,1,100,0,5000,100,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    RecipeAuditScope {
        actor_id,
        organization_id,
        business_id,
        product_id,
        ingredient_id,
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn versioned_recipe_schema_and_permissions_exist(pool: PgPool) {
    let versions: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.business_recipe_versions')::text")
            .fetch_one(&pool)
            .await
            .unwrap();
    let version_items: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.business_recipe_version_items')::text")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(versions.as_deref(), Some("business_recipe_versions"));
    assert_eq!(
        version_items.as_deref(),
        Some("business_recipe_version_items")
    );

    let permissions: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT permission_key
        FROM business_permissions
        WHERE permission_key IN ('recipe.view', 'recipe.manage')
        ORDER BY permission_key
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(permissions, vec!["recipe.manage", "recipe.view"]);
}

#[sqlx::test(migrations = "./migrations")]
async fn legacy_recipe_is_not_fabricated_into_version_history(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let legacy_recipe_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Legacy Recipe Business','food_beverage','active',$3,$4,$5)
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

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Legacy Product','Minuman','Rp10.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipes (
          id, business_id, organization_id, product_id, name, servings, status, version
        ) VALUES ($1,$2,$3,$4,'Legacy Recipe',1,'active',7)
        "#,
    )
    .bind(legacy_recipe_id)
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .execute(&pool)
    .await
    .unwrap();

    let version_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_recipe_versions WHERE business_id=$1 AND product_id=$2",
    )
    .bind(business_id)
    .bind(product_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(
        version_count, 0,
        "migration/runtime must not invent recipe history"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn published_recipe_bom_rejects_late_item_insert(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let first_ingredient_id = Uuid::new_v4();
    let late_ingredient_id = Uuid::new_v4();
    let version_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Immutable BOM Test','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("3".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Immutable Product','Minuman','Rp10.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(&pool)
    .await
    .unwrap();

    for (ingredient_id, name) in [
        (first_ingredient_id, "Ingredient One"),
        (late_ingredient_id, "Ingredient Late"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO business_ingredients (
              id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
              conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
              waste_percent, stock_quantity, minimum_stock, status
            ) VALUES ($1,$2,$3,$4,'ingredient','kg','g',1000,10000,1,100,0,1000,0,'active')
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(name)
        .execute(&pool)
        .await
        .unwrap();
    }

    // Published BOMs are assembled child-first inside one transaction. The
    // deferred FK validates the aggregate at commit; inserting the parent last
    // seals the BOM against any later item append.
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
    .bind(version_id)
    .bind(first_ingredient_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,1,'Immutable v1',1,'published',NOW() - INTERVAL '1 day',$5,'test publish')
        "#,
    )
    .bind(version_id)
    .bind(organization_id)
    .bind(business_id)
    .bind(product_id)
    .bind(actor_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let late_insert = sqlx::query(
        r#"
        INSERT INTO business_recipe_version_items (
          organization_id, business_id, recipe_version_id, ingredient_id, quantity, position
        ) VALUES ($1,$2,$3,$4,50,1)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(version_id)
    .bind(late_ingredient_id)
    .execute(&pool)
    .await;

    assert!(
        late_insert.is_err(),
        "published BOM must reject ingredients appended after publication"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn published_recipe_requires_nonempty_bom(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let version_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Empty BOM Test','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("4".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_products (
          id, business_id, organization_id, name, category, price_label, status, source_type
        ) VALUES ($1,$2,$3,'Empty BOM Product','Minuman','Rp10.000','active','owned')
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(&pool)
    .await
    .unwrap();

    let empty_publish = sqlx::query(
        r#"
        INSERT INTO business_recipe_versions (
          id, organization_id, business_id, product_id, version_number,
          name, servings, status, effective_from, published_by_user_id, reason
        ) VALUES ($1,$2,$3,$4,1,'Empty BOM v1',1,'published',NOW(),$5,'must fail')
        "#,
    )
    .bind(version_id)
    .bind(organization_id)
    .bind(business_id)
    .bind(product_id)
    .bind(actor_id)
    .execute(&pool)
    .await;

    assert!(
        empty_publish.is_err(),
        "a recipe version cannot be published without immutable BOM items"
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn retiring_active_recipe_records_pic_history_and_preserves_version_evidence(pool: PgPool) {
    let scope = seed_recipe_audit_scope(&pool).await;
    let repository = RecipeRepository::new(pool.clone());

    repository
        .publish_legacy(
            scope.actor_id,
            scope.business_id,
            scope.organization_id,
            scope.product_id,
            ReplaceRecipeRequest {
                name: "Resep audit".to_owned(),
                servings: Decimal::ONE,
                items: vec![RecipeItemInput {
                    ingredient_id: scope.ingredient_id,
                    quantity: Decimal::from(150),
                    waste_percent_override: None,
                }],
            },
        )
        .await
        .unwrap();

    repository
        .retire_active(
            scope.actor_id,
            scope.business_id,
            scope.organization_id,
            scope.product_id,
            "Bahan salah input, resep aktif dinonaktifkan agar tidak saling menyalahkan.",
        )
        .await
        .unwrap();

    let active = ControlRepository::new(pool.clone())
        .get_recipe(scope.business_id, scope.organization_id, scope.product_id)
        .await
        .unwrap();
    assert!(active.is_none(), "retired recipe must not stay active");

    let (status, closed): (String, bool) = sqlx::query_as(
        r#"
        SELECT status, effective_until IS NOT NULL
        FROM business_recipe_versions
        WHERE business_id=$1 AND product_id=$2
        "#,
    )
    .bind(scope.business_id)
    .bind(scope.product_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status, "retired");
    assert!(
        closed,
        "retirement must close the effective evidence window"
    );

    let history = repository
        .list_audit_history(
            scope.actor_id,
            scope.business_id,
            scope.organization_id,
            scope.product_id,
            20,
        )
        .await
        .unwrap();

    assert!(
        history
            .iter()
            .any(|event| event.event_key == "recipe.published"
                && event.actor_user_id == Some(scope.actor_id)),
        "published recipe history must include PIC actor"
    );
    assert!(
        history
            .iter()
            .any(|event| event.event_key == "recipe.retired"
                && event.actor_user_id == Some(scope.actor_id)
                && event
                    .reason
                    .as_deref()
                    .is_some_and(|reason| reason.contains("salah input"))),
        "retired recipe history must include PIC actor and reason"
    );
}
