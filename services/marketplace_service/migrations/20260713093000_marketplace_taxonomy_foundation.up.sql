-- Canonical marketplace taxonomy foundation.
-- Additive migration: preserves legacy content_items.category and metadata keys.

CREATE TABLE IF NOT EXISTS marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  legacy_key text UNIQUE,
  name_id text NOT NULL,
  name_en text NOT NULL,
  description_id text NOT NULL,
  description_en text NOT NULL,
  icon text NULL,
  badge text NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name_id text NOT NULL,
  name_en text NOT NULL,
  description_id text NULL,
  description_en text NULL,
  icon text NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE TABLE IF NOT EXISTS industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_id text NOT NULL,
  name_en text NOT NULL,
  icon text NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_industries (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  industry_id uuid NOT NULL REFERENCES industries(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, industry_id)
);

CREATE TABLE IF NOT EXISTS listing_tags (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, tag)
);

CREATE TABLE IF NOT EXISTS listing_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  subcategory_id uuid NULL REFERENCES marketplace_subcategories(id) ON DELETE CASCADE,
  key text NOT NULL,
  label_id text NOT NULL,
  label_en text NOT NULL,
  value_type text NOT NULL,
  unit text NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_filterable boolean NOT NULL DEFAULT false,
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_attributes_value_type_check
    CHECK (value_type IN ('text','number','boolean','select','multi_select','currency','date','location'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_attributes_scope_key
  ON listing_attributes (
    COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    key
  );

CREATE TABLE IF NOT EXISTS listing_attribute_values (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES listing_attributes(id) ON DELETE CASCADE,
  value_text text NULL,
  value_number numeric NULL,
  value_boolean boolean NULL,
  value_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS marketplace_search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  synonyms text[] NOT NULL DEFAULT '{}',
  category_id uuid NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS marketplace_category_id uuid NULL REFERENCES marketplace_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketplace_subcategory_id uuid NULL REFERENCES marketplace_subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_categories_active_order
  ON marketplace_categories (is_active, sort_order, slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_subcategories_category_order
  ON marketplace_subcategories (category_id, is_active, sort_order, slug);
CREATE INDEX IF NOT EXISTS idx_industries_active_order
  ON industries (is_active, sort_order, slug);
CREATE INDEX IF NOT EXISTS idx_listing_industries_industry
  ON listing_industries (industry_id, content_id);
CREATE INDEX IF NOT EXISTS idx_listing_tags_tag
  ON listing_tags (lower(tag));
CREATE INDEX IF NOT EXISTS idx_content_marketplace_category
  ON content_items (marketplace_category_id, content_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_marketplace_subcategory
  ON content_items (marketplace_subcategory_id, content_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_metadata_subcategory_slug
  ON content_items ((metadata->>'marketplace_subcategory_slug'))
  WHERE metadata ? 'marketplace_subcategory_slug';

INSERT INTO marketplace_categories (
  id, slug, legacy_key, name_id, name_en, description_id, description_en,
  icon, badge, sort_order, metadata
)
VALUES
  ('10000000-0000-0000-0000-000000000001','materials-suppliers','supplies','Bahan & Supplier','Materials & Suppliers','Supplier, bahan baku, stok grosir, kemasan, dan produk jual ulang.','Suppliers, raw materials, wholesale stock, packaging, and resale products.','package','Utama',10,'{"aliases":["bahan-usaha","business-supplies","supplier","pemasok","distributor","produsen"]}'::jsonb),
  ('10000000-0000-0000-0000-000000000002','services','service','Cari Jasa','Services','Jasa operasional, kreatif, legal, digital, teknisi, dan lapangan.','Operations, creative, legal, digital, repair, and field services.','wrench','Expert',20,'{"aliases":["jasa","find-services","service"]}'::jsonb),
  ('10000000-0000-0000-0000-000000000003','machines-tools','equipment','Mesin & Alat','Machines & Tools','Mesin, alat produksi, sewa alat, dan perlengkapan usaha.','Machines, production tools, equipment rental, and business equipment.','briefcase-business','Teknis',30,'{"aliases":["mesin-alat","equipment-tools","mesin","alat","tools"]}'::jsonb),
  ('10000000-0000-0000-0000-000000000004','business-places','property','Tempat Usaha','Business Places','Ruko, kios, booth, gudang kecil, dan lokasi jualan.','Shop houses, kiosks, booths, small warehouses, and selling locations.','building-2','Prime',40,'{"aliases":["tempat-usaha","business-place","property","lokasi-usaha","ruko","kios"]}'::jsonb),
  ('10000000-0000-0000-0000-000000000005','business-opportunities','opportunity','Peluang Usaha','Business Opportunities','Franchise, kemitraan, reseller, distributor, dan peluang siap jalan.','Franchises, partnerships, resellers, distributors, and ready business opportunities.','handshake','Cuan',50,'{"aliases":["peluang-usaha","business-opportunity","franchise","kemitraan","reseller"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET legacy_key = EXCLUDED.legacy_key,
    name_id = EXCLUDED.name_id,
    name_en = EXCLUDED.name_en,
    description_id = EXCLUDED.description_id,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    badge = EXCLUDED.badge,
    sort_order = EXCLUDED.sort_order,
    metadata = marketplace_categories.metadata || EXCLUDED.metadata,
    updated_at = now();

WITH subcategory_seed(category_slug, slug, name_id, name_en, sort_order) AS (
  VALUES
    ('materials-suppliers','raw-materials','Bahan Baku Produksi','Raw Materials',10),
    ('materials-suppliers','business-packaging','Kemasan Usaha','Business Packaging',20),
    ('materials-suppliers','wholesale-stock','Stok Grosir','Wholesale Stock',30),
    ('materials-suppliers','resale-products','Produk Jual Ulang','Resale Products',40),
    ('materials-suppliers','supporting-materials','Bahan Penunjang','Supporting Materials',50),
    ('materials-suppliers','direct-manufacturers','Produsen Langsung','Direct Manufacturers',60),
    ('materials-suppliers','local-suppliers','Supplier Lokal','Local Suppliers',70),
    ('materials-suppliers','private-label-manufacturing','Maklon & Private Label','Private Label Manufacturing',80),
    ('services','business-operations','Operasional Usaha','Business Operations',10),
    ('services','creative-design','Kreatif & Desain','Creative & Design',20),
    ('services','digital-technology','Digital & Teknologi','Digital & Technology',30),
    ('services','legal-licensing','Legal & Perizinan','Legal & Licensing',40),
    ('services','finance-accounting','Keuangan & Pembukuan','Finance & Accounting',50),
    ('services','technical-repair','Teknisi & Perbaikan','Technical Repair',60),
    ('services','logistics-delivery','Logistik & Pengiriman','Logistics & Delivery',70),
    ('services','production-manufacturing','Produksi & Maklon','Production & Manufacturing',80),
    ('services','marketing','Pemasaran','Marketing',90),
    ('services','field-workforce','Tenaga Lapangan','Field Workforce',100),
    ('machines-tools','production-machines','Mesin Produksi','Production Machines',10),
    ('machines-tools','food-beverage-machines','Mesin Makanan & Minuman','Food & Beverage Machines',20),
    ('machines-tools','store-pos-equipment','Peralatan Toko & Kasir','Store & POS Equipment',30),
    ('machines-tools','commercial-kitchen-equipment','Peralatan Dapur Usaha','Commercial Kitchen Equipment',40),
    ('machines-tools','agricultural-tools','Alat Pertanian','Agricultural Tools',50),
    ('machines-tools','workshop-tools','Alat Bengkel','Workshop Tools',60),
    ('machines-tools','construction-tools','Alat Konstruksi','Construction Tools',70),
    ('machines-tools','laundry-cleaning-equipment','Alat Laundry & Kebersihan','Laundry & Cleaning Equipment',80),
    ('machines-tools','office-equipment','Peralatan Kantor','Office Equipment',90),
    ('machines-tools','equipment-rental','Sewa Mesin & Alat','Equipment Rental',100),
    ('machines-tools','spare-parts-components','Sparepart & Komponen','Spare Parts & Components',110),
    ('business-places','shop-houses','Ruko','Shop Houses',10),
    ('business-places','kiosks','Kios','Kiosks',20),
    ('business-places','booths-stalls','Booth & Lapak','Booths & Stalls',30),
    ('business-places','warehouses','Gudang','Warehouses',40),
    ('business-places','production-kitchens','Dapur Produksi','Production Kitchens',50),
    ('business-places','offices','Kantor','Offices',60),
    ('business-places','studios','Studio','Studios',70),
    ('business-places','workshops','Workshop & Bengkel','Workshops',80),
    ('business-places','business-land','Lahan Usaha','Business Land',90),
    ('business-places','shared-business-spaces','Tempat Usaha Bersama','Shared Business Spaces',100),
    ('business-opportunities','franchise','Franchise','Franchise',10),
    ('business-opportunities','partnerships','Kemitraan','Partnerships',20),
    ('business-opportunities','reseller','Reseller','Reseller',30),
    ('business-opportunities','dropshipping','Dropship','Dropshipping',40),
    ('business-opportunities','agents','Agen','Agents',50),
    ('business-opportunities','distributors','Distributor','Distributors',60),
    ('business-opportunities','consignment','Titip Jual','Consignment',70),
    ('business-opportunities','production-partnerships','Kerja Sama Produksi','Production Partnerships',80),
    ('business-opportunities','marketing-partnerships','Kerja Sama Pemasaran','Marketing Partnerships',90),
    ('business-opportunities','ready-business-packages','Paket Usaha Siap Jalan','Ready Business Packages',100),
    ('business-opportunities','home-business-opportunities','Peluang Usaha Rumahan','Home Business Opportunities',110)
)
INSERT INTO marketplace_subcategories (
  category_id, slug, name_id, name_en, sort_order, metadata
)
SELECT c.id, s.slug, s.name_id, s.name_en, s.sort_order, jsonb_build_object('seed','canonical_20260713')
FROM subcategory_seed s
JOIN marketplace_categories c ON c.slug = s.category_slug
ON CONFLICT (category_id, slug) DO UPDATE
SET name_id = EXCLUDED.name_id,
    name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order,
    metadata = marketplace_subcategories.metadata || EXCLUDED.metadata,
    updated_at = now();

WITH industry_seed(slug, name_id, name_en, sort_order) AS (
  VALUES
    ('food-beverage','Makanan & Minuman','Food & Beverage',10),
    ('laundry','Laundry','Laundry',20),
    ('fashion-garment','Fashion & Konveksi','Fashion & Garment',30),
    ('cosmetics-care','Kosmetik & Perawatan','Cosmetics & Care',40),
    ('printing','Percetakan','Printing',50),
    ('crafts','Kerajinan','Crafts',60),
    ('agriculture','Pertanian','Agriculture',70),
    ('livestock','Peternakan','Livestock',80),
    ('fishery','Perikanan','Fishery',90),
    ('automotive-workshop','Bengkel & Otomotif','Automotive & Workshop',100),
    ('construction','Bangunan & Konstruksi','Building & Construction',110),
    ('furniture-interior','Furnitur & Interior','Furniture & Interior',120),
    ('retail','Retail','Retail',130),
    ('health','Kesehatan','Health',140),
    ('education','Pendidikan','Education',150),
    ('technology','Teknologi','Technology',160),
    ('logistics','Logistik','Logistics',170),
    ('property','Properti','Property',180),
    ('events','Event','Events',190),
    ('tourism','Pariwisata','Tourism',200),
    ('professional-services','Jasa Profesional','Professional Services',210),
    ('other','Lainnya','Other',999)
)
INSERT INTO industries (slug, name_id, name_en, sort_order, metadata)
SELECT slug, name_id, name_en, sort_order, '{"seed":"canonical_20260713"}'::jsonb
FROM industry_seed
ON CONFLICT (slug) DO UPDATE
SET name_id = EXCLUDED.name_id,
    name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order,
    metadata = industries.metadata || EXCLUDED.metadata,
    updated_at = now();

WITH attr_seed(category_slug, key, label_id, label_en, value_type, unit, is_filterable, is_required, sort_order) AS (
  VALUES
    ('materials-suppliers','moq','Minimum order / MOQ','Minimum order / MOQ','text',NULL,true,false,10),
    ('materials-suppliers','unit','Satuan','Unit','text',NULL,true,false,20),
    ('materials-suppliers','wholesale_available','Bisa grosir','Wholesale available','boolean',NULL,true,false,30),
    ('materials-suppliers','sample_available','Sampel tersedia','Sample available','boolean',NULL,true,false,40),
    ('materials-suppliers','delivery_area','Area pengiriman','Delivery area','text',NULL,true,false,50),
    ('services','starting_price','Harga mulai','Starting price','currency','IDR',true,false,10),
    ('services','service_area','Area layanan','Service area','text',NULL,true,false,20),
    ('services','remote_available','Bisa remote','Remote available','boolean',NULL,true,false,30),
    ('services','onsite_available','Bisa datang ke lokasi','Onsite available','boolean',NULL,true,false,40),
    ('services','warranty_available','Garansi pengerjaan','Work warranty','boolean',NULL,true,false,50),
    ('machines-tools','condition','Kondisi','Condition','select',NULL,true,false,10),
    ('machines-tools','transaction_type','Jual atau sewa','Sell or rent','select',NULL,true,false,20),
    ('machines-tools','brand','Merek','Brand','text',NULL,true,false,30),
    ('machines-tools','capacity','Kapasitas','Capacity','text',NULL,true,false,40),
    ('machines-tools','warranty','Garansi','Warranty','text',NULL,true,false,50),
    ('business-places','transaction_type','Sewa atau jual','Rent or sell','select',NULL,true,false,10),
    ('business-places','lease_period','Periode sewa','Lease period','text',NULL,true,false,20),
    ('business-places','area_sqm','Luas bangunan','Building area','number','m2',true,false,30),
    ('business-places','parking_available','Parkir','Parking','boolean',NULL,true,false,40),
    ('business-places','available_from','Tersedia mulai','Available from','date',NULL,true,false,50),
    ('business-opportunities','starting_capital','Modal awal','Starting capital','currency','IDR',true,false,10),
    ('business-opportunities','royalty','Royalti','Royalty','text',NULL,true,false,20),
    ('business-opportunities','partnership_type','Sistem kerja sama','Partnership type','select',NULL,true,false,30),
    ('business-opportunities','training_support','Dukungan pelatihan','Training support','boolean',NULL,true,false,40),
    ('business-opportunities','available_territory','Wilayah tersedia','Available territory','text',NULL,true,false,50)
)
INSERT INTO listing_attributes (
  category_id, key, label_id, label_en, value_type, unit,
  is_filterable, is_required, sort_order
)
SELECT c.id, a.key, a.label_id, a.label_en, a.value_type, a.unit,
       a.is_filterable, a.is_required, a.sort_order
FROM attr_seed a
JOIN marketplace_categories c ON c.slug = a.category_slug
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_search_synonyms (term, synonyms, category_id)
SELECT term, synonyms, c.id
FROM (
  VALUES
    ('supplier', ARRAY['pemasok','distributor','produsen']),
    ('ruko', ARRAY['toko','tempat usaha','shop house']),
    ('jasa desain', ARRAY['desain grafis','designer','kreatif desain']),
    ('mesin laundry', ARRAY['mesin cuci usaha','alat laundry','laundry cleaning equipment']),
    ('kemasan', ARRAY['packaging','bungkus','pouch','standing pouch']),
    ('franchise', ARRAY['waralaba','kemitraan','paket usaha'])
) AS s(term, synonyms)
LEFT JOIN marketplace_categories c ON (
  (s.term = 'supplier' AND c.slug = 'materials-suppliers') OR
  (s.term = 'ruko' AND c.slug = 'business-places') OR
  (s.term = 'jasa desain' AND c.slug = 'services') OR
  (s.term = 'mesin laundry' AND c.slug = 'machines-tools') OR
  (s.term = 'kemasan' AND c.slug = 'materials-suppliers') OR
  (s.term = 'franchise' AND c.slug = 'business-opportunities')
)
ON CONFLICT (term) DO UPDATE
SET synonyms = EXCLUDED.synonyms,
    category_id = EXCLUDED.category_id,
    is_active = true,
    updated_at = now();

UPDATE content_items ci
SET marketplace_category_id = c.id,
    metadata = COALESCE(ci.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'marketplace_category_slug', c.slug,
        'marketplace_category_legacy_key', COALESCE(c.legacy_key, ci.metadata->>'create_category')
      )
FROM marketplace_categories c
WHERE ci.marketplace_category_id IS NULL
  AND (
    ci.metadata->>'create_category' = c.legacy_key OR
    ci.metadata->>'marketplace_category_slug' = c.slug OR
    ci.metadata->>'business_discovery_category' = c.legacy_key
  );

INSERT INTO listing_tags (content_id, tag)
SELECT ci.id, lower(trim(tag))
FROM content_items ci
CROSS JOIN LATERAL unnest(COALESCE(ci.tags, ARRAY[]::text[])) AS tag
WHERE trim(tag) <> ''
ON CONFLICT (content_id, tag) DO NOTHING;

INSERT INTO listing_industries (content_id, industry_id, is_primary)
SELECT ci.id, i.id, true
FROM content_items ci
JOIN industries i ON i.slug = COALESCE(NULLIF(ci.metadata->>'industry_slug', ''), NULLIF(ci.metadata->>'sector', ''), 'other')
ON CONFLICT (content_id, industry_id) DO NOTHING;

INSERT INTO listing_industries (content_id, industry_id, is_primary)
SELECT ci.id, i.id, true
FROM content_items ci
JOIN industries i ON i.slug = 'other'
WHERE NOT EXISTS (
  SELECT 1 FROM listing_industries li WHERE li.content_id = ci.id
)
ON CONFLICT (content_id, industry_id) DO NOTHING;
