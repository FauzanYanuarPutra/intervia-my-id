DROP INDEX IF EXISTS events.idx_event_log_news_engagement;
DROP INDEX IF EXISTS idx_content_items_news_cursor;

DO $$
BEGIN
  ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS chk_user_notifications_category;
  ALTER TABLE user_notifications
    ADD CONSTRAINT chk_user_notifications_category
    CHECK (category IN ('system', 'transaction', 'wallet', 'support', 'security', 'social'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE news_editorial_events
  DROP CONSTRAINT IF EXISTS news_editorial_events_metadata_object;
ALTER TABLE news_editorial_events
  DROP COLUMN IF EXISTS metadata;

DROP INDEX IF EXISTS idx_news_source_references_domain_status;
DROP INDEX IF EXISTS idx_news_source_references_content_position;
DROP TABLE IF EXISTS news_source_references;

DROP INDEX IF EXISTS idx_news_article_versions_content_created;
DROP INDEX IF EXISTS idx_news_article_versions_content_version;
DROP TABLE IF EXISTS news_article_versions;
