-- Restore only media fields changed by the paired migration. Other metadata
-- written after the migration is retained.
WITH archived_media AS (
  SELECT
    id,
    metadata->'legacy_reference_media_cleanup' AS previous_state
  FROM content_items
  WHERE metadata
    ->'legacy_reference_media_cleanup'
    ->>'migration'
      = '20260730156000_neutralize_legacy_reference_category_media'
),
restored_media AS (
  SELECT
    archived.id,
    archived.previous_state,
    COALESCE(
      jsonb_object_agg(field.key, field.value->'value')
        FILTER (
          WHERE COALESCE(
            (field.value->>'present')::boolean,
            false
          )
        ),
      '{}'::jsonb
    ) AS metadata_fields
  FROM archived_media AS archived
  CROSS JOIN LATERAL jsonb_each(
    archived.previous_state->'metadata_fields'
  ) AS field
  GROUP BY archived.id, archived.previous_state
)
UPDATE content_items AS item
SET cover_image = restored.previous_state->>'cover_image_column',
    metadata = (
      COALESCE(item.metadata, '{}'::jsonb)
        - 'cover_image'
        - 'image_url'
        - 'image_urls'
        - 'gallery_images'
        - 'media_kind'
        - 'media_is_place_specific'
        - 'image_credit'
        - 'legacy_reference_media_cleanup'
    )
      || restored.metadata_fields,
    updated_at = (
      restored.previous_state->>'updated_at'
    )::timestamptz
FROM restored_media AS restored
WHERE item.id = restored.id
  AND item.cover_image = '/images/placeholders/business-default.svg'
  AND item.metadata->>'media_kind' = 'neutral_reference_placeholder'
  AND COALESCE(item.metadata->>'media_storage', '') <> 'minio'
  AND NOT EXISTS (
    SELECT 1
    FROM public_media_asset_links AS link
    WHERE link.content_id = item.id
      AND link.usage = 'cover'
      AND link.is_active
  );

-- Do not overwrite a licensed photo applied after the cleanup migration.
-- Its current MinIO/link provenance wins; only remove the obsolete rollback
-- marker.
UPDATE content_items
SET metadata = COALESCE(metadata, '{}'::jsonb)
      - 'legacy_reference_media_cleanup'
WHERE metadata
  ->'legacy_reference_media_cleanup'
  ->>'migration'
    = '20260730156000_neutralize_legacy_reference_category_media';
