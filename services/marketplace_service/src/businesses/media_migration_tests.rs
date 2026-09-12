use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn canonical_products_have_typed_image_attributes(pool: PgPool) {
    let columns: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_products'
          AND column_name IN ('image_url', 'image_mime_type', 'image_width', 'image_height')
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(
        columns,
        vec!["image_height", "image_mime_type", "image_url", "image_width"]
    );
}
