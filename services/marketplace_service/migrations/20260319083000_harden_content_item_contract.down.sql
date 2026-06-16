DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_content_type_allowed;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_content_status_allowed;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_metadata_object;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

SELECT 1;
