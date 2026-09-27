-- Only restore NOT NULL after all reference rows have been migrated to
-- verified owners. This migration intentionally does not delete reference data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM content_items WHERE owner_id IS NULL
  ) THEN
    ALTER TABLE content_items ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;
