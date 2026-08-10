-- Rollback and policy snapshots are operational audit data, not public
-- listing metadata. Preserve them behind a dedicated schema and remove them
-- from content_items so a future broad projection cannot expose old contacts
-- or internal policy decisions.
CREATE SCHEMA IF NOT EXISTS internal_audit;
REVOKE ALL ON SCHEMA internal_audit FROM PUBLIC;

CREATE TABLE IF NOT EXISTS internal_audit.content_item_metadata_archives (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  archive_key text NOT NULL,
  payload jsonb NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, archive_key),
  CONSTRAINT content_item_metadata_archives_key_check CHECK (
    archive_key IN (
      'consumer_chain_reference_archive',
      'legacy_osm_contact_cleanup',
      'legacy_reference_media_cleanup',
      'nonallowlisted_osm_shop_archive',
      'osm_import_policy_archive'
    )
  )
);

REVOKE ALL ON TABLE internal_audit.content_item_metadata_archives FROM PUBLIC;

INSERT INTO internal_audit.content_item_metadata_archives (
  content_id,
  archive_key,
  payload
)
SELECT
  item.id,
  entry.key,
  entry.value
FROM content_items AS item
CROSS JOIN LATERAL jsonb_each(COALESCE(item.metadata, '{}'::jsonb)) AS entry
WHERE entry.key IN (
  'consumer_chain_reference_archive',
  'legacy_osm_contact_cleanup',
  'legacy_reference_media_cleanup',
  'nonallowlisted_osm_shop_archive',
  'osm_import_policy_archive'
)
ON CONFLICT (content_id, archive_key) DO UPDATE
SET payload = EXCLUDED.payload,
    migrated_at = now();

UPDATE content_items
SET metadata = COALESCE(metadata, '{}'::jsonb)
    - 'consumer_chain_reference_archive'
    - 'legacy_osm_contact_cleanup'
    - 'legacy_reference_media_cleanup'
    - 'nonallowlisted_osm_shop_archive'
    - 'osm_import_policy_archive'
WHERE COALESCE(metadata, '{}'::jsonb) ?| ARRAY[
  'consumer_chain_reference_archive',
  'legacy_osm_contact_cleanup',
  'legacy_reference_media_cleanup',
  'nonallowlisted_osm_shop_archive',
  'osm_import_policy_archive'
];
