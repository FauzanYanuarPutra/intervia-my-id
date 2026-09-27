-- Normalized staging + entity-resolution layer.
-- Never publishes a business automatically.
CREATE TABLE IF NOT EXISTS data_import_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES data_source_registry(id) ON DELETE RESTRICT,
    canonical_key TEXT NOT NULL,
    normalized_name TEXT,
    normalized_address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    category TEXT,
    source_record_count INTEGER NOT NULL DEFAULT 0,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    resolution_status TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (resolution_status IN ('new','same_entity','possible_duplicate','distinct_entity','needs_review')),
    canonical_record_id UUID REFERENCES data_import_records(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, canonical_key)
);

CREATE INDEX IF NOT EXISTS idx_data_import_entities_lookup
    ON data_import_entities(normalized_name, city, province);

CREATE INDEX IF NOT EXISTS idx_data_import_entities_location
    ON data_import_entities(latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS data_import_entity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES data_import_entities(id) ON DELETE CASCADE,
    candidate_entity_id UUID NOT NULL REFERENCES data_import_entities(id) ON DELETE CASCADE,
    name_similarity DOUBLE PRECISION NOT NULL DEFAULT 0,
    address_similarity DOUBLE PRECISION NOT NULL DEFAULT 0,
    geo_similarity DOUBLE PRECISION NOT NULL DEFAULT 0,
    combined_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    decision TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (decision IN ('same_entity','possible_duplicate','distinct_entity','needs_review')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entity_id, candidate_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_data_import_entity_matches_candidate
    ON data_import_entity_matches(candidate_entity_id, combined_score DESC);
