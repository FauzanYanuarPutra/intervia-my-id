use sqlx::PgPool;

// Retained only for migration characterization tests while startup DDL is
// removed. Versioned migrations are the runtime source of schema truth.
#[cfg(test)]
#[allow(dead_code)]
async fn ensure_base_schema(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query("CREATE EXTENSION IF NOT EXISTS citext")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS events")
        .execute(db)
        .await?;
    Ok(())
}

#[cfg(test)]
#[allow(dead_code)]
async fn ensure_runtime_schema(db: &PgPool) -> anyhow::Result<()> {
    ensure_base_schema(db).await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events.event_outbox (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          routing_key TEXT NOT NULL,
          event_key TEXT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INT NOT NULL DEFAULT 0,
          available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          published_at TIMESTAMPTZ NULL,
          error_message TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events.event_inbox (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source TEXT NOT NULL,
          event_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INT NOT NULL DEFAULT 0,
          available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ NULL,
          error_message TEXT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (source, event_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_event_outbox_pending
          ON events.event_outbox(status, available_at, created_at)
          WHERE status = 'pending'
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_marketplace_event_inbox_pending
          ON events.event_inbox(status, available_at, received_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users_read_model (
          user_id uuid PRIMARY KEY,
          email citext NULL,
          phone text NULL,
          username citext NULL,
          full_name text NULL,
          avatar_url text NULL,
          email_verified boolean NOT NULL DEFAULT false,
          phone_verified boolean NOT NULL DEFAULT false,
          identity_verified boolean NOT NULL DEFAULT false,
          transaction_eligible boolean NOT NULL DEFAULT false,
          status text NOT NULL DEFAULT 'active',
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          identity_version bigint NOT NULL DEFAULT 0,
          identity_updated_at timestamptz NULL,
          identity_deleted_at timestamptz NULL,
          identity_has_email boolean NOT NULL DEFAULT false,
          identity_has_phone boolean NOT NULL DEFAULT false,
          identity_user_email_verified boolean NOT NULL DEFAULT false,
          identity_user_phone_verified boolean NOT NULL DEFAULT false,
          identity_user_active boolean NOT NULL DEFAULT false,
          identity_user_updated_at timestamptz NULL,
          identity_user_event_id uuid NULL,
          identity_user_operation text NULL,
          identity_profile_updated_at timestamptz NULL,
          identity_profile_event_id uuid NULL,
          identity_profile_operation text NULL,
          synced_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        ALTER TABLE users_read_model
          ADD COLUMN IF NOT EXISTS identity_has_email boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_has_phone boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_email_verified boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_phone_verified boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_active boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_updated_at timestamptz NULL,
          ADD COLUMN IF NOT EXISTS identity_user_event_id uuid NULL,
          ADD COLUMN IF NOT EXISTS identity_user_operation text NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_updated_at timestamptz NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_event_id uuid NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_operation text NULL
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_email ON users_read_model (email)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_phone ON users_read_model (phone)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_username ON users_read_model (username)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS content_item_likes (
          content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (content_id, user_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "ALTER TABLE content_item_likes DROP CONSTRAINT IF EXISTS content_item_likes_user_id_fkey",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_item_likes_content_id ON content_item_likes (content_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_item_likes_user_id ON content_item_likes (user_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS umkm_store_gallery_likes (
          store_id uuid NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
          media_key text NOT NULL,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (store_id, media_key, user_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "ALTER TABLE umkm_store_gallery_likes DROP CONSTRAINT IF EXISTS umkm_store_gallery_likes_user_id_fkey",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_id ON umkm_store_gallery_likes (store_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_user_id ON umkm_store_gallery_likes (user_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_media ON umkm_store_gallery_likes (store_id, media_key)",
    )
    .execute(db)
    .await?;
    Ok(())
}

pub(crate) async fn verify_schema_contract(db: &PgPool) -> anyhow::Result<()> {
    let ready: bool = sqlx::query_scalar(
        r#"
        SELECT to_regclass('public.content_items') IS NOT NULL
           AND to_regclass('public.users_read_model') IS NOT NULL
           AND to_regclass('events.event_outbox') IS NOT NULL
           AND to_regclass('events.event_inbox') IS NOT NULL
        "#,
    )
    .fetch_one(db)
    .await?;

    if !ready {
        anyhow::bail!("marketplace schema contract is incomplete after migrations");
    }
    Ok(())
}

