CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    listing_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    -- Seed Job/Property pakai 'description', bukan 'body'
    price_amount BIGINT,
    -- Seed Job/Property pakai 'price_amount', bukan 'price_cents'
    price_currency TEXT DEFAULT 'IDR',
    location_city TEXT,
    location_country TEXT,
    category TEXT,
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'simple',
            coalesce(title, '') || ' ' || coalesce(description, '')
        )
    ) STORED
);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING GIN(search_vector);