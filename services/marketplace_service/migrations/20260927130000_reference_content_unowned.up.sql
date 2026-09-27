-- Reference content is intentionally unowned until a business claim is
-- reviewed and approved. Existing transactional/user-created content keeps
-- its owner values unchanged.
ALTER TABLE content_items
  ALTER COLUMN owner_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_items_reference_source_external
  ON content_items (
    (metadata->>'source_dataset'),
    (metadata->>'external_id')
  )
  WHERE content_status <> 'deleted'
    AND metadata->>'reference_publication_status' = 'published'
    AND metadata->>'record_kind' IN (
      'government_reference',
      'open_data_reference',
      'licensed_reference',
      'external_content_reference',
      'real_openstreetmap_reference'
    );
