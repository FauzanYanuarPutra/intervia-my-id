UPDATE content_items
SET cover_image = CASE metadata->>'source_dataset'
  WHEN 'verified_public_place_bootstrap' THEN metadata->>'image_url'
  ELSE cover_image
END,
updated_at = NOW()
WHERE metadata->>'source_dataset' = 'verified_public_place_bootstrap'
  AND (cover_image IS NULL OR cover_image = '');
