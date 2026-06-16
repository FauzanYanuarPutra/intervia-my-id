-- Replace synthetic placeholder media in seeded content with first-party category assets.
-- User-uploaded or externally supplied non-placeholder media is left untouched.

WITH placeholder_rows AS (
  SELECT
    id,
    CASE
      WHEN content_type = 'property' THEN '/images/umkm/content-property.svg'
      WHEN content_type = 'service' THEN '/images/umkm/content-service.svg'
      WHEN content_type = 'job' THEN '/images/umkm/content-job.svg'
      WHEN content_type = 'freelancer' THEN '/images/umkm/content-talent.svg'
      WHEN content_type = 'tool_rental' THEN '/images/umkm/content-listing.svg'
      ELSE '/images/umkm/content-product.svg'
    END AS category_image
  FROM content_items
  WHERE
    cover_image ILIKE '%picsum.photos%'
    OR cover_image ILIKE '%loremflickr.com%'
    OR metadata::text ILIKE '%picsum.photos%'
    OR metadata::text ILIKE '%loremflickr.com%'
)
UPDATE content_items AS content
SET
  cover_image = placeholder_rows.category_image,
  metadata = (
    content.metadata
      - 'cover_image'
      - 'coverImage'
      - 'cover_image_url'
      - 'coverImageUrl'
      - 'image'
      - 'image_url'
      - 'imageUrl'
      - 'thumbnail'
      - 'thumbnail_url'
      - 'thumbnailUrl'
      - 'photo'
      - 'photo_url'
      - 'photoUrl'
      - 'media_url'
      - 'mediaUrl'
      - 'image_urls'
      - 'imageUrls'
      - 'images'
      - 'gallery'
      - 'gallery_images'
      - 'galleryImages'
      - 'media_urls'
      - 'mediaUrls'
      - 'media'
      - 'media_gallery'
      - 'mediaGallery'
      - 'photos'
      - 'photo_urls'
      - 'photoUrls'
      - 'attachments'
      - 'detail_images'
      - 'detailImages'
      - 'portfolio_images'
      - 'portfolioImages'
      - 'property_images'
      - 'propertyImages'
      - 'listing_images'
      - 'listingImages'
  ) || jsonb_build_object(
    'cover_image', placeholder_rows.category_image,
    'image_urls', jsonb_build_array(placeholder_rows.category_image),
    'media_source', 'first_party_category_asset'
  ),
  updated_at = now()
FROM placeholder_rows
WHERE content.id = placeholder_rows.id;
