DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_content_type_allowed;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items
    ADD CONSTRAINT chk_content_items_content_type_allowed
    CHECK (
      content_type IN (
        'product',
        'service',
        'job',
        'property',
        'guide',
        'project',
        'material',
        'tool_rental',
        'talent',
        'profile',
        'freelancer',
        'request',
        'news',
        'article',
        'image',
        'user'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT 1;
