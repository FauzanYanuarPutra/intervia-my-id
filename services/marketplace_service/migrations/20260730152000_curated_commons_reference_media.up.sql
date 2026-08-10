-- Allow an exact Wikimedia Commons file that is already attached to a curated,
-- non-transactional public reference to be rehosted with full provenance.
--
-- This method is intentionally not place-specific: the image supplies visual
-- context for the public reference and does not prove that a business is
-- active, registered, contactable, or verified by Lajukan.

ALTER TABLE public_media_asset_links
  DROP CONSTRAINT public_media_asset_links_match_method_check;

ALTER TABLE public_media_asset_links
  ADD CONSTRAINT public_media_asset_links_match_method_check
  CHECK (
    match_method IN (
      'osm_wikimedia_commons_file',
      'curated_wikimedia_commons_file',
      'reviewed_wikidata_p18'
    )
  );

ALTER TABLE public_media_asset_links
  DROP CONSTRAINT public_media_asset_links_human_review_check;

ALTER TABLE public_media_asset_links
  ADD CONSTRAINT public_media_asset_links_human_review_check
  CHECK (
    (
      review_status = 'source_exact'
      AND match_method IN (
        'osm_wikimedia_commons_file',
        'curated_wikimedia_commons_file'
      )
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
    )
    OR (
      review_status = 'human_approved'
      AND match_method = 'reviewed_wikidata_p18'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND review_evidence_url IS NOT NULL
    )
  );
