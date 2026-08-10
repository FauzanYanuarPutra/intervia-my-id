-- A category illustration must not look like a photograph of a specific
-- public-reference place. Preserve the exact previous media fields for a
-- reversible migration, then switch unmatched references to the neutral
-- no-photo asset.
WITH legacy_reference_media AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730156000_neutralize_legacy_reference_category_media',
      'changed_at', now(),
      'updated_at', updated_at,
      'cover_image_column', to_jsonb(cover_image),
      'metadata_fields', jsonb_build_object(
        'cover_image', jsonb_build_object(
          'present', metadata ? 'cover_image',
          'value', metadata->'cover_image'
        ),
        'image_url', jsonb_build_object(
          'present', metadata ? 'image_url',
          'value', metadata->'image_url'
        ),
        'image_urls', jsonb_build_object(
          'present', metadata ? 'image_urls',
          'value', metadata->'image_urls'
        ),
        'gallery_images', jsonb_build_object(
          'present', metadata ? 'gallery_images',
          'value', metadata->'gallery_images'
        ),
        'media_kind', jsonb_build_object(
          'present', metadata ? 'media_kind',
          'value', metadata->'media_kind'
        ),
        'media_is_place_specific', jsonb_build_object(
          'present', metadata ? 'media_is_place_specific',
          'value', metadata->'media_is_place_specific'
        ),
        'image_credit', jsonb_build_object(
          'present', metadata ? 'image_credit',
          'value', metadata->'image_credit'
        )
      )
    ) AS previous_state
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'is_transactional' = 'false'
    AND (
      metadata->>'market_side' = 'reference'
      OR lower(COALESCE(metadata->>'record_kind', '')) LIKE '%reference%'
    )
    AND metadata->>'media_kind' = 'category_illustration'
    AND COALESCE(metadata->>'media_storage', '') <> 'minio'
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
        ? 'legacy_reference_media_cleanup'
    )
)
UPDATE content_items AS item
SET cover_image = '/images/placeholders/business-default.svg',
    metadata = (
      COALESCE(item.metadata, '{}'::jsonb)
        - 'cover_image'
        - 'image_url'
        - 'image_urls'
        - 'gallery_images'
        - 'media_kind'
        - 'media_is_place_specific'
        - 'image_credit'
    )
      || jsonb_build_object(
        'cover_image', '/images/placeholders/business-default.svg',
        'image_url', '/images/placeholders/business-default.svg',
        'gallery_images', jsonb_build_array(
          '/images/placeholders/business-default.svg'
        ),
        'media_kind', 'neutral_reference_placeholder',
        'media_is_place_specific', false,
        'image_credit', jsonb_build_object(
          'provider', 'Lajukan',
          'title', 'Placeholder referensi usaha',
          'license', 'Lajukan-owned project asset',
          'note', 'Placeholder netral, bukan foto lokasi atau usaha yang tercantum.'
        ),
        'legacy_reference_media_cleanup',
        legacy_reference_media.previous_state
      ),
    updated_at = now()
FROM legacy_reference_media
WHERE item.id = legacy_reference_media.id;
