DROP INDEX IF EXISTS idx_content_items_owner_deleted_updated;
DROP INDEX IF EXISTS idx_content_items_deleted_at;

ALTER TABLE content_items
  DROP COLUMN IF EXISTS delete_reason,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_at;
