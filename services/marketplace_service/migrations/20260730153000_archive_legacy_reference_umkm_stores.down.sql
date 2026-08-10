-- Restore only rows archived by the paired up migration. Values come from
-- the captured state so rollback remains correct when a row previously had a
-- non-default combination of storefront flags.
WITH archived_reference_stores AS (
  SELECT
    id,
    metadata->'legacy_reference_store_archive'->'previous_state' AS previous_state
  FROM umkm_stores
  WHERE metadata->'legacy_reference_store_archive'->>'migration'
    = '20260730153000_archive_legacy_reference_umkm_stores'
)
UPDATE umkm_stores AS store
SET is_active = CASE
      WHEN archived.previous_state->>'is_active' = 'true' THEN TRUE
      ELSE FALSE
    END,
    online_order_enabled = CASE
      WHEN archived.previous_state->>'online_order_enabled' = 'true' THEN TRUE
      ELSE FALSE
    END,
    offline_order_enabled = CASE
      WHEN archived.previous_state->>'offline_order_enabled' = 'true' THEN TRUE
      ELSE FALSE
    END,
    metadata = COALESCE(store.metadata, '{}'::jsonb)
      - 'legacy_reference_store_archive',
    updated_at = (
      archived.previous_state->>'updated_at'
    )::timestamptz
FROM archived_reference_stores AS archived
WHERE store.id = archived.id;
