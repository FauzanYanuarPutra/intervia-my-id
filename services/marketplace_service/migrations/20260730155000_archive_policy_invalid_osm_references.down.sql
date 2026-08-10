WITH archived_references AS (
  SELECT
    id,
    metadata->'osm_import_policy_archive'->'previous_state' AS previous_state
  FROM content_items
  WHERE metadata->'osm_import_policy_archive'->>'migration'
    = '20260730155000_archive_policy_invalid_osm_references'
)
UPDATE content_items AS item
SET content_status = archived.previous_state->>'content_status',
    listing_status = archived.previous_state->>'listing_status',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      - 'osm_import_policy_archive',
    updated_at = (
      archived.previous_state->>'updated_at'
    )::timestamptz
FROM archived_references AS archived
WHERE item.id = archived.id;
