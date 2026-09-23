CREATE TABLE IF NOT EXISTS blog_editorial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'editor',
    action TEXT NOT NULL CHECK (action IN ('auto_publish','submit_review','resubmit','approve','needs_revision','reject','retract','correct','withdraw')),
    from_status TEXT,
    to_status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_editorial_events_content_created
    ON blog_editorial_events (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_blog_editorial_status
    ON content_items ((metadata->'blog'->>'editorial_status'), updated_at DESC)
    WHERE content_type = 'article' AND content_status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_content_items_blog_language_publication
    ON content_items ((metadata->'blog'->>'language'), published_at DESC, updated_at DESC)
    WHERE content_type = 'article' AND content_status = 'active';