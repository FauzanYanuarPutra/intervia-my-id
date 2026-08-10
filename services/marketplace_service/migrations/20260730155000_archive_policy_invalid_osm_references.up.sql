-- Archive only active OpenStreetMap references that violate the current
-- deterministic import policy. This is not a stale/source-missing decision.
-- Rows paused, archived, deleted, or managed outside the OSM reference catalog
-- are never touched.
WITH invalid_references AS (
  SELECT
    id,
    listing_status,
    updated_at,
    CASE
      WHEN lower(btrim(COALESCE(metadata->>'osm_primary_key', ''))) = 'office'
        AND lower(btrim(COALESCE(metadata->>'osm_primary_value', ''))) NOT IN (
          'accountant',
          'accounting',
          'advertising_agency',
          'architect',
          'company',
          'consulting',
          'coworking',
          'employment_agency',
          'estate_agent',
          'financial',
          'insurance',
          'it',
          'lawyer',
          'logistics',
          'notary',
          'property_management',
          'research',
          'tax_advisor',
          'telecommunication',
          'travel_agent',
          'web_design'
        )
        THEN 'office_category_not_allowed'
      WHEN lower(btrim(COALESCE(metadata->>'osm_primary_key', ''))) = 'shop'
        AND lower(btrim(COALESCE(metadata->>'osm_primary_value', ''))) IN (
          'alcohol',
          'bookmaker',
          'cannabis',
          'closed',
          'e-cigarette',
          'erotic',
          'lottery',
          'no',
          'tobacco',
          'vacant',
          'weapons'
        )
        THEN 'shop_category_not_allowed'
      ELSE 'unsafe_reference_name'
    END AS archive_reason
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'osm_import_policy_archive')
    AND (
      lower(btrim(COALESCE(metadata->>'osm_primary_key', ''))) = 'office'
      AND lower(btrim(COALESCE(metadata->>'osm_primary_value', ''))) NOT IN (
        'accountant',
        'accounting',
        'advertising_agency',
        'architect',
        'company',
        'consulting',
        'coworking',
        'employment_agency',
        'estate_agent',
        'financial',
        'insurance',
        'it',
        'lawyer',
        'logistics',
        'notary',
        'property_management',
        'research',
        'tax_advisor',
        'telecommunication',
        'travel_agent',
        'web_design'
      )
      OR (
        lower(btrim(COALESCE(metadata->>'osm_primary_key', ''))) = 'shop'
        AND lower(btrim(COALESCE(metadata->>'osm_primary_value', ''))) IN (
          'alcohol',
          'bookmaker',
          'cannabis',
          'closed',
          'e-cigarette',
          'erotic',
          'lottery',
          'no',
          'tobacco',
          'vacant',
          'weapons'
        )
      )
      OR btrim(title) ~* '^(yes|no|unknown|unnamed|test)$'
      OR btrim(title) ~* '^(https?://|www\.)'
      OR btrim(title) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
      OR btrim(title)
        ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
    )
)
UPDATE content_items AS item
SET content_status = 'archived',
    listing_status = 'archived',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'osm_import_policy_archive',
        jsonb_build_object(
          'migration', '20260730155000_archive_policy_invalid_osm_references',
          'policy_version', 'osm-reference-v2',
          'reason', invalid.archive_reason,
          'archived_at', NOW(),
          'previous_state', jsonb_build_object(
            'content_status', item.content_status,
            'listing_status', invalid.listing_status,
            'updated_at', invalid.updated_at
          )
        )
      ),
    updated_at = NOW()
FROM invalid_references AS invalid
WHERE item.id = invalid.id;
