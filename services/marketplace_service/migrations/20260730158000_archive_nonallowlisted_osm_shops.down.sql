WITH archived_shops AS (
  SELECT
    id,
    metadata
      ->'nonallowlisted_osm_shop_archive'
      ->'previous_state' AS previous_state
  FROM content_items
  WHERE metadata
    ->'nonallowlisted_osm_shop_archive'
    ->>'migration'
      = '20260730158000_archive_nonallowlisted_osm_shops'
)
UPDATE content_items AS item
SET content_status = archived.previous_state->>'content_status',
    listing_status = archived.previous_state->>'listing_status',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      - 'nonallowlisted_osm_shop_archive',
    updated_at = (
      archived.previous_state->>'updated_at'
    )::timestamptz
FROM archived_shops AS archived
WHERE item.id = archived.id;
