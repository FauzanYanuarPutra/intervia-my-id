-- Public/open-data references are discovery records, not transactional UMKM
-- storefronts. Older seed data inserted five such references into umkm_stores
-- with is_active = TRUE, which allowed legacy store queries to surface them as
-- if they were registered businesses.
--
-- Keep a per-row state snapshot so the paired down migration restores the
-- exact three storefront flags instead of assuming their prior values.
WITH reference_stores AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730153000_archive_legacy_reference_umkm_stores',
      'archived_at', NOW(),
      'reason', 'Public references belong to the non-transactional reference catalog, not the UMKM storefront catalog.',
      'previous_state', jsonb_build_object(
        'is_active', is_active,
        'online_order_enabled', online_order_enabled,
        'offline_order_enabled', offline_order_enabled,
        'updated_at', updated_at
      )
    ) AS archive_state
  FROM umkm_stores
  WHERE (
      is_active
      OR online_order_enabled
      OR offline_order_enabled
    )
    AND lower(btrim(COALESCE(metadata->>'is_transactional', ''))) = 'false'
    AND (
      lower(btrim(COALESCE(metadata->>'record_kind', ''))) LIKE '%reference%'
      OR lower(btrim(COALESCE(metadata->>'market_side', ''))) = 'reference'
    )
    AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'legacy_reference_store_archive')
)
UPDATE umkm_stores AS store
SET is_active = FALSE,
    online_order_enabled = FALSE,
    offline_order_enabled = FALSE,
    metadata = COALESCE(store.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'legacy_reference_store_archive',
        reference_stores.archive_state
      ),
    updated_at = NOW()
FROM reference_stores
WHERE store.id = reference_stores.id;
