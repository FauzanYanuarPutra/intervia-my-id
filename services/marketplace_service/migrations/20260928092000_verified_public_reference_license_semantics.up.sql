UPDATE content_items
SET metadata = metadata - 'source_license',
    updated_at = NOW()
WHERE metadata->>'source_dataset' = 'verified_public_place_bootstrap'
  AND metadata->>'reference_subtype' = 'place_reference';
