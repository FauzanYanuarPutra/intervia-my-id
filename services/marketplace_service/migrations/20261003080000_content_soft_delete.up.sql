-- Universal soft-delete lifecycle for listings/content.
-- Keep rows for chat/history/audit references; APIs must exclude deleted rows
-- from active discovery and search.
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL,
  ADD COLUMN IF NOT EXISTS delete_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_deleted_at
  ON content_items (deleted_at);

CREATE INDEX IF NOT EXISTS idx_content_items_owner_deleted_updated
  ON content_items (owner_id, deleted_at, updated_at DESC);
