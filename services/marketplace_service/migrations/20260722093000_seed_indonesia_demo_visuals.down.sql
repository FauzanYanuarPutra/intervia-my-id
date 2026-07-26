-- Roll back upgraded fictional demo visuals to the original local placeholders.

WITH content_fallbacks(slug, image_url) AS (
  VALUES
    ('mesin-sangrai-kopi-lokal-bandung-5kg','/images/hero/menu/mesin-01.png'),
    ('pengering-rempah-dan-cabai-umkm-garut','/images/hero/menu/mesin-01.png'),
    ('sealer-pedal-lokal-untuk-pouch-kopi-dan-snack','/images/hero/menu/mesin-01.png'),
    ('green-bean-kopi-gayo-honey-grade-1','/images/hero/menu/bahan-01.png'),
    ('tepung-mocaf-garut-food-grade-25kg','/images/hero/menu/bahan-01.png'),
    ('rumput-laut-kering-ntt-grade-food-cosmetic','/images/hero/menu/bahan-01.png'),
    ('kakao-fermentasi-sulawesi-untuk-cokelat-craft','/images/hero/menu/bahan-01.png'),
    ('kemasan-bambu-display-produk-lokal-tasikmalaya','/images/hero/menu/bahan-01.png'),
    ('jasa-foto-produk-dan-katalog-marketplace-umkm-surabaya','/images/hero/menu/jasa-01.png'),
    ('jasa-pengurusan-nib-halal-pirt-untuk-brand-pangan-lokal','/images/hero/menu/jasa-01.png'),
    ('kios-kampus-gejayan-yogyakarta-untuk-minuman-dan-snack','/images/hero/menu/lokasi-01.png'),
    ('dapur-produksi-kecil-bandung-timur-untuk-frozen-food','/images/hero/menu/lokasi-01.png'),
    ('kemitraan-jamu-modern-rempah-nusantara-modal-5-juta','/images/hero/menu/peluang-01.png'),
    ('reseller-kit-produk-bambu-dan-hampers-lokal','/images/hero/menu/peluang-01.png'),
    ('butuh-supplier-sambal-dan-snack-lokal-untuk-reseller-jabodetabek','/images/hero/menu/bahan-01.png'),
    ('butuh-mesin-pengering-sagu-dan-rempah-untuk-papua','/images/hero/menu/mesin-01.png'),
    ('oper-usaha-kedai-jamu-modern-solo-siap-handover','/images/hero/menu/peluang-01.png')
)
UPDATE content_items ci
SET cover_image = cf.image_url,
    metadata = (COALESCE(ci.metadata, '{}'::jsonb)
      - 'cover_image'
      - 'gallery_images'
      - 'image_credit'
      - 'image_url'
      - 'visual_seed_version')
      || jsonb_build_object('image_urls', jsonb_build_array(cf.image_url)),
    updated_at = NOW()
FROM content_fallbacks cf
WHERE ci.slug = cf.slug
  AND ci.metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND ci.metadata->>'visual_seed_version' = 'indonesia_demo_visuals_20260722';

WITH store_slugs(slug) AS (
  VALUES
    ('kedai-jamu-rempah-nusantara'),
    ('kopi-gayo-maju'),
    ('dapur-mocaf-garut'),
    ('warung-laut-timur-kupang'),
    ('cokelat-sulawesi-craft')
)
UPDATE umkm_stores s
SET metadata = COALESCE(s.metadata, '{}'::jsonb)
      - 'cover_image_url'
      - 'gallery_images'
      - 'image_credit'
      - 'image_url'
      - 'visual_seed_version',
    updated_at = NOW()
FROM store_slugs ss
WHERE s.slug = ss.slug
  AND s.metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND s.metadata->>'visual_seed_version' = 'indonesia_demo_visuals_20260722';

WITH product_fallbacks(slug, image_url) AS (
  VALUES
    ('kunyit-asam-gula-aren','/images/umkm/product-fresh.svg'),
    ('wedang-rempah-botol','/images/umkm/product-fresh.svg'),
    ('manual-brew-gayo','/images/umkm/product-food.svg'),
    ('drip-bag-gayo-5pcs','/images/umkm/product-retail.svg'),
    ('brownies-mocaf-aren','/images/umkm/product-bakery.svg'),
    ('cookies-mocaf-kelapa','/images/umkm/product-bakery.svg'),
    ('nasi-ikan-asap-sambal-pesisir','/images/umkm/product-food.svg'),
    ('es-rumput-laut-jeruk','/images/umkm/product-fresh.svg'),
    ('cokelat-panas-sulawesi','/images/umkm/product-food.svg'),
    ('cocoa-nibs-100gr','/images/umkm/product-retail.svg')
)
UPDATE umkm_products p
SET image_url = pf.image_url,
    metadata = COALESCE(p.metadata, '{}'::jsonb)
      - 'image_credit'
      - 'image_url'
      - 'visual_seed_version',
    updated_at = NOW()
FROM product_fallbacks pf
WHERE p.slug = pf.slug
  AND p.metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND p.metadata->>'visual_seed_version' = 'indonesia_demo_visuals_20260722';

WITH mart_store_ids(id) AS (
  VALUES
    ('30000000-0000-0000-0000-000000000001'::uuid),
    ('30000000-0000-0000-0000-000000000002'::uuid),
    ('30000000-0000-0000-0000-000000000003'::uuid)
)
UPDATE super_app_mart_stores s
SET metadata = COALESCE(s.metadata, '{}'::jsonb)
      - 'cover_image_url'
      - 'gallery_images'
      - 'image_credit'
      - 'image_url'
      - 'visual_seed_version',
    updated_at = NOW()
FROM mart_store_ids msi
WHERE s.id = msi.id
  AND s.metadata->>'visual_seed_version' = 'indonesia_demo_visuals_20260722';

WITH mart_item_fallbacks(id, image_url) AS (
  VALUES
    ('40000000-0000-0000-0000-000000000001'::uuid,'/images/umkm/product-retail.svg'),
    ('40000000-0000-0000-0000-000000000002'::uuid,'/images/umkm/product-retail.svg'),
    ('40000000-0000-0000-0000-000000000003'::uuid,'/images/umkm/product-retail.svg'),
    ('40000000-0000-0000-0000-000000000004'::uuid,'/images/umkm/product-fresh.svg'),
    ('40000000-0000-0000-0000-000000000005'::uuid,'/images/umkm/product-fresh.svg'),
    ('40000000-0000-0000-0000-000000000006'::uuid,'/images/umkm/product-fresh.svg')
)
UPDATE super_app_mart_items i
SET image_url = mif.image_url,
    metadata = COALESCE(i.metadata, '{}'::jsonb)
      - 'image_credit'
      - 'image_url'
      - 'visual_seed_version',
    updated_at = NOW()
FROM mart_item_fallbacks mif
WHERE i.id = mif.id
  AND i.metadata->>'visual_seed_version' = 'indonesia_demo_visuals_20260722';
