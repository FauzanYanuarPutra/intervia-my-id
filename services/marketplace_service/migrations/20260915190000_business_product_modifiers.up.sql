CREATE TABLE business_product_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER NULL CHECK (max_select IS NULL OR max_select >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, product_id),
  FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products (id, business_id, organization_id)
    ON DELETE CASCADE,
  CHECK (max_select IS NULL OR max_select >= min_select),
  CHECK (
    (selection_type = 'single' AND max_select = 1 AND min_select IN (0, 1))
    OR selection_type = 'multiple'
  ),
  CHECK (NOT is_required OR min_select >= 1)
);

CREATE INDEX idx_business_product_modifier_groups_product
  ON business_product_modifier_groups (product_id, is_active, sort_order, id);

CREATE INDEX idx_business_product_modifier_groups_tenant
  ON business_product_modifier_groups (organization_id, business_id, product_id);

CREATE TABLE business_product_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  product_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  price_delta_cents BIGINT NOT NULL DEFAULT 0 CHECK (price_delta_cents >= 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (group_id, product_id)
    REFERENCES business_product_modifier_groups (id, product_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_business_product_modifier_options_group
  ON business_product_modifier_options (group_id, is_active, sort_order, id);

CREATE INDEX idx_business_product_modifier_options_product
  ON business_product_modifier_options (product_id, group_id);
