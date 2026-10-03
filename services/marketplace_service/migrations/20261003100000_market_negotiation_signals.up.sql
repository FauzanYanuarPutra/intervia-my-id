CREATE TABLE IF NOT EXISTS market_negotiation_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  signal_side TEXT NOT NULL CHECK (signal_side IN ('demand', 'supply')),
  signal_type TEXT NOT NULL DEFAULT 'negotiation'
    CHECK (signal_type IN ('negotiation', 'inquiry', 'price_indication')),
  amount_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  quantity NUMERIC,
  quantity_unit TEXT,
  city TEXT,
  category TEXT,
  price_unit TEXT,
  source TEXT NOT NULL DEFAULT 'content_detail',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_negotiation_signals_scope
  ON market_negotiation_signals (category, city, price_unit, currency, signal_side, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_negotiation_signals_content
  ON market_negotiation_signals (content_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_market_negotiation_signals_idempotency
  ON market_negotiation_signals (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
