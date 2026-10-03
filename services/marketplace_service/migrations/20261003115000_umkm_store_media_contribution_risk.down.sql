BEGIN;

DROP INDEX IF EXISTS idx_umkm_store_media_contributions_risk_queue;

ALTER TABLE umkm_store_media_contributions
  DROP COLUMN IF EXISTS risk_checked_at,
  DROP COLUMN IF EXISTS risk_flags,
  DROP COLUMN IF EXISTS risk_level,
  DROP COLUMN IF EXISTS risk_score;

COMMIT;
