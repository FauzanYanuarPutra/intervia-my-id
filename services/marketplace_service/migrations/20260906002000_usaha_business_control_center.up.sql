CREATE TABLE IF NOT EXISTS business_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ingredient'
    CHECK (kind IN ('ingredient', 'packaging', 'semi_finished', 'utility', 'labor')),
  purchase_unit TEXT NOT NULL,
  recipe_unit TEXT NOT NULL,
  conversion_factor NUMERIC(20,6) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  purchase_price_amount BIGINT NOT NULL DEFAULT 0 CHECK (purchase_price_amount >= 0),
  purchase_quantity NUMERIC(20,6) NOT NULL DEFAULT 1 CHECK (purchase_quantity > 0),
  yield_percent NUMERIC(7,4) NOT NULL DEFAULT 100 CHECK (yield_percent > 0 AND yield_percent <= 100),
  waste_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0 AND waste_percent < 100),
  stock_quantity NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  supplier_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_ingredients_business
  ON business_ingredients (business_id, organization_id, status);
CREATE INDEX IF NOT EXISTS idx_business_ingredients_low_stock
  ON business_ingredients (business_id, stock_quantity, minimum_stock)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS business_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES business_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  servings NUMERIC(20,6) NOT NULL DEFAULT 1 CHECK (servings > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_business_recipes_business
  ON business_recipes (business_id, organization_id, status);

CREATE TABLE IF NOT EXISTS business_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES business_recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES business_ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  waste_percent_override NUMERIC(7,4) NULL
    CHECK (waste_percent_override IS NULL OR (waste_percent_override >= 0 AND waste_percent_override < 100)),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_business_recipe_items_recipe
  ON business_recipe_items (recipe_id, position, id);

CREATE TABLE IF NOT EXISTS business_channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  channel_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  fee_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (fee_rate_bps >= 0 AND fee_rate_bps <= 10000),
  fixed_fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (fixed_fee_amount >= 0),
  merchant_promo_amount BIGINT NOT NULL DEFAULT 0 CHECK (merchant_promo_amount >= 0),
  target_margin_bps INTEGER NOT NULL DEFAULT 2500 CHECK (target_margin_bps >= 0 AND target_margin_bps < 10000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, channel_key)
);

CREATE INDEX IF NOT EXISTS idx_business_channel_settings_business
  ON business_channel_settings (business_id, organization_id, enabled);

CREATE TABLE IF NOT EXISTS business_product_channel_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES business_products(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  listing_name TEXT NOT NULL,
  listing_description TEXT NOT NULL DEFAULT '',
  listing_category TEXT NOT NULL DEFAULT '',
  price_amount BIGINT NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  external_id TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, product_id, channel_key)
);

CREATE INDEX IF NOT EXISTS idx_business_product_channel_listings_business
  ON business_product_channel_listings (business_id, organization_id, channel_key, enabled);

CREATE TABLE IF NOT EXISTS business_finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'sale_income', 'other_income', 'ingredient_purchase', 'packaging_purchase',
    'rent', 'utilities', 'salary', 'transport', 'marketing', 'equipment',
    'owner_capital', 'owner_drawing', 'receivable_payment', 'payable_payment',
    'other_expense'
  )),
  account_key TEXT NOT NULL DEFAULT 'cash',
  amount BIGINT NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  channel_key TEXT NULL,
  source_type TEXT NULL,
  source_id UUID NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_finance_entries_business_date
  ON business_finance_entries (business_id, organization_id, occurred_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_finance_entries_channel
  ON business_finance_entries (business_id, channel_key, occurred_on DESC)
  WHERE channel_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES business_products(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NULL,
  hpp_amount BIGINT NOT NULL CHECK (hpp_amount >= 0),
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_cost_snapshots_product
  ON business_cost_snapshots (business_id, product_id, captured_at DESC);
