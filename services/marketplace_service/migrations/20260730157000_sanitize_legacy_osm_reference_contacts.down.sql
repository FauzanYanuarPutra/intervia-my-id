WITH sanitized_references AS (
  SELECT
    id,
    metadata->'legacy_osm_contact_cleanup' AS previous_state
  FROM content_items
  WHERE metadata
    ->'legacy_osm_contact_cleanup'
    ->>'migration'
      = '20260730157000_sanitize_legacy_osm_reference_contacts'
),
restored_fields AS (
  SELECT
    sanitized.id,
    sanitized.previous_state,
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
  FROM sanitized_references AS sanitized
  CROSS JOIN LATERAL jsonb_each(
    sanitized.previous_state->'metadata_fields'
  ) AS field
  GROUP BY sanitized.id, sanitized.previous_state
)
UPDATE content_items AS item
SET summary = restored.previous_state->>'summary',
    body = restored.previous_state->>'body',
    attributes = restored.previous_state->'attributes',
    contact_snapshot = restored.previous_state->'contact_snapshot',
    metadata = (
      COALESCE(item.metadata, '{}'::jsonb)
        - 'address'
        - 'brand'
        - 'operator'
        - 'source_description'
        - 'contact_policy'
        - 'phone'
        - 'email'
        - 'whatsapp'
        - 'contact'
        - 'website'
        - 'official_website'
        - 'legacy_osm_contact_cleanup'
    )
      || restored.metadata_fields,
    updated_at = (
      restored.previous_state->>'updated_at'
    )::timestamptz
FROM restored_fields AS restored
WHERE item.id = restored.id;

WITH archived_titles AS (
  SELECT
    id,
    metadata
      ->'legacy_osm_contact_title_archive'
      ->'previous_state' AS previous_state
  FROM content_items
  WHERE metadata
    ->'legacy_osm_contact_title_archive'
    ->>'migration'
      = '20260730157000_sanitize_legacy_osm_reference_contacts'
)
UPDATE content_items AS item
SET content_status = archived.previous_state->>'content_status',
    listing_status = archived.previous_state->>'listing_status',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      - 'legacy_osm_contact_title_archive',
    updated_at = (
      archived.previous_state->>'updated_at'
    )::timestamptz
FROM archived_titles AS archived
WHERE item.id = archived.id;
