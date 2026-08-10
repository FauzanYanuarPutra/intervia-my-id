-- Restore only records archived by the paired migration, using the exact
-- lifecycle state captured for each content item.
WITH archived_references AS (
  SELECT
    id,
    metadata
      ->'consumer_chain_reference_archive'
      ->'previous_state' AS previous_state
  FROM content_items
  WHERE metadata
    ->'consumer_chain_reference_archive'
    ->>'migration'
    = '20260730155500_archive_consumer_chain_references'
)
UPDATE content_items AS item
SET content_status = archived.previous_state->>'content_status',
    listing_status = archived.previous_state->>'listing_status',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      - 'consumer_chain_reference_archive',
    updated_at = (
      archived.previous_state->>'updated_at'
    )::timestamptz
FROM archived_references AS archived
WHERE item.id = archived.id;
