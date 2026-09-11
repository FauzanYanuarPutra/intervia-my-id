use sqlx::PgPool;
use uuid::Uuid;

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

    assert_eq!(version_count, 0, "migration/runtime must not invent recipe history");
}
