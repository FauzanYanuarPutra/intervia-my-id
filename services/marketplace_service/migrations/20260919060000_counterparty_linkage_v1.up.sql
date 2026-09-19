BEGIN;

ALTER TABLE business_sales
  ADD COLUMN party_id UUID NULL;

ALTER TABLE business_sales
  ADD CONSTRAINT fk_business_sales_party_scope
  FOREIGN KEY (party_id, business_id, organization_id)
  REFERENCES business_parties(id, business_id, organization_id)
  ON DELETE RESTRICT;

ALTER TABLE business_purchases
  ADD COLUMN party_id UUID NULL;

ALTER TABLE business_purchases
  ADD CONSTRAINT fk_business_purchases_party_scope
  FOREIGN KEY (party_id, business_id, organization_id)
  REFERENCES business_parties(id, business_id, organization_id)
  ON DELETE RESTRICT;

CREATE INDEX idx_business_sales_party
  ON business_sales (business_id, organization_id, party_id, occurred_on DESC)
  WHERE party_id IS NOT NULL;

CREATE INDEX idx_business_purchases_party
  ON business_purchases (business_id, organization_id, party_id, occurred_on DESC)
  WHERE party_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_business_document_party()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  party_kind_value TEXT;
  party_status_value TEXT;
BEGIN
  IF TG_TABLE_NAME = 'business_sales' THEN
    IF NEW.account_key = 'receivable' AND NEW.party_id IS NULL THEN
      RAISE EXCEPTION 'receivable sale requires customer party';
    END IF;
    IF NEW.party_id IS NOT NULL THEN
      SELECT party_kind, status
      INTO party_kind_value, party_status_value
      FROM business_parties
      WHERE id=NEW.party_id
        AND business_id=NEW.business_id
        AND organization_id=NEW.organization_id;

      IF party_status_value IS DISTINCT FROM 'active'
         OR party_kind_value NOT IN ('customer','both') THEN
        RAISE EXCEPTION 'sale party must be active customer';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'business_purchases' THEN
    IF NEW.account_key = 'payable' AND NEW.party_id IS NULL THEN
      RAISE EXCEPTION 'payable purchase requires supplier party';
    END IF;
    IF NEW.party_id IS NOT NULL THEN
      SELECT party_kind, status
      INTO party_kind_value, party_status_value
      FROM business_parties
      WHERE id=NEW.party_id
        AND business_id=NEW.business_id
        AND organization_id=NEW.organization_id;

      IF party_status_value IS DISTINCT FROM 'active'
         OR party_kind_value NOT IN ('supplier','both') THEN
        RAISE EXCEPTION 'purchase party must be active supplier';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_sales_validate_party
BEFORE INSERT OR UPDATE OF party_id, account_key
ON business_sales
FOR EACH ROW EXECUTE FUNCTION validate_business_document_party();

CREATE TRIGGER trg_business_purchases_validate_party
BEFORE INSERT OR UPDATE OF party_id, account_key
ON business_purchases
FOR EACH ROW EXECUTE FUNCTION validate_business_document_party();

DROP VIEW business_sale_receivable_balances;
CREATE VIEW business_sale_receivable_balances AS
SELECT
  sale.id AS sale_id,
  sale.business_id,
  sale.organization_id,
  sale.party_id,
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
GROUP BY sale.id, sale.business_id, sale.organization_id, sale.party_id,
         sale.document_number, sale.currency, sale.occurred_on, sale.final_amount;

DROP VIEW business_purchase_payable_balances;
CREATE VIEW business_purchase_payable_balances AS
SELECT
  purchase.id AS purchase_id,
  purchase.business_id,
  purchase.organization_id,
  purchase.party_id,
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
GROUP BY purchase.id, purchase.business_id, purchase.organization_id, purchase.party_id,
         purchase.document_number, purchase.currency, purchase.occurred_on, purchase.total_amount;

CREATE OR REPLACE FUNCTION validate_business_payment_allocation_counterparty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_direction TEXT;
  payment_currency CHAR(3);
  payment_party UUID;
  document_currency CHAR(3);
  document_party UUID;
  document_account TEXT;
BEGIN
  SELECT direction, currency, party_id
    INTO payment_direction, payment_currency, payment_party
  FROM business_payments
  WHERE id=NEW.payment_id
    AND business_id=NEW.business_id
    AND organization_id=NEW.organization_id;

  IF NEW.sale_id IS NOT NULL THEN
    SELECT currency, party_id, account_key
      INTO document_currency, document_party, document_account
    FROM business_sales
    WHERE id=NEW.sale_id
      AND business_id=NEW.business_id
      AND organization_id=NEW.organization_id;

    IF payment_direction <> 'incoming' OR document_account <> 'receivable' THEN
      RAISE EXCEPTION 'sale allocation requires incoming receivable payment';
    END IF;
  ELSE
    SELECT currency, party_id, account_key
      INTO document_currency, document_party, document_account
    FROM business_purchases
    WHERE id=NEW.purchase_id
      AND business_id=NEW.business_id
      AND organization_id=NEW.organization_id;

    IF payment_direction <> 'outgoing' OR document_account <> 'payable' THEN
      RAISE EXCEPTION 'purchase allocation requires outgoing payable payment';
    END IF;
  END IF;

  IF document_currency IS DISTINCT FROM payment_currency THEN
    RAISE EXCEPTION 'payment allocation currency mismatch';
  END IF;

  IF document_party IS NOT NULL
     AND payment_party IS DISTINCT FROM document_party THEN
    RAISE EXCEPTION 'payment allocation counterparty mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_payment_allocations_counterparty
BEFORE INSERT ON business_payment_allocations
FOR EACH ROW EXECUTE FUNCTION validate_business_payment_allocation_counterparty();

COMMIT;
