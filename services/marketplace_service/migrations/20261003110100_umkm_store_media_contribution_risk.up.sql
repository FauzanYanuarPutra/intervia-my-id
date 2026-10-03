ALTER TABLE umkm_store_media_contributions
  ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0
    CHECK (risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_umkm_store_media_contributions_risk_queue
  ON umkm_store_media_contributions (status, risk_level, risk_score DESC, created_at ASC)
  WHERE status = 'pending';
