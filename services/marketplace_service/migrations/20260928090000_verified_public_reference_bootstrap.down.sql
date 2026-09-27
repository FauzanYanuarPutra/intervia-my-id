DELETE FROM content_items
WHERE metadata->>'source_dataset' = 'verified_public_place_bootstrap';
