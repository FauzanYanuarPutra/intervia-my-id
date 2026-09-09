CREATE TABLE IF NOT EXISTS business_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  occurred_on DATE NOT NULL,
  channel_key VARCHAR(80) NULL,
  account_key VARCHAR(40) NOT NULL DEFAULT 'cash'
    CHECK (account_key IN ('cash', 'bank', 'ewallet', 'receivable')),
  status VARCHAR(24) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'voided')),
  gross_amount BIGINT NOT NULL CHECK (gross_amount >= 0),
  discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount BIGINT NOT NULL CHECK (final_amount >= 0),
  cogs_amount BIGINT NULL CHECK (cogs_amount IS NULL OR cogs_amount >= 0),
  cost_complete BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_business_sales_amounts
    CHECK (discount_amount <= gross_amount AND final_amount = gross_amount - discount_amount),
  CONSTRAINT chk_business_sales_cost_completeness
    CHECK ((cost_complete AND cogs_amount IS NOT NULL) OR (NOT cost_complete AND cogs_amount IS NULL)),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_business_sales_business_date
  ON business_sales (business_id, organization_id, occurred_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_sales_reporting
  ON business_sales (business_id, organization_id, status, occurred_on DESC)
  WHERE status = 'completed';

CREATE TABLE IF NOT EXISTS business_sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES business_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES business_products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL CHECK (BTRIM(product_name) <> ''),
  quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
  unit_price_amount BIGINT NOT NULL CHECK (unit_price_amount >= 0),
  discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_revenue_amount BIGINT NOT NULL CHECK (final_revenue_amount >= 0),
  unit_cogs_amount BIGINT NULL CHECK (unit_cogs_amount IS NULL OR unit_cogs_amount >= 0),
  line_cogs_amount BIGINT NULL CHECK (line_cogs_amount IS NULL OR line_cogs_amount >= 0),
  cost_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_sale_lines_sale
  ON business_sale_lines (sale_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_business_sale_lines_product
  ON business_sale_lines (product_id, created_at DESC);

ALTER TABLE business_finance_entries
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_business_finance_entries_source
  ON business_finance_entries (business_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
