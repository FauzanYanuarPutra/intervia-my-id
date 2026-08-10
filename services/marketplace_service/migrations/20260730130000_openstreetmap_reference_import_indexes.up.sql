-- Query and idempotency indexes for non-transactional OpenStreetMap references.
-- These rows are discovery references, not seller offers or verified businesses.

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_osm_reference_external_id
  ON content_items (
    (metadata->>'source_dataset'),
    (metadata->>'external_id')
  )
  WHERE metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND content_status <> 'deleted';

CREATE INDEX IF NOT EXISTS idx_content_items_osm_reference_category_updated
  ON content_items (marketplace_category_id, updated_at DESC, id)
  WHERE metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND content_status = 'active';

