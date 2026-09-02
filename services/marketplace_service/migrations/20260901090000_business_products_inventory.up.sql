CREATE TABLE business_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  category TEXT NOT NULL CHECK (BTRIM(category) <> ''),
  price_label TEXT NOT NULL CHECK (BTRIM(price_label) <> ''),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('owned', 'consignment')),
  owner_label TEXT NULL,
  consignment_terms TEXT NULL,
  notes TEXT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, business_id, organization_id)
);

CREATE INDEX idx_business_products_organization_business
  ON business_products (organization_id, business_id, created_at DESC);

CREATE TABLE business_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  stock_count DOUBLE PRECISION NULL CHECK (
    stock_count IS NULL OR (
      stock_count >= 0
      AND stock_count NOT IN (
        'NaN'::DOUBLE PRECISION,
        'Infinity'::DOUBLE PRECISION,
        '-Infinity'::DOUBLE PRECISION
      )
    )
  ),
  stock_unit TEXT NOT NULL CHECK (BTRIM(stock_unit) <> ''),
  min_stock_alert DOUBLE PRECISION NULL CHECK (
    min_stock_alert IS NULL OR (
      min_stock_alert >= 0
      AND min_stock_alert NOT IN (
        'NaN'::DOUBLE PRECISION,
        'Infinity'::DOUBLE PRECISION,
        '-Infinity'::DOUBLE PRECISION
      )
    )
  ),
  stock_mode TEXT NOT NULL
    CHECK (stock_mode IN ('manual', 'estimated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id),
  FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products (id, business_id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_business_inventory_organization_business
  ON business_inventory (organization_id, business_id, updated_at DESC);

WITH raw_legacy_products AS (
  SELECT
    business.id AS business_id,
    business.organization_id,
    product AS legacy_product,
    product_position,
    CASE
      WHEN product->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (product->>'id')::UUID
      ELSE NULL
    END AS legacy_product_id
  FROM businesses business
  JOIN business_store_links link
    ON link.business_id = business.id AND link.link_type = 'primary'
  JOIN umkm_stores store ON store.id = link.store_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(store.metadata->'products') = 'array' THEN store.metadata->'products'
      ELSE '[]'::JSONB
    END
  ) WITH ORDINALITY AS products(product, product_position)
), legacy_products AS (
  SELECT
    business_id,
    organization_id,
    legacy_product,
    CASE
      WHEN legacy_product_id IS NOT NULL
        AND ROW_NUMBER() OVER (
          PARTITION BY legacy_product_id
          ORDER BY business_id, product_position
        ) = 1
        THEN legacy_product_id
      ELSE gen_random_uuid()
    END AS product_id
  FROM raw_legacy_products
), normalized_products AS (
  SELECT
    business_id,
    organization_id,
    product_id,
    COALESCE(NULLIF(BTRIM(legacy_product->>'name'), ''), 'Produk') AS name,
    COALESCE(NULLIF(BTRIM(legacy_product->>'category'), ''), 'general') AS category,
    COALESCE(
      NULLIF(BTRIM(COALESCE(legacy_product->>'price_label', legacy_product->>'priceLabel')), ''),
      'Harga belum dicatat'
    ) AS price_label,
    CASE LOWER(COALESCE(legacy_product->>'status', 'active'))
      WHEN 'archived' THEN 'archived'
      ELSE 'active'
    END AS status,
    CASE LOWER(COALESCE(legacy_product->>'source_type', legacy_product->>'sourceType', 'owned'))
      WHEN 'consignment' THEN 'consignment'
      ELSE 'owned'
    END AS source_type,
    NULLIF(BTRIM(COALESCE(legacy_product->>'owner_label', legacy_product->>'ownerLabel')), '') AS owner_label,
    NULLIF(BTRIM(COALESCE(legacy_product->>'consignment_terms', legacy_product->>'consignmentTerms')), '') AS consignment_terms,
    NULLIF(BTRIM(legacy_product->>'notes'), '') AS notes,
    CASE
      WHEN pg_input_is_valid(
        COALESCE(legacy_product->>'stock_count', legacy_product->>'stockCount'),
        'double precision'
      ) THEN CASE
        WHEN COALESCE(legacy_product->>'stock_count', legacy_product->>'stockCount')::DOUBLE PRECISION >= 0
          AND COALESCE(legacy_product->>'stock_count', legacy_product->>'stockCount')::DOUBLE PRECISION NOT IN (
            'NaN'::DOUBLE PRECISION,
            'Infinity'::DOUBLE PRECISION,
            '-Infinity'::DOUBLE PRECISION
          )
          THEN COALESCE(legacy_product->>'stock_count', legacy_product->>'stockCount')::DOUBLE PRECISION
        ELSE NULL
      END
      ELSE NULL
    END AS stock_count,
    COALESCE(NULLIF(BTRIM(COALESCE(legacy_product->>'stock_unit', legacy_product->>'stockUnit')), ''), 'pcs') AS stock_unit,
    CASE
      WHEN pg_input_is_valid(
        COALESCE(legacy_product->>'min_stock_alert', legacy_product->>'minStockAlert'),
        'double precision'
      ) THEN CASE
        WHEN COALESCE(legacy_product->>'min_stock_alert', legacy_product->>'minStockAlert')::DOUBLE PRECISION >= 0
          AND COALESCE(legacy_product->>'min_stock_alert', legacy_product->>'minStockAlert')::DOUBLE PRECISION NOT IN (
            'NaN'::DOUBLE PRECISION,
            'Infinity'::DOUBLE PRECISION,
            '-Infinity'::DOUBLE PRECISION
          )
          THEN COALESCE(legacy_product->>'min_stock_alert', legacy_product->>'minStockAlert')::DOUBLE PRECISION
        ELSE NULL
      END
      ELSE NULL
    END AS min_stock_alert,
    CASE LOWER(COALESCE(legacy_product->>'stock_mode', legacy_product->>'stockMode', 'manual'))
      WHEN 'estimated' THEN 'estimated'
      ELSE 'manual'
    END AS stock_mode
  FROM legacy_products
), inserted_products AS (
  INSERT INTO business_products (
    id, business_id, organization_id, name, category, price_label, status,
    source_type, owner_label, consignment_terms, notes
  )
  SELECT
    product_id, business_id, organization_id, name, category, price_label, status,
    source_type, owner_label, consignment_terms, notes
  FROM normalized_products
  RETURNING id, business_id, organization_id
)
INSERT INTO business_inventory (
  id, product_id, business_id, organization_id, stock_count, stock_unit,
  min_stock_alert, stock_mode
)
SELECT
  gen_random_uuid(), inserted.id, inserted.business_id, inserted.organization_id,
  normalized.stock_count, normalized.stock_unit, normalized.min_stock_alert,
  normalized.stock_mode
FROM inserted_products inserted
JOIN normalized_products normalized ON normalized.product_id = inserted.id;
