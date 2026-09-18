CREATE TABLE IF NOT EXISTS news_source_review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    source_id UUID REFERENCES news_source_references(id) ON DELETE SET NULL,
    reviewer_id UUID NOT NULL,
    from_source_kind TEXT NOT NULL,
    to_source_kind TEXT NOT NULL,
    from_verification_status TEXT NOT NULL,
    to_verification_status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT news_source_review_events_from_kind_allowed
      CHECK (from_source_kind IN ('user_supplied', 'primary', 'secondary', 'official', 'business')),
    CONSTRAINT news_source_review_events_to_kind_allowed
      CHECK (to_source_kind IN ('user_supplied', 'primary', 'secondary', 'official', 'business')),
    CONSTRAINT news_source_review_events_from_status_allowed
      CHECK (from_verification_status IN ('unverified', 'verified', 'broken', 'rejected')),
    CONSTRAINT news_source_review_events_to_status_allowed
      CHECK (to_verification_status IN ('unverified', 'verified', 'broken', 'rejected')),
    CONSTRAINT news_source_review_events_note_length
      CHECK (note IS NULL OR length(note) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_news_source_review_events_content_created
    ON news_source_review_events(content_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_news_source_review_events_source_created
    ON news_source_review_events(source_id, created_at DESC, id DESC)
    WHERE source_id IS NOT NULL;
