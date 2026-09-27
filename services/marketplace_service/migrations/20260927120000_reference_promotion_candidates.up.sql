CREATE TABLE IF NOT EXISTS reference_promotion_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES data_import_entities(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_source_registry(id) ON DELETE RESTRICT,
    proposed_content_id UUID,
    promotion_status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (promotion_status IN ('pending_review','approved','rejected','promoted','blocked')),
    readiness_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    blocking_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    provenance_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_reference_promotion_candidates_status
    ON reference_promotion_candidates(promotion_status, readiness_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reference_promotion_candidates_source
    ON reference_promotion_candidates(source_id, promotion_status);
