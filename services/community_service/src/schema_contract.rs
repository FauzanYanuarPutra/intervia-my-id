use sqlx::PgPool;

// Retained only for migration characterization tests while startup DDL is
// removed. Versioned migrations are the runtime source of schema truth.
#[cfg(test)]
#[allow(dead_code)]
async fn ensure_base_schema(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS forum")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS reel")
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

    let schema_statements = [
        r#"
        CREATE TABLE IF NOT EXISTS events.event_inbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source text NOT NULL,
          event_id text NOT NULL,
          event_type text NOT NULL,
          aggregate_type text NOT NULL,
          aggregate_id text NOT NULL,
          payload jsonb NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          retry_count integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          processed_at timestamptz NULL,
          error_message text NULL,
          received_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (source, event_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS events.event_outbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_type text NOT NULL,
          aggregate_id text NOT NULL,
          event_type text NOT NULL,
          routing_key text NOT NULL,
          payload jsonb NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          retry_count integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          published_at timestamptz NULL,
          error_message text NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_categories (
          id text PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          icon text NOT NULL DEFAULT 'forum',
          color text NOT NULL DEFAULT '#0ea5e9',
          parent_id text NULL,
          position integer NOT NULL DEFAULT 0,
          thread_count integer NOT NULL DEFAULT 0,
          post_count integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_users (
          id text PRIMARY KEY,
          username text NOT NULL UNIQUE,
          name text NOT NULL,
          avatar_url text NOT NULL DEFAULT '/default-avatar.svg',
          title text NOT NULL DEFAULT 'Community Member',
          reputation integer NOT NULL DEFAULT 0,
          base_reputation integer NOT NULL DEFAULT 0,
          badges text [] NOT NULL DEFAULT '{}',
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          identity_synced_at timestamptz NULL,
          deleted_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_tags (
          id text PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          color text NOT NULL DEFAULT '#64748b',
          usage_count integer NOT NULL DEFAULT 0
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_threads (
          id text PRIMARY KEY,
          title text NOT NULL,
          slug text NOT NULL,
          category_id text NOT NULL REFERENCES forum.lajukan_forum_categories(id),
          author_id text NOT NULL REFERENCES forum.lajukan_forum_users(id),
          group_id text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_activity_at timestamptz NOT NULL DEFAULT now(),
          views integer NOT NULL DEFAULT 0,
          reply_count integer NOT NULL DEFAULT 0,
          like_count integer NOT NULL DEFAULT 0,
          bookmark_count integer NOT NULL DEFAULT 0,
          is_pinned boolean NOT NULL DEFAULT false,
          is_locked boolean NOT NULL DEFAULT false,
          is_solved boolean NOT NULL DEFAULT false,
          solution_post_id text NULL,
          status text NOT NULL DEFAULT 'open',
          image_urls text [] NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_thread_tags (
          thread_id text NOT NULL REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE,
          tag_slug text NOT NULL REFERENCES lajukan_forum_tags(slug) ON DELETE CASCADE,
          position integer NOT NULL DEFAULT 0,
          PRIMARY KEY (thread_id, tag_slug)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_posts (
          id text PRIMARY KEY,
          thread_id text NOT NULL REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE,
          author_id text NOT NULL REFERENCES forum.lajukan_forum_users(id),
          content text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NULL,
          like_count integer NOT NULL DEFAULT 0,
          reply_to_post_id text NULL,
          is_answer boolean NOT NULL DEFAULT false,
          reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
          image_urls text [] NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_votes (
          id text PRIMARY KEY,
          target_type text NOT NULL,
          target_id text NOT NULL,
          user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          value integer NOT NULL CHECK (value IN (-1, 1)),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (target_type, target_id, user_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_audit_logs (
          id text PRIMARY KEY,
          action text NOT NULL,
          actor_user_id text NOT NULL,
          target_type text NOT NULL,
          target_id text NOT NULL,
          metadata jsonb NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_groups (
          id text PRIMARY KEY,
          category_id text NOT NULL UNIQUE REFERENCES forum.lajukan_forum_categories(id) ON DELETE CASCADE,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          privacy text NOT NULL DEFAULT 'public',
          posting_permission text NOT NULL DEFAULT 'member',
          membership_permission text NOT NULL DEFAULT 'open',
          avatar_url text NULL,
          cover_url text NULL,
          rules text [] NOT NULL DEFAULT '{}',
          created_by_user_id text NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE SET NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_group_members (
          group_id text NOT NULL REFERENCES lajukan_groups(id) ON DELETE CASCADE,
          user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'member',
          status text NOT NULL DEFAULT 'active',
          notifications_enabled boolean NOT NULL DEFAULT true,
          joined_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (group_id, user_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS reel.lajukan_reels (
          id text PRIMARY KEY,
          creator_user_id text NULL,
          creator text NOT NULL,
          title text NOT NULL,
          caption text NOT NULL,
          tag text NOT NULL,
          product_name text NULL,
          product_price text NULL,
          product_href text NULL,
          video_src text NOT NULL,
          source_url text NOT NULL,
          likes_count bigint NOT NULL DEFAULT 0,
          comments_count bigint NOT NULL DEFAULT 0,
          shares_count bigint NOT NULL DEFAULT 0,
          tone text NOT NULL DEFAULT 'emerald',
          icon_key text NOT NULL DEFAULT 'supplier',
          media_url text NOT NULL,
          media_type text NOT NULL DEFAULT 'video',
          hook text NOT NULL DEFAULT '',
          filter_preset text NOT NULL DEFAULT 'natural',
          capture_mode text NOT NULL DEFAULT 'upload',
          live_status text NOT NULL DEFAULT 'offline',
          live_title text NULL,
          live_scheduled_at timestamptz NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          visibility text NOT NULL DEFAULT 'public' CHECK (
            visibility IN ('public', 'followers', 'private')
          ),
          allow_comments boolean NOT NULL DEFAULT true,
          store_id text NOT NULL DEFAULT '',
          store_slug text NOT NULL DEFAULT '',
          store_name text NOT NULL DEFAULT '',
          store_city text NOT NULL DEFAULT '',
          store_phone text NULL,
          storefront_path text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'published',
          published_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_reel_events (
          id text PRIMARY KEY,
          reel_id text NOT NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          actor_user_id text NULL,
          anon_key_hash text NULL,
          event_type text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    ];

    for statement in schema_statements {
        sqlx::query(statement).execute(db).await?;
    }

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_community_event_inbox_pending
          ON events.event_inbox (status, available_at, received_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_community_event_outbox_pending
          ON events.event_outbox (status, available_at, created_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;

    let alter_statements = [
        "ALTER TABLE forum.lajukan_forum_threads ADD COLUMN IF NOT EXISTS group_id text NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS filter_preset text NOT NULL DEFAULT 'natural'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'upload'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_title text NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_scheduled_at timestamptz NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private'))",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true",
        "ALTER TABLE reel.lajukan_reel_comments ADD COLUMN IF NOT EXISTS author_avatar text NULL",
    ];

    for statement in alter_statements {
        sqlx::query(statement).execute(db).await?;
    }

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reels_visibility_feed_idx
          ON reel.lajukan_reels (visibility, published_at DESC, id)
          WHERE status = 'published'
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reel.lajukan_reel_comments (
          id text PRIMARY KEY,
          reel_id text NOT NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          author_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          author_name text NOT NULL,
          author_avatar_url text NULL,
          author_avatar text NULL,
          body text NOT NULL,
          status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'deleted', 'blocked')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_reel_idx
          ON reel.lajukan_reel_comments (reel_id, status, created_at DESC, id DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_author_idx
          ON reel.lajukan_reel_comments (author_user_id, created_at DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_body_search_idx
          ON reel.lajukan_reel_comments
          USING gin (to_tsvector('simple', coalesce(body, '')))
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE reel.lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS parent_comment_id text NULL REFERENCES reel.lajukan_reel_comments(id) ON DELETE CASCADE
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE reel.lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_parent_idx
          ON reel.lajukan_reel_comments (reel_id, parent_comment_id, status, created_at ASC, id ASC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_reel_user_actions (
          id text PRIMARY KEY,
          reel_id text NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          actor_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          target_user_id text NULL,
          action text NOT NULL CHECK (action IN ('like', 'save', 'follow')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE lajukan_reel_user_actions
          ALTER COLUMN reel_id DROP NOT NULL
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_actions_unique_idx
          ON lajukan_reel_user_actions (reel_id, actor_user_id, action)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_follows_unique_idx
          ON lajukan_reel_user_actions (actor_user_id, target_user_id, action)
          WHERE action = 'follow' AND target_user_id IS NOT NULL
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_user_actions_actor_idx
          ON lajukan_reel_user_actions (actor_user_id, action, updated_at DESC)
        "#,
    )
    .execute(db)
    .await?;

    Ok(())
}

pub(crate) async fn verify_schema_contract(db: &PgPool) -> anyhow::Result<()> {
    let ready: bool = sqlx::query_scalar(
        r#"
        SELECT to_regclass('forum.lajukan_forum_threads') IS NOT NULL
           AND to_regclass('reel.lajukan_reels') IS NOT NULL
           AND to_regclass('events.event_outbox') IS NOT NULL
           AND to_regclass('events.event_inbox') IS NOT NULL
        "#,
    )
    .fetch_one(db)
    .await?;

    if !ready {
        anyhow::bail!("community schema contract is incomplete after migrations");
    }
    Ok(())
}

