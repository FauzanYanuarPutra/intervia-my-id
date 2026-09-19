DROP INDEX IF EXISTS uq_business_sales_void_idempotency;
ALTER TABLE business_sales
  DROP CONSTRAINT IF EXISTS business_sale_void_idempotency_pair,
  DROP COLUMN IF EXISTS void_request_hash,
  DROP COLUMN IF EXISTS void_idempotency_key,
  DROP COLUMN IF EXISTS voided_at,
  DROP COLUMN IF EXISTS voided_by_user_id,
  DROP COLUMN IF EXISTS void_reason;

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_effect_sign_check,
  DROP COLUMN IF EXISTS effect_sign;
