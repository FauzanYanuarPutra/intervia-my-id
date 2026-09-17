BEGIN;

ALTER TABLE business_finance_entries
  ADD COLUMN IF NOT EXISTS effect_multiplier SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id UUID NULL REFERENCES business_finance_entries(id),
  ADD COLUMN IF NOT EXISTS corrects_entry_id UUID NULL REFERENCES business_finance_entries(id),
  ADD COLUMN IF NOT EXISTS correction_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_command_id UUID NULL,
  ADD COLUMN IF NOT EXISTS allocation_bucket TEXT NULL;

DO $$
BEGIN
  ALTER TABLE business_finance_entries
    ADD CONSTRAINT business_finance_entries_effect_multiplier_check
    CHECK (effect_multiplier IN (-1, 1));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE business_finance_entries
    ADD CONSTRAINT business_finance_entries_allocation_bucket_check
    CHECK (allocation_bucket IS NULL OR allocation_bucket IN ('owner','team','reinvest','operations','reserve'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS business_finance_entries_one_reversal_per_entry
  ON business_finance_entries (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_finance_entries_business_date_idx
  ON business_finance_entries (business_id, organization_id, occurred_on, created_at, id);
CREATE INDEX IF NOT EXISTS business_finance_entries_command_idx
  ON business_finance_entries (finance_command_id)
  WHERE finance_command_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_finance_commands (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  request_hash TEXT NOT NULL CHECK (char_length(request_hash) = 64),
  operation TEXT NOT NULL CHECK (operation IN ('create_entry','correct_entry','move_allocation')),
  subject_entry_id UUID NULL REFERENCES business_finance_entries(id),
  result_entry_id UUID NULL,
  actor_user_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS business_finance_commands_subject_idx
  ON business_finance_commands (business_id, subject_entry_id, created_at);

CREATE TABLE IF NOT EXISTS business_finance_entry_corrections (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  command_id UUID NOT NULL UNIQUE REFERENCES business_finance_commands(id),
  original_entry_id UUID NOT NULL UNIQUE REFERENCES business_finance_entries(id),
  reversal_entry_id UUID NOT NULL UNIQUE REFERENCES business_finance_entries(id),
  replacement_entry_id UUID NULL UNIQUE REFERENCES business_finance_entries(id),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  before_snapshot JSONB NOT NULL,
  after_snapshot JSONB NULL,
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_finance_entry_corrections_business_idx
  ON business_finance_entry_corrections (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_allocation_movements (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('owner','team','reinvest','operations','reserve')),
  amount_delta BIGINT NOT NULL CHECK (amount_delta <> 0),
  finance_entry_id UUID NULL REFERENCES business_finance_entries(id),
  finance_command_id UUID NULL REFERENCES business_finance_commands(id),
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_allocation_movements_business_idx
  ON business_allocation_movements (business_id, organization_id, bucket, created_at, id);
CREATE INDEX IF NOT EXISTS business_allocation_movements_entry_idx
  ON business_allocation_movements (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  event_key TEXT NOT NULL CHECK (char_length(btrim(event_key)) BETWEEN 1 AND 120),
  subject_type TEXT NOT NULL CHECK (char_length(btrim(subject_type)) BETWEEN 1 AND 120),
  subject_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_audit_events_business_created_idx
  ON business_audit_events (business_id, organization_id, created_at DESC, id);

CREATE OR REPLACE VIEW business_allocation_bucket_balances AS
SELECT business_id,
       organization_id,
       bucket,
       COALESCE(SUM(amount_delta), 0)::BIGINT AS balance
FROM business_allocation_movements
GROUP BY business_id, organization_id, bucket;

CREATE OR REPLACE VIEW business_finance_account_balances AS
WITH effective_entries AS (
  SELECT id,
         business_id,
         organization_id,
         lower(account_key) AS account_key,
         lower(entry_type) AS entry_type,
         amount,
         effect_multiplier
  FROM business_finance_entries
), movements AS (
  SELECT business_id,
         organization_id,
         account_key AS account_key,
         CASE
           WHEN account_key IN ('cash','bank','ewallet') THEN
             CASE
               WHEN entry_type IN ('sale_income','other_income','capital_income','owner_capital','receivable_payment') THEN amount * effect_multiplier
               WHEN entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase','payroll_expense','salary','rent_expense','rent','utilities_expense','utilities','transport_expense','transport','marketing_expense','marketing','equipment_expense','equipment','owner_draw','owner_drawing','payable_payment','other_expense','sale_refund') THEN -amount * effect_multiplier
               ELSE 0
             END
           ELSE 0
         END::BIGINT AS amount_delta
  FROM effective_entries
  WHERE account_key IN ('cash','bank','ewallet')

  UNION ALL

  SELECT business_id,
         organization_id,
         'receivable'::TEXT,
         CASE
           WHEN entry_type = 'sale_income' AND account_key = 'receivable' THEN amount * effect_multiplier
           WHEN entry_type = 'receivable_payment' THEN -amount * effect_multiplier
           ELSE 0
         END::BIGINT
  FROM effective_entries
  WHERE (entry_type = 'sale_income' AND account_key = 'receivable')
     OR entry_type = 'receivable_payment'

  UNION ALL

  SELECT business_id,
         organization_id,
         'payable'::TEXT,
         CASE
           WHEN entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase') AND account_key = 'payable' THEN amount * effect_multiplier
           WHEN entry_type = 'payable_payment' THEN -amount * effect_multiplier
           ELSE 0
         END::BIGINT
  FROM effective_entries
  WHERE (entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase') AND account_key = 'payable')
     OR entry_type = 'payable_payment'
)
SELECT business_id,
       organization_id,
       account_key,
       COALESCE(SUM(amount_delta), 0)::BIGINT AS balance
FROM movements
GROUP BY business_id, organization_id, account_key;

CREATE OR REPLACE FUNCTION reject_business_finance_core_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'business finance core records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS business_finance_entries_append_only ON business_finance_entries;
CREATE TRIGGER business_finance_entries_append_only
BEFORE UPDATE OR DELETE ON business_finance_entries
FOR EACH ROW EXECUTE FUNCTION reject_business_finance_core_mutation();

DROP TRIGGER IF EXISTS business_finance_commands_append_only ON business_finance_commands;
CREATE TRIGGER business_finance_commands_append_only
BEFORE UPDATE OR DELETE ON business_finance_commands
FOR EACH ROW EXECUTE FUNCTION reject_business_finance_core_mutation();

DROP TRIGGER IF EXISTS business_finance_corrections_append_only ON business_finance_entry_corrections;
CREATE TRIGGER business_finance_corrections_append_only
BEFORE UPDATE OR DELETE ON business_finance_entry_corrections
FOR EACH ROW EXECUTE FUNCTION reject_business_finance_core_mutation();

DROP TRIGGER IF EXISTS business_allocation_movements_append_only ON business_allocation_movements;
CREATE TRIGGER business_allocation_movements_append_only
BEFORE UPDATE OR DELETE ON business_allocation_movements
FOR EACH ROW EXECUTE FUNCTION reject_business_finance_core_mutation();

DROP TRIGGER IF EXISTS business_audit_events_append_only ON business_audit_events;
CREATE TRIGGER business_audit_events_append_only
BEFORE UPDATE OR DELETE ON business_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_business_finance_core_mutation();

COMMIT;
