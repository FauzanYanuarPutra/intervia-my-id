-- Common consumer-retail chains are real map places, but they are not useful
-- seed references for Lajukan's UMKM and B2B discovery catalog. Archive only
-- non-transactional OpenStreetMap references and retain an exact rollback
-- snapshot.
WITH consumer_chain_references AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730155500_archive_consumer_chain_references',
      'archived_at', now(),
      'reason', 'Common consumer-retail chain excluded from the UMKM/B2B public-reference catalog.',
      'previous_state', jsonb_build_object(
        'content_status', content_status,
        'listing_status', listing_status,
        'updated_at', updated_at
      )
    ) AS archive_state
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND metadata->>'is_transactional' = 'false'
    AND btrim(title) ~* '^(indomaret|alfamart|alfamidi|circle[[:space:]]*k|super[[:space:]]*indo|lawson|transmart|hypermart|familymart|farmers[[:space:]]*market|ranch[[:space:]]*market|lotte[[:space:]]*mart)([[:space:]-]|$)'
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
        ? 'consumer_chain_reference_archive'
    )
)
UPDATE content_items AS item
SET content_status = 'archived',
    listing_status = 'archived',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'consumer_chain_reference_archive',
        consumer_chain_references.archive_state
      ),
    updated_at = now()
FROM consumer_chain_references
WHERE item.id = consumer_chain_references.id;
