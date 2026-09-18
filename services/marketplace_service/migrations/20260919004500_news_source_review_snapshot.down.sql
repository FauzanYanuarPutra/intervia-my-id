DROP INDEX IF EXISTS idx_news_source_review_events_domain_created;

ALTER TABLE news_source_review_events
    DROP CONSTRAINT IF EXISTS news_source_review_events_url_snapshot_required,
    DROP COLUMN IF EXISTS source_domain_snapshot,
    DROP COLUMN IF EXISTS source_url_snapshot;
