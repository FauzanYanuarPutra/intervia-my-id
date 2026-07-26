-- Upgrade fictional Indonesia demo seed visuals with realistic external photos.
-- The data remains fictional; images are demo references from Unsplash.

WITH content_visuals(slug, image_url, gallery_urls, source_url, source_title) AS (
  VALUES
    (
      'mesin-sangrai-kopi-lokal-bandung-5kg',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/coffee-beans',
      'Coffee beans and small production setup'
    ),
    (
      'pengering-rempah-dan-cabai-umkm-garut',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/spice',
      'Spices, turmeric, ginger, and chili'
    ),
    (
      'sealer-pedal-lokal-untuk-pouch-kopi-dan-snack',
      'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/paper-packaging',
      'Paper packaging for takeaway and retail'
    ),
    (
      'green-bean-kopi-gayo-honey-grade-1',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/coffee-beans',
      'Coffee beans for roasting supply'
    ),
    (
      'tepung-mocaf-garut-food-grade-25kg',
      'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/spice',
      'Food ingredients and dry goods'
    ),
    (
      'rumput-laut-kering-ntt-grade-food-cosmetic',
      'https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/indonesian-street-food',
      'Indonesian food stall and local ingredients'
    ),
    (
      'kakao-fermentasi-sulawesi-untuk-cokelat-craft',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cocoa-beans',
      'Brown beans and craft beverage retail'
    ),
    (
      'kemasan-bambu-display-produk-lokal-tasikmalaya',
      'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/paper-packaging',
      'Retail packaging and product display'
    ),
    (
      'jasa-foto-produk-dan-katalog-marketplace-umkm-surabaya',
      'https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/product-photography-studio',
      'Product photography studio setup'
    ),
    (
      'jasa-pengurusan-nib-halal-pirt-untuk-brand-pangan-lokal',
      'https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cafe-indonesia',
      'Small business counter and retail documentation'
    ),
    (
      'kios-kampus-gejayan-yogyakarta-untuk-minuman-dan-snack',
      'https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cafe-indonesia',
      'Cafe counter suitable for small kiosk preview'
    ),
    (
      'dapur-produksi-kecil-bandung-timur-untuk-frozen-food',
      'https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/indonesian-street-food',
      'Food preparation and small kitchen operations'
    ),
    (
      'kemitraan-jamu-modern-rempah-nusantara-modal-5-juta',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/spice',
      'Jamu spices and herbs'
    ),
    (
      'reseller-kit-produk-bambu-dan-hampers-lokal',
      'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/paper-packaging',
      'Hampers and retail packaging'
    ),
    (
      'butuh-supplier-sambal-dan-snack-lokal-untuk-reseller-jabodetabek',
      'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/paper-packaging',
      'Packaged local products request'
    ),
    (
      'butuh-mesin-pengering-sagu-dan-rempah-untuk-papua',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/spice',
      'Drying machine request for sago and spices'
    ),
    (
      'oper-usaha-kedai-jamu-modern-solo-siap-handover',
      'https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cafe-indonesia',
      'Cafe counter and jamu ingredients'
    )
)
UPDATE content_items ci
SET cover_image = cv.image_url,
    metadata = COALESCE(ci.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'cover_image', cv.image_url,
        'image_url', cv.image_url,
        'image_urls', cv.gallery_urls,
        'gallery_images', cv.gallery_urls,
        'visual_seed_version', 'indonesia_demo_visuals_20260722',
        'image_credit', jsonb_build_object(
          'provider', 'Unsplash',
          'source_url', cv.source_url,
          'title', cv.source_title,
          'license_url', 'https://unsplash.com/license',
          'note', 'Demo imagery for fictional Lajukan seed data.'
        )
      ),
    updated_at = NOW()
FROM content_visuals cv
WHERE ci.slug = cv.slug
  AND ci.metadata->>'seed_pack' = 'indonesia_demo_20260709';

WITH store_visuals(slug, image_url, gallery_urls, source_url, source_title) AS (
  VALUES
    (
      'kedai-jamu-rempah-nusantara',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/spice',
      'Jamu spices and modern cafe counter'
    ),
    (
      'kopi-gayo-maju',
      'https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cafe-indonesia',
      'Coffee shop counter and coffee beans'
    ),
    (
      'dapur-mocaf-garut',
      'https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/indonesian-street-food',
      'Food stall and dry ingredients'
    ),
    (
      'warung-laut-timur-kupang',
      'https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/indonesian-street-food',
      'Local food stall and takeaway packaging'
    ),
    (
      'cokelat-sulawesi-craft',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/cocoa-beans',
      'Craft chocolate beans and cafe counter'
    )
)
UPDATE umkm_stores s
SET metadata = COALESCE(s.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'cover_image_url', sv.image_url,
        'image_url', sv.image_url,
        'gallery_images', sv.gallery_urls,
        'visual_seed_version', 'indonesia_demo_visuals_20260722',
        'image_credit', jsonb_build_object(
          'provider', 'Unsplash',
          'source_url', sv.source_url,
          'title', sv.source_title,
          'license_url', 'https://unsplash.com/license',
          'note', 'Demo imagery for fictional Lajukan seed data.'
        )
      ),
    updated_at = NOW()
FROM store_visuals sv
WHERE s.slug = sv.slug
  AND s.metadata->>'seed_pack' = 'indonesia_demo_20260709';

