WITH restored AS (
  SELECT
    content_id,
    jsonb_object_agg(archive_key, payload) AS metadata_archive
  FROM internal_audit.content_item_metadata_archives
  GROUP BY content_id
)
UPDATE content_items AS item
SET metadata = COALESCE(item.metadata, '{}'::jsonb) || restored.metadata_archive
FROM restored
WHERE item.id = restored.content_id;

DROP TABLE IF EXISTS internal_audit.content_item_metadata_archives;
DROP SCHEMA IF EXISTS internal_audit;
