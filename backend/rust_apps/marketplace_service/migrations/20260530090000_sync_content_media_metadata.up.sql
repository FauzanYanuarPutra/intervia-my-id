-- Keep media discoverable through both the typed column and metadata.
-- This does not invent images; it only mirrors URLs already saved in content_items.cover_image.

UPDATE content_items
SET
  metadata = jsonb_strip_nulls(
    COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cover_image', NULLIF(trim(cover_image), ''),
      'image_urls', jsonb_build_array(NULLIF(trim(cover_image), ''))
    )
  ),
  updated_at = NOW()
WHERE NULLIF(trim(cover_image), '') IS NOT NULL
  AND (
    metadata IS NULL
    OR NOT (metadata ? 'image_urls')
    OR jsonb_typeof(metadata -> 'image_urls') <> 'array'
    OR CASE
      WHEN jsonb_typeof(metadata -> 'image_urls') = 'array'
        THEN jsonb_array_length(metadata -> 'image_urls') = 0
      ELSE TRUE
    END
    OR COALESCE(metadata ->> 'cover_image', '') = ''
  );
