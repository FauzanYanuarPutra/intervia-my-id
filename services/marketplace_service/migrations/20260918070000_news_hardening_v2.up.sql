-- Lajukan News hardening: durable versions, source provenance, newsroom notifications.
-- Additive only. Existing news workflow migration remains immutable.

CREATE TABLE IF NOT EXISTS news_article_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version_number BIGINT NOT NULL,
    actor_id UUID,
    actor_role TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    editorial_status TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT NOT NULL,
    tags TEXT[],
    cover_image TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_status TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT news_article_versions_metadata_object
      CHECK (jsonb_typeof(metadata) = 'object'),
    CONSTRAINT news_article_versions_actor_role_allowed
      CHECK (actor_role IN ('contributor', 'editor', 'system'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_article_versions_content_version
    ON news_article_versions(content_id, version_number);

CREATE INDEX IF NOT EXISTS idx_news_article_versions_content_created
    ON news_article_versions(content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS news_source_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    source_url TEXT NOT NULL,
    source_domain TEXT,
    source_kind TEXT NOT NULL DEFAULT 'user_supplied',
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    editor_note TEXT,
    checked_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT news_source_references_kind_allowed
      CHECK (source_kind IN ('user_supplied', 'primary', 'secondary', 'official', 'business')),
    CONSTRAINT news_source_references_verification_allowed
      CHECK (verification_status IN ('unverified', 'verified', 'broken', 'rejected')),
    CONSTRAINT news_source_references_url_length
      CHECK (length(source_url) BETWEEN 8 AND 2048),
    UNIQUE(content_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_news_source_references_content_position
    ON news_source_references(content_id, position, id);

CREATE INDEX IF NOT EXISTS idx_news_source_references_domain_status
    ON news_source_references(source_domain, verification_status)
    WHERE source_domain IS NOT NULL;

ALTER TABLE news_editorial_events
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE news_editorial_events
    ADD CONSTRAINT news_editorial_events_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_notifications
    DROP CONSTRAINT IF EXISTS chk_user_notifications_category;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_notifications
    ADD CONSTRAINT chk_user_notifications_category
    CHECK (category IN ('system', 'transaction', 'wallet', 'support', 'security', 'social', 'news'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_items_news_cursor
    ON content_items (
      COALESCE(published_at, created_at) DESC,
      id DESC
    )
    WHERE content_type = 'news'
      AND content_status = 'active';

CREATE INDEX IF NOT EXISTS idx_event_log_news_engagement
    ON events.event_log(event_name, entity_id, occurred_at DESC)
    WHERE entity_type = 'news'
      AND event_name IN (
        'news.opened',
        'news.read_25',
        'news.read_50',
        'news.read_75',
        'news.read_100',
        'news.source_clicked',
        'news.related_clicked'
      );
