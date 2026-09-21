CREATE TABLE IF NOT EXISTS news_source_review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    requested_reviewer_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT news_source_review_requests_status_allowed
      CHECK (status IN ('pending', 'completed', 'cancelled')),
    CONSTRAINT news_source_review_requests_note_length
      CHECK (note IS NULL OR length(note) <= 4000),
    CONSTRAINT news_source_review_requests_reviewer_distinct
      CHECK (requested_by <> requested_reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_news_source_review_requests_content_status
  ON news_source_review_requests(content_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_source_review_requests_reviewer_status
  ON news_source_review_requests(requested_reviewer_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_news_source_review_requests_pending_reviewer
  ON news_source_review_requests(content_id, requested_reviewer_id)
  WHERE status = 'pending';
