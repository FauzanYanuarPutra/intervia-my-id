ALTER TABLE business_sales
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

DO $$
BEGIN
  ALTER TABLE business_sales
    ADD CONSTRAINT business_sales_request_hash_check
    CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN business_sales.request_hash IS
  'Canonical SHA-256 request fingerprint for replay-safe sale commands; NULL only for legacy rows created before this migration.';
