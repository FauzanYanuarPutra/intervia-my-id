CREATE TABLE IF NOT EXISTS business_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  channel_key VARCHAR(80) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales_amount BIGINT NOT NULL CHECK (gross_sales_amount >= 0),
  platform_fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
  merchant_promo_amount BIGINT NOT NULL DEFAULT 0 CHECK (merchant_promo_amount >= 0),
  refunds_amount BIGINT NOT NULL DEFAULT 0 CHECK (refunds_amount >= 0),
  other_deductions_amount BIGINT NOT NULL DEFAULT 0 CHECK (other_deductions_amount >= 0),
  expected_transfer_amount BIGINT NOT NULL CHECK (expected_transfer_amount >= 0),
  actual_transfer_amount BIGINT NOT NULL CHECK (actual_transfer_amount >= 0),
  difference_amount BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('matched', 'short', 'excess')),
  note TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_settlements_period_valid CHECK (period_end >= period_start),
  CONSTRAINT business_settlements_deductions_valid CHECK (
    platform_fee_amount + merchant_promo_amount + refunds_amount + other_deductions_amount <= gross_sales_amount
  )
);

CREATE INDEX IF NOT EXISTS idx_business_settlements_business_period
  ON business_settlements (business_id, organization_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_business_settlements_channel_period
  ON business_settlements (business_id, organization_id, channel_key, period_end DESC);
