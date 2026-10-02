CREATE TABLE IF NOT EXISTS crm_market_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  price_cents BIGINT NOT NULL CHECK (price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  price_unit TEXT,
  category TEXT,
  city TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_market_price_snapshots_market
  ON crm_market_price_snapshots(category, city, price_unit, currency, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_market_price_snapshots_content
  ON crm_market_price_snapshots(content_id, observed_at DESC);
