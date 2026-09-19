BEGIN;

-- Commercial Core V1
-- First-class counterparty and payment/allocation primitives shared by every
-- business type. Financial evidence remains append-only; party master data is
-- versioned mutable reference data.

ALTER TABLE business_document_sequences
  DROP CONSTRAINT IF EXISTS business_document_sequences_document_type_check;
ALTER TABLE business_document_sequences
  ADD CONSTRAINT business_document_sequences_document_type_check
  CHECK (document_type IN ('sale', 'purchase', 'payment'));

CREATE TABLE IF NOT EXISTS business_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  party_kind TEXT NOT NULL
    CHECK (party_kind IN ('customer','supplier','both','other')),
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 200),
  legal_name TEXT NULL CHECK (legal_name IS NULL OR char_length(btrim(legal_name)) <= 250),
  phone TEXT NULL CHECK (phone IS NULL OR char_length(btrim(phone)) <= 64),
  email TEXT NULL CHECK (email IS NULL OR char_length(btrim(email)) <= 254),
  tax_identifier TEXT NULL CHECK (tax_identifier IS NULL OR char_length(btrim(tax_identifier)) <= 100),
  address TEXT NULL CHECK (address IS NULL OR char_length(btrim(address)) <= 2000),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_parties_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE CASCADE,
  UNIQUE (id, business_id, organization_id),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX idx_business_parties_directory
  ON business_parties (business_id, organization_id, status, party_kind, display_name, id);

CREATE UNIQUE INDEX ux_business_parties_email
  ON business_parties (business_id, lower(email))
  WHERE email IS NOT NULL AND status='active';

CREATE UNIQUE INDEX ux_business_parties_tax_identifier
  ON business_parties (business_id, tax_identifier)
  WHERE tax_identifier IS NOT NULL AND status='active';

CREATE UNIQUE INDEX ux_business_sales_scope_identity
  ON business_sales (id, business_id, organization_id);

CREATE UNIQUE INDEX ux_business_purchases_scope_identity
  ON business_purchases (id, business_id, organization_id);

