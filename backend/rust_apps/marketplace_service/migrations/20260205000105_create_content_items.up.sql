CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL, 
    content_type TEXT NOT NULL, 
    slug TEXT UNIQUE, 
    title TEXT NOT NULL,
    summary TEXT, 
    body TEXT NOT NULL,
    price_cents BIGINT, 
    currency TEXT DEFAULT 'IDR', 
    tags TEXT[], 
    cover_image TEXT, 
    category TEXT,
    content_status TEXT NOT NULL DEFAULT 'active', 
    rating REAL DEFAULT 0,          -- Tambahkan ini
    review_count INT DEFAULT 0,     -- Tambahkan ini
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce(summary, ''))
    ) STORED
);
CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(content_status);
CREATE INDEX IF NOT EXISTS idx_content_owner ON content_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_search ON content_items USING GIN(search_vector);