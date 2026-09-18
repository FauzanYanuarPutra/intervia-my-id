ALTER TABLE news_source_review_events
    ADD COLUMN IF NOT EXISTS source_url_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS source_domain_snapshot TEXT;

UPDATE news_source_review_events AS review
SET
    source_url_snapshot = source.source_url,
    source_domain_snapshot = source.source_domain
FROM news_source_references AS source
WHERE review.source_id = source.id
  AND review.source_url_snapshot IS NULL;

DO $$
BEGIN
  ALTER TABLE news_source_review_events
    ADD CONSTRAINT news_source_review_events_url_snapshot_required
    CHECK (
      source_url_snapshot IS NOT NULL
      AND length(source_url_snapshot) BETWEEN 8 AND 2048
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_news_source_review_events_domain_created
    ON news_source_review_events(source_domain_snapshot, created_at DESC, id DESC)
    WHERE source_domain_snapshot IS NOT NULL;