WITH product_visuals(slug, image_url, source_url, source_title) AS (
  VALUES
    ('kunyit-asam-gula-aren','https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/spice','Turmeric and jamu spice ingredients'),
    ('wedang-rempah-botol','https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/spice','Spice spoons for warm drinks'),
    ('manual-brew-gayo','https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/cafe-indonesia','Manual brew coffee counter'),
    ('drip-bag-gayo-5pcs','https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/coffee-beans','Coffee beans for drip bag product'),
    ('brownies-mocaf-aren','https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/indonesian-street-food','Prepared local food product'),
    ('cookies-mocaf-kelapa','https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/indonesian-street-food','Prepared bakery-style food product'),
    ('nasi-ikan-asap-sambal-pesisir','https://images.unsplash.com/photo-1750127885334-5d983eb7967b?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/indonesian-street-food','Indonesian food stall bowl'),
    ('es-rumput-laut-jeruk','https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/spice','Fresh ingredients for local beverage'),
    ('cokelat-panas-sulawesi','https://images.unsplash.com/photo-1776483751866-142903e080af?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/chocolate-drink','Cafe counter for hot chocolate'),
    ('cocoa-nibs-100gr','https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80','https://unsplash.com/s/photos/cocoa-beans','Brown beans for cocoa nibs')
)
UPDATE umkm_products p
SET image_url = pv.image_url,
    metadata = COALESCE(p.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'image_url', pv.image_url,
        'visual_seed_version', 'indonesia_demo_visuals_20260722',
        'image_credit', jsonb_build_object(
          'provider', 'Unsplash',
          'source_url', pv.source_url,
          'title', pv.source_title,
          'license_url', 'https://unsplash.com/license',
          'note', 'Demo imagery for fictional Lajukan seed data.'
        )
      ),
    updated_at = NOW()
FROM product_visuals pv
WHERE p.slug = pv.slug
  AND p.metadata->>'seed_pack' = 'indonesia_demo_20260709';

WITH mart_store_visuals(id, image_url, gallery_urls, source_url, source_title) AS (
  VALUES
    (
      '30000000-0000-0000-0000-000000000001'::uuid,
      'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1686820740687-426a7b9b2043?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/grocery-bags',
      'Fresh groceries and staple goods'
    ),
    (
      '30000000-0000-0000-0000-000000000002'::uuid,
      'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/paper-packaging',
      'Convenience store packaging and kitchen staples'
    ),
    (
      '30000000-0000-0000-0000-000000000003'::uuid,
      'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=1200&q=80',
      '["https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1759082495730-2a5090278e7e?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
      'https://unsplash.com/s/photos/apples',
      'Fresh market fruit and grocery items'
    )
)
UPDATE super_app_mart_stores s
SET metadata = COALESCE(s.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'cover_image_url', msv.image_url,
        'image_url', msv.image_url,
        'gallery_images', msv.gallery_urls,
        'visual_seed_version', 'indonesia_demo_visuals_20260722',
        'image_credit', jsonb_build_object(
          'provider', 'Unsplash',
          'source_url', msv.source_url,
          'title', msv.source_title,
          'license_url', 'https://unsplash.com/license',
          'note', 'Demo imagery for fictional Lajukan mart seed data.'
        )
      ),
    updated_at = NOW()
FROM mart_store_visuals msv
WHERE s.id = msv.id;

WITH mart_item_visuals(id, image_url, source_url, source_title) AS (
  VALUES
    (
      '40000000-0000-0000-0000-000000000001'::uuid,
      'https://images.unsplash.com/photo-1686820740687-426a7b9b2043?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/s/photos/rice-bag',
      'Rice grains and staple food packaging'
    ),
    (
      '40000000-0000-0000-0000-000000000002'::uuid,
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/s/photos/cooking-oils',
      'Cooking oil bottle for kitchen staples'
    ),
    (
      '40000000-0000-0000-0000-000000000003'::uuid,
      'https://images.unsplash.com/photo-1685531309627-f0c9e8656ff9?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/s/photos/milk-carton',
      'Milk carton product photography'
    ),
    (
      '40000000-0000-0000-0000-000000000004'::uuid,
      'https://images.unsplash.com/photo-1759082495730-2a5090278e7e?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/photos/cardboard-egg-carton-with-eggs-and-rubber-bands-VYbNmQx0aJU',
      'Egg carton for daily grocery product'
    ),
    (
      '40000000-0000-0000-0000-000000000005'::uuid,
      'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/s/photos/apples',
      'Apples for fresh fruit catalog'
    ),
    (
      '40000000-0000-0000-0000-000000000006'::uuid,
      'https://images.unsplash.com/photo-1633096013004-e2cb4023b560?auto=format&fit=crop&w=1200&q=80',
      'https://unsplash.com/s/photos/raw-chicken-breast',
      'Raw chicken breast for fresh protein catalog'
    )
)
UPDATE super_app_mart_items i
SET image_url = miv.image_url,
    metadata = COALESCE(i.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'image_url', miv.image_url,
        'visual_seed_version', 'indonesia_demo_visuals_20260722',
        'image_credit', jsonb_build_object(
          'provider', 'Unsplash',
          'source_url', miv.source_url,
          'title', miv.source_title,
          'license_url', 'https://unsplash.com/license',
          'note', 'Demo imagery for fictional Lajukan mart seed data.'
        )
      ),
    updated_at = NOW()
FROM mart_item_visuals miv
WHERE i.id = miv.id;
