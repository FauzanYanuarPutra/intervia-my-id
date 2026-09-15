use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn product_modifier_schema_is_normalized_and_scoped(pool: PgPool) {
    let tables: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('business_product_modifier_groups', 'business_product_modifier_options')
        ORDER BY table_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(
        tables,
        vec![
            "business_product_modifier_groups",
            "business_product_modifier_options",
        ]
    );

    let group_columns: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_product_modifier_groups'
          AND column_name IN (
            'id', 'product_id', 'business_id', 'organization_id', 'name',
            'selection_type', 'is_required', 'min_select', 'max_select',
            'sort_order', 'is_active'
          )
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(group_columns.len(), 11);

    let option_columns: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_product_modifier_options'
          AND column_name IN (
            'id', 'group_id', 'product_id', 'name', 'price_delta_cents',
            'is_default', 'sort_order', 'is_active'
          )
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(option_columns.len(), 8);
}
