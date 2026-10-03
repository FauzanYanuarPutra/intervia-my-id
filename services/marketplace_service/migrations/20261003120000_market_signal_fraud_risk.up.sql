ALTER TABLE market_negotiation_signals
  ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_decision TEXT NOT NULL DEFAULT 'allow'
    CHECK (risk_decision IN ('allow','review','block')),
  ADD COLUMN IF NOT EXISTS risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eligible_for_market BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS risk_evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_market_signal_actor_velocity
  ON market_negotiation_signals (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_signal_risk_queue
  ON market_negotiation_signals (risk_decision, created_at DESC)
  WHERE risk_decision <> 'allow';

CREATE INDEX IF NOT EXISTS idx_market_signal_market_eligible
  ON market_negotiation_signals (eligible_for_market, category, city, price_unit, currency, created_at DESC);

CREATE TABLE IF NOT EXISTS market_signal_risk_events (
  id UUID PRIMARY KEY,
  signal_id UUID REFERENCES market_negotiation_signals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  decision TEXT NOT NULL CHECK (decision IN ('allow','review','block')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_signal_risk_events_queue
  ON market_signal_risk_events (decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_signal_risk_events_actor
  ON market_signal_risk_events (actor_id, created_at DESC);
