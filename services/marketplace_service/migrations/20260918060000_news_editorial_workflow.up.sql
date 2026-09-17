CREATE TABLE IF NOT EXISTS news_editorial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'editor',
    action TEXT NOT NULL CHECK (
        action IN ('approve', 'needs_revision', 'reject', 'retract', 'correct', 'resubmit', 'withdraw')
    ),
    from_status TEXT,
    to_status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_editorial_events_content_created
    ON news_editorial_events (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_news_publication
    ON content_items (
        content_status,
        published_at DESC,
        created_at DESC
    )
    WHERE content_type = 'news'
      AND content_status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_content_items_news_category
    ON content_items ((metadata->'news'->>'category'))
    WHERE content_type = 'news'
      AND content_status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_content_items_news_editorial_status
    ON content_items ((metadata->'news'->>'editorial_status'), updated_at DESC)
    WHERE content_type = 'news'
      AND content_status <> 'deleted';
