BEGIN;

DROP TRIGGER IF EXISTS trg_business_payment_allocations_counterparty
  ON business_payment_allocations;
DROP FUNCTION IF EXISTS validate_business_payment_allocation_counterparty();

DROP VIEW business_purchase_payable_balances;
CREATE VIEW business_purchase_payable_balances AS
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

DROP VIEW business_sale_receivable_balances;
CREATE VIEW business_sale_receivable_balances AS
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

DROP TRIGGER IF EXISTS trg_business_purchases_validate_party
  ON business_purchases;
DROP TRIGGER IF EXISTS trg_business_sales_validate_party
  ON business_sales;
DROP FUNCTION IF EXISTS validate_business_document_party();

DROP INDEX IF EXISTS idx_business_purchases_party;
DROP INDEX IF EXISTS idx_business_sales_party;

ALTER TABLE business_purchases
  DROP CONSTRAINT IF EXISTS fk_business_purchases_party_scope,
  DROP COLUMN IF EXISTS party_id;

ALTER TABLE business_sales
  DROP CONSTRAINT IF EXISTS fk_business_sales_party_scope,
  DROP COLUMN IF EXISTS party_id;

COMMIT;
