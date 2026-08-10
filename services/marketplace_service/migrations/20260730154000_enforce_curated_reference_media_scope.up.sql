-- Curated open-data media is contextual. It must never be represented as a
-- place-specific photo of a currently active or registered business.
ALTER TABLE public_media_asset_links
  ADD CONSTRAINT public_media_asset_links_curated_scope_check
  CHECK (
    match_method <> 'curated_wikimedia_commons_file'
    OR (
      is_place_specific = FALSE
      AND review_status = 'source_exact'
    )
  );