CREATE TABLE business_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  document_number TEXT NOT NULL CHECK (char_length(btrim(document_number)) BETWEEN 5 AND 80),
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  account_key TEXT NOT NULL CHECK (account_key IN ('cash','bank','ewallet')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  party_id UUID NULL,
  occurred_on DATE NOT NULL,
  reference TEXT NOT NULL DEFAULT '' CHECK (char_length(reference) <= 200),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  effect_multiplier SMALLINT NOT NULL DEFAULT 1 CHECK (effect_multiplier IN (-1,1)),
  reversal_of_payment_id UUID NULL UNIQUE REFERENCES business_payments(id) ON DELETE RESTRICT,
  finance_entry_id UUID NOT NULL UNIQUE REFERENCES business_finance_entries(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_payments_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_business_payments_party_scope
    FOREIGN KEY (party_id, business_id, organization_id)
    REFERENCES business_parties(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_payments_reversal_shape
    CHECK (
      (effect_multiplier = 1 AND reversal_of_payment_id IS NULL)
      OR (effect_multiplier = -1 AND reversal_of_payment_id IS NOT NULL)
    ),
  UNIQUE (id, business_id, organization_id),
  UNIQUE (business_id, document_number),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX idx_business_payments_timeline
  ON business_payments (
    business_id, organization_id, occurred_on DESC, created_at DESC, id DESC
  );
CREATE INDEX idx_business_payments_party
  ON business_payments (business_id, organization_id, party_id, occurred_on DESC)
  WHERE party_id IS NOT NULL;

CREATE TABLE business_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  payment_id UUID NOT NULL,
  sale_id UUID NULL,
  purchase_id UUID NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_payment_allocations_payment_scope
    FOREIGN KEY (payment_id, business_id, organization_id)
    REFERENCES business_payments(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_payment_allocations_sale_scope
    FOREIGN KEY (sale_id, business_id, organization_id)
    REFERENCES business_sales(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_payment_allocations_purchase_scope
    FOREIGN KEY (purchase_id, business_id, organization_id)
    REFERENCES business_purchases(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_payment_allocations_target
    CHECK (
      (sale_id IS NOT NULL AND purchase_id IS NULL)
      OR (sale_id IS NULL AND purchase_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_business_payment_allocations_sale
  ON business_payment_allocations (payment_id, sale_id)
  WHERE sale_id IS NOT NULL;
CREATE UNIQUE INDEX ux_business_payment_allocations_purchase
  ON business_payment_allocations (payment_id, purchase_id)
  WHERE purchase_id IS NOT NULL;
CREATE INDEX idx_business_payment_allocations_sale_lookup
  ON business_payment_allocations (business_id, organization_id, sale_id)
  WHERE sale_id IS NOT NULL;
CREATE INDEX idx_business_payment_allocations_purchase_lookup
  ON business_payment_allocations (business_id, organization_id, purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE OR REPLACE VIEW business_sale_receivable_balances AS
SELECT
  sale.id AS sale_id,
  sale.business_id,
  sale.organization_id,
  sale.document_number,
  sale.currency,
  sale.occurred_on,
  sale.final_amount AS original_amount,
  COALESCE(
    SUM(allocation.amount * payment.effect_multiplier)
      FILTER (WHERE payment.id IS NOT NULL),
    0
  )::BIGINT AS paid_amount,
  (
    sale.final_amount - COALESCE(
      SUM(allocation.amount * payment.effect_multiplier)
        FILTER (WHERE payment.id IS NOT NULL),
      0
    )
  )::BIGINT AS outstanding_amount
FROM business_sales sale
LEFT JOIN business_payment_allocations allocation
  ON allocation.sale_id=sale.id
 AND allocation.business_id=sale.business_id
 AND allocation.organization_id=sale.organization_id
LEFT JOIN business_payments payment
  ON payment.id=allocation.payment_id
 AND payment.business_id=sale.business_id
 AND payment.organization_id=sale.organization_id
WHERE sale.account_key='receivable'
GROUP BY sale.id, sale.business_id, sale.organization_id,
         sale.document_number, sale.currency, sale.occurred_on, sale.final_amount;

CREATE OR REPLACE VIEW business_purchase_payable_balances AS
SELECT
  purchase.id AS purchase_id,
  purchase.business_id,
  purchase.organization_id,
  purchase.document_number,
  purchase.currency,
  purchase.occurred_on,
  purchase.total_amount AS original_amount,
  COALESCE(
    SUM(allocation.amount * payment.effect_multiplier)
      FILTER (WHERE payment.id IS NOT NULL),
    0
  )::BIGINT AS paid_amount,
  (
    purchase.total_amount - COALESCE(
      SUM(allocation.amount * payment.effect_multiplier)
        FILTER (WHERE payment.id IS NOT NULL),
      0
    )
  )::BIGINT AS outstanding_amount
FROM business_purchases purchase
LEFT JOIN business_payment_allocations allocation
  ON allocation.purchase_id=purchase.id
 AND allocation.business_id=purchase.business_id
 AND allocation.organization_id=purchase.organization_id
LEFT JOIN business_payments payment
  ON payment.id=allocation.payment_id
 AND payment.business_id=purchase.business_id
 AND payment.organization_id=purchase.organization_id
WHERE purchase.account_key='payable'
GROUP BY purchase.id, purchase.business_id, purchase.organization_id,
         purchase.document_number, purchase.currency, purchase.occurred_on, purchase.total_amount;

CREATE OR REPLACE FUNCTION reject_business_commercial_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_business_payments_append_only
BEFORE UPDATE OR DELETE ON business_payments
FOR EACH ROW EXECUTE FUNCTION reject_business_commercial_evidence_mutation();

CREATE TRIGGER trg_business_payment_allocations_append_only
BEFORE UPDATE OR DELETE ON business_payment_allocations
FOR EACH ROW EXECUTE FUNCTION reject_business_commercial_evidence_mutation();

COMMIT;
