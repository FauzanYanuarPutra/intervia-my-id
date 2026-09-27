-- Lajukan Data Provenance + Reference Claim / Ownership kernel.
-- Reference records are discovery data, NOT verified ownership.
-- Imported data must carry a source and an explicit reuse policy.
CREATE TABLE IF NOT EXISTS data_source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT NOT NULL UNIQUE,
    provider_name TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_url TEXT NOT NULL,
    api_url TEXT,
    terms_url TEXT,
    license_name TEXT,
    license_url TEXT,
    attribution_text TEXT,
    reuse_mode TEXT NOT NULL DEFAULT 'review_required'
        CHECK (reuse_mode IN ('persistent_import','live_only','link_only','derived_only','review_required','disabled')),
    storage_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    media_storage_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    pii_import_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    refresh_interval_hours INTEGER,
    last_checked_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_source_registry_enabled
    ON data_source_registry(enabled, reuse_mode);

CREATE TABLE IF NOT EXISTS data_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES data_source_registry(id) ON DELETE RESTRICT,
    job_key TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL DEFAULT 'dry_run'
        CHECK (mode IN ('dry_run','import','refresh','archive')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','running','succeeded','partial','failed','cancelled')),
    requested_by UUID,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    discovered_count INTEGER NOT NULL DEFAULT 0,
    accepted_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    archived_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_import_jobs_source_created
    ON data_import_jobs(source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_import_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES data_import_jobs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_source_registry(id) ON DELETE RESTRICT,
    source_record_id TEXT NOT NULL,
    source_url TEXT,
    source_hash TEXT,
    record_kind TEXT NOT NULL,
    target_content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    license_snapshot TEXT,
    attribution_snapshot TEXT,
    raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (validation_status IN ('pending','accepted','rejected','archived')),
    validation_reason TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_data_import_records_target
    ON data_import_records(target_content_id);

CREATE INDEX IF NOT EXISTS idx_data_import_records_kind_status
    ON data_import_records(record_kind, validation_status);

CREATE TABLE IF NOT EXISTS business_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    claimant_user_id UUID NOT NULL,
    claimant_role TEXT NOT NULL DEFAULT 'owner'
        CHECK (claimant_role IN ('owner','manager','authorized_representative','employee')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','under_review','approved','rejected','withdrawn','expired')),
    claim_message TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    ownership_granted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_claims_content_status
    ON business_claims(content_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_claims_claimant_status
    ON business_claims(claimant_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_claim_pending
    ON business_claims(content_id, claimant_user_id)
    WHERE status IN ('pending','under_review');

CREATE TABLE IF NOT EXISTS business_claim_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES business_claims(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL
        CHECK (evidence_type IN (
            'nib','npwp','business_license','business_certificate',
            'tax_document','brand_ownership','official_domain',
            'official_social_account','utility_bill','storefront_photo',
            'other'
        )),
    storage_key TEXT,
    external_url TEXT,
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT TRUE,
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_claim_evidence_claim
    ON business_claim_evidence(claim_id, created_at);

CREATE TABLE IF NOT EXISTS business_ownership_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    claim_id UUID REFERENCES business_claims(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner','manager','editor')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    granted_by UUID,
    revoke_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_business_owner
    ON business_ownership_grants(content_id, user_id, role)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_ownership_content_active
    ON business_ownership_grants(content_id)
    WHERE revoked_at IS NULL;

-- All externally seeded content must be identifiable as reference/unclaimed
-- until an explicit verified claim grants management access.
CREATE INDEX IF NOT EXISTS idx_content_items_reference_provenance
    ON content_items ((metadata->>'record_kind'), (metadata->>'source_dataset'))
    WHERE metadata->>'record_kind' IN (
        'real_openstreetmap_reference',
        'government_reference',
        'licensed_reference',
        'open_data_reference',
        'external_content_reference'
    );

INSERT INTO data_source_registry (
    source_key, provider_name, source_kind, source_url, terms_url,
    license_name, license_url, attribution_text, reuse_mode,
    storage_allowed, media_storage_allowed, pii_import_allowed, enabled,
    notes
) VALUES
(
    'osm',
    'OpenStreetMap contributors',
    'open_geodata',
    'https://www.openstreetmap.org/',
    'https://www.openstreetmap.org/copyright',
    'Open Database License 1.0',
    'https://opendatacommons.org/licenses/odbl/1-0/',
    '© OpenStreetMap contributors',
    'persistent_import',
    TRUE, TRUE, FALSE, TRUE,
    'Persistent reference import is allowed subject to ODbL attribution/share-alike requirements and current import policy.'
),
(
    'data-go-id',
    'Portal Data Indonesia',
    'government_open_data_catalog',
    'https://data.go.id/',
    'https://data.go.id/',
    NULL, NULL, 'Sumber data wajib dicantumkan per dataset',
    'review_required',
    FALSE, FALSE, FALSE, TRUE,
    'Each dataset must be reviewed individually for its metadata, license, redistribution and personal-data restrictions before persistent import.'
),
(
    'bi-umkm-reference',
    'Bank Indonesia',
    'government_reference',
    'https://www.bi.go.id/id/umkm/database/umkm-layak-dibiayai.aspx',
    'https://www.bi.go.id/',
    NULL, NULL, 'Bank Indonesia',
    'review_required',
    FALSE, FALSE, FALSE, TRUE,
    'Use as a source reference unless redistribution/storage rights for the specific dataset are confirmed.'
),
(
    'google-places',
    'Google Maps Platform',
    'commercial_api',
    'https://developers.google.com/maps/documentation/places/web-service',
    'https://developers.google.com/maps/documentation/places/web-service/policies',
    NULL, NULL, 'Google Maps / required attribution',
    'live_only',
    FALSE, FALSE, FALSE, FALSE,
    'Do not bulk scrape or persist Places content. place_id may be stored; live results must follow current Google policies and attribution requirements.'
),
(
    'wikimedia-commons',
    'Wikimedia Commons contributors',
    'open_media',
    'https://commons.wikimedia.org/',
    'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
    NULL, NULL, 'Per-file author/license attribution',
    'review_required',
    FALSE, FALSE, FALSE, TRUE,
    'License is per file. Only import/store media after the individual file license and attribution requirements pass validation.'
)
ON CONFLICT (source_key) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    source_url = EXCLUDED.source_url,
    terms_url = EXCLUDED.terms_url,
    license_name = EXCLUDED.license_name,
    license_url = EXCLUDED.license_url,
    attribution_text = EXCLUDED.attribution_text,
    reuse_mode = EXCLUDED.reuse_mode,
    storage_allowed = EXCLUDED.storage_allowed,
    media_storage_allowed = EXCLUDED.media_storage_allowed,
    pii_import_allowed = EXCLUDED.pii_import_allowed,
    enabled = EXCLUDED.enabled,
    notes = EXCLUDED.notes,
    updated_at = NOW();
