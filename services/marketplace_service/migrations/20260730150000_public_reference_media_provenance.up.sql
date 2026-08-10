-- Licensed media imported for non-transactional public references.
--
-- The source asset and its link to a content item are intentionally separate:
-- one Wikimedia Commons file may be reused by multiple sourced references, and
-- changing a cover must not erase the previous provenance record.

CREATE TABLE IF NOT EXISTS public_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_asset_id text NOT NULL,
  canonical_title text NOT NULL,
  source_page_url text NOT NULL,
  original_url text NOT NULL,
  downloaded_url text NOT NULL,
  author_text text NOT NULL,
  license_key text NOT NULL,
  license_name text NOT NULL,
  license_url text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  width integer NULL,
  height integer NULL,
  sha256 text NOT NULL,
  object_bucket text NOT NULL,
  object_key text NOT NULL,
  public_url text NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_imported_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_media_assets_provider_check
    CHECK (provider = 'wikimedia_commons'),
  CONSTRAINT public_media_assets_license_check
    CHECK (
      license_key = 'cc0-1.0'
      OR license_key = 'public-domain'
      OR license_key ~ '^cc-by-(1\.0|2\.0|2\.5|3\.0|4\.0)$'
      OR license_key ~ '^cc-by-sa-(1\.0|2\.0|2\.5|3\.0|4\.0)$'
    ),
  CONSTRAINT public_media_assets_mime_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT public_media_assets_byte_size_check
    CHECK (byte_size > 0 AND byte_size <= 10485760),
  CONSTRAINT public_media_assets_dimensions_check
    CHECK (
      (width IS NULL AND height IS NULL)
      OR (width > 0 AND height > 0)
    ),
  CONSTRAINT public_media_assets_sha256_check
    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_media_assets_object_key_check
    CHECK (
      object_key ~ '^content/public-reference/[0-9a-f]{2}/[0-9a-f]{64}\.(jpg|png|webp)$'
    ),
  CONSTRAINT public_media_assets_source_metadata_object_check
    CHECK (jsonb_typeof(source_metadata) = 'object'),
  UNIQUE (provider, provider_asset_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_public_media_assets_sha256
  ON public_media_assets (sha256);

CREATE INDEX IF NOT EXISTS idx_public_media_assets_object
  ON public_media_assets (object_bucket, object_key);

CREATE INDEX IF NOT EXISTS idx_public_media_assets_license
  ON public_media_assets (license_key, last_verified_at DESC);

CREATE TABLE IF NOT EXISTS public_media_asset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public_media_assets(id) ON DELETE RESTRICT,
  usage text NOT NULL DEFAULT 'cover',
  match_method text NOT NULL,
  match_confidence numeric(4,3) NOT NULL,
  is_place_specific boolean NOT NULL,
  review_status text NOT NULL,
  reviewed_by text NULL,
  reviewed_at timestamptz NULL,
  review_evidence_url text NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_media_asset_links_usage_check
    CHECK (usage = 'cover'),
  CONSTRAINT public_media_asset_links_match_method_check
    CHECK (
      match_method IN (
        'osm_wikimedia_commons_file',
        'reviewed_wikidata_p18'
      )
    ),
  CONSTRAINT public_media_asset_links_confidence_check
    CHECK (match_confidence >= 0 AND match_confidence <= 1),
  CONSTRAINT public_media_asset_links_review_status_check
    CHECK (review_status IN ('source_exact', 'human_approved')),
  CONSTRAINT public_media_asset_links_human_review_check
    CHECK (
      (
        review_status = 'source_exact'
        AND match_method = 'osm_wikimedia_commons_file'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
      )
      OR (
        review_status = 'human_approved'
        AND match_method = 'reviewed_wikidata_p18'
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND review_evidence_url IS NOT NULL
      )
    ),
  CONSTRAINT public_media_asset_links_provenance_object_check
    CHECK (jsonb_typeof(provenance) = 'object'),
  UNIQUE (content_id, asset_id, usage, match_method)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_media_asset_links_active_usage
  ON public_media_asset_links (content_id, usage)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_public_media_asset_links_asset
  ON public_media_asset_links (asset_id, is_active, content_id);

CREATE INDEX IF NOT EXISTS idx_public_media_asset_links_content_history
  ON public_media_asset_links (content_id, created_at DESC);
