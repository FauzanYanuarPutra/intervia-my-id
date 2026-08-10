-- OSM may contain contact text inside free-form names, addresses, operators, or
-- descriptions. Public references must not publish private phone/email data.
-- Archive the rare unsafe-title case; sanitize other legacy mirrors while
-- preserving an exact rollback snapshot.
WITH unsafe_titles AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730157000_sanitize_legacy_osm_reference_contacts',
      'archived_at', now(),
      'reason', 'Reference title contains a phone number or email address.',
      'previous_state', jsonb_build_object(
        'content_status', content_status,
        'listing_status', listing_status,
        'updated_at', updated_at
      )
    ) AS archive_state
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND (
      title ~* '@[a-z0-9.-]+\.[a-z]{2,}'
      OR title
        ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
    )
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
        ? 'legacy_osm_contact_title_archive'
    )
)
UPDATE content_items AS item
SET content_status = 'archived',
    listing_status = 'archived',
    metadata = COALESCE(item.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'legacy_osm_contact_title_archive',
        unsafe_titles.archive_state
      ),
    updated_at = now()
FROM unsafe_titles
WHERE item.id = unsafe_titles.id;

WITH unsafe_contact_fields AS (
  SELECT
    id,
    jsonb_build_object(
      'migration', '20260730157000_sanitize_legacy_osm_reference_contacts',
      'sanitized_at', now(),
      'updated_at', updated_at,
      'summary', to_jsonb(summary),
      'body', to_jsonb(body),
      'attributes', attributes,
      'contact_snapshot', contact_snapshot,
      'metadata_fields', jsonb_build_object(
        'address', jsonb_build_object(
          'present', metadata ? 'address',
          'value', metadata->'address'
        ),
        'brand', jsonb_build_object(
          'present', metadata ? 'brand',
          'value', metadata->'brand'
        ),
        'operator', jsonb_build_object(
          'present', metadata ? 'operator',
          'value', metadata->'operator'
        ),
        'source_description', jsonb_build_object(
          'present', metadata ? 'source_description',
          'value', metadata->'source_description'
        ),
        'contact_policy', jsonb_build_object(
          'present', metadata ? 'contact_policy',
          'value', metadata->'contact_policy'
        ),
        'phone', jsonb_build_object(
          'present', metadata ? 'phone',
          'value', metadata->'phone'
        ),
        'email', jsonb_build_object(
          'present', metadata ? 'email',
          'value', metadata->'email'
        ),
        'whatsapp', jsonb_build_object(
          'present', metadata ? 'whatsapp',
          'value', metadata->'whatsapp'
        ),
        'contact', jsonb_build_object(
          'present', metadata ? 'contact',
          'value', metadata->'contact'
        ),
        'website', jsonb_build_object(
          'present', metadata ? 'website',
          'value', metadata->'website'
        ),
        'official_website', jsonb_build_object(
          'present', metadata ? 'official_website',
          'value', metadata->'official_website'
        )
      )
    ) AS previous_state
  FROM content_items
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND (
      concat_ws(
        ' ',
        summary,
        body,
        metadata->>'address',
        metadata->>'brand',
        metadata->>'operator',
        metadata->>'source_description'
      ) ~* '@[a-z0-9.-]+\.[a-z]{2,}'
      OR concat_ws(
        ' ',
        summary,
        body,
        metadata->>'address',
        metadata->>'brand',
        metadata->>'operator',
        metadata->>'source_description'
      ) ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      OR metadata ?| ARRAY[
        'phone',
        'email',
        'whatsapp',
        'contact',
        'website',
        'official_website'
      ]
      OR attributes ?| ARRAY[
        'phone',
        'email',
        'whatsapp',
        'contact',
        'website'
      ]
      OR contact_snapshot ?| ARRAY[
        'phone',
        'email',
        'whatsapp',
        'contact',
        'website'
      ]
    )
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
        ? 'legacy_osm_contact_cleanup'
    )
),
sanitized AS (
  SELECT
    item.*,
    unsafe.previous_state,
    COALESCE(
      NULLIF(item.metadata->>'city', ''),
      NULLIF(item.metadata->>'location', ''),
      'Indonesia'
    ) AS safe_address
  FROM content_items AS item
  JOIN unsafe_contact_fields AS unsafe ON unsafe.id = item.id
)
UPDATE content_items AS item
SET summary = CASE
      WHEN concat_ws(' ', sanitized.summary)
        ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR concat_ws(' ', sanitized.summary)
          ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN 'Referensi lokasi usaha bernama di '
        || sanitized.safe_address
        || ' dari OpenStreetMap.'
      ELSE sanitized.summary
    END,
    body = CASE
      WHEN sanitized.body ~* '@[a-z0-9.-]+\.[a-z]{2,}'
        OR sanitized.body
          ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
      THEN sanitized.title
        || ' tercatat sebagai '
        || COALESCE(sanitized.metadata->>'osm_primary_key', 'lokasi')
        || '='
        || COALESCE(sanitized.metadata->>'osm_primary_value', 'usaha')
        || ' di OpenStreetMap. Periksa sumber untuk perubahan terbaru. '
        || 'Data ini bukan penawaran, stok, harga, atau bukti verifikasi Lajukan.'
      ELSE sanitized.body
    END,
    attributes = (
      COALESCE(sanitized.attributes, '{}'::jsonb)
        - 'phone'
        - 'email'
        - 'whatsapp'
        - 'contact'
        - 'website'
    ),
    contact_snapshot = jsonb_build_object(
      'source_only', true,
      'contact_policy', 'no_private_contact_seeded',
      'official_source_url', sanitized.metadata->>'source_url'
    ),
    metadata = (
      COALESCE(sanitized.metadata, '{}'::jsonb)
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
    )
      || jsonb_strip_nulls(jsonb_build_object(
        'address', CASE
          WHEN COALESCE(sanitized.metadata->>'address', '')
            ~* '@[a-z0-9.-]+\.[a-z]{2,}'
            OR COALESCE(sanitized.metadata->>'address', '')
              ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
          THEN to_jsonb(sanitized.safe_address)
          ELSE sanitized.metadata->'address'
        END,
        'brand', CASE
          WHEN COALESCE(sanitized.metadata->>'brand', '')
            ~* '@[a-z0-9.-]+\.[a-z]{2,}'
            OR COALESCE(sanitized.metadata->>'brand', '')
              ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
          THEN NULL
          ELSE sanitized.metadata->'brand'
        END,
        'operator', CASE
          WHEN COALESCE(sanitized.metadata->>'operator', '')
            ~* '@[a-z0-9.-]+\.[a-z]{2,}'
            OR COALESCE(sanitized.metadata->>'operator', '')
              ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
          THEN NULL
          ELSE sanitized.metadata->'operator'
        END,
        'source_description', CASE
          WHEN COALESCE(sanitized.metadata->>'source_description', '')
            ~* '@[a-z0-9.-]+\.[a-z]{2,}'
            OR COALESCE(sanitized.metadata->>'source_description', '')
              ~ '(^|[^0-9])(\+?62|0)[0-9 ()\.-]{7,}[0-9]([^0-9]|$)'
          THEN NULL
          ELSE sanitized.metadata->'source_description'
        END,
        'contact_policy', 'no_private_contact_seeded',
        'legacy_osm_contact_cleanup', sanitized.previous_state
      )),
    updated_at = now()
FROM sanitized
WHERE item.id = sanitized.id;
