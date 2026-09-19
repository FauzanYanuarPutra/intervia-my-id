BEGIN;

DROP VIEW IF EXISTS business_purchase_payable_balances;
DROP VIEW IF EXISTS business_sale_receivable_balances;

DROP TRIGGER IF EXISTS trg_business_payment_allocations_append_only
  ON business_payment_allocations;
DROP TRIGGER IF EXISTS trg_business_payments_append_only
  ON business_payments;
DROP FUNCTION IF EXISTS reject_business_commercial_evidence_mutation();

DROP TABLE IF EXISTS business_payment_allocations;
DROP TABLE IF EXISTS business_payments;

DROP INDEX IF EXISTS ux_business_purchases_scope_identity;
DROP INDEX IF EXISTS ux_business_sales_scope_identity;

DROP TABLE IF EXISTS business_parties;

ALTER TABLE business_document_sequences
  DROP CONSTRAINT IF EXISTS business_document_sequences_document_type_check;
ALTER TABLE business_document_sequences
  ADD CONSTRAINT business_document_sequences_document_type_check
  CHECK (document_type IN ('sale', 'purchase'));

COMMIT;
