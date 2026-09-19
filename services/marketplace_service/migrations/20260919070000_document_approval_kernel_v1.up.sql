BEGIN;

ALTER TABLE business_document_sequences
  DROP CONSTRAINT IF EXISTS business_document_sequences_document_type_check;
ALTER TABLE business_document_sequences
  ADD CONSTRAINT business_document_sequences_document_type_check
  CHECK (document_type IN (
    'sale','purchase','payment',
    'quotation','sales_order','delivery','invoice','credit_note',
    'purchase_requisition','rfq','purchase_order','goods_receipt','vendor_bill','debit_note',
    'service_order','work_order'
  ));

CREATE TABLE business_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NULL,
  party_id UUID NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'quotation','sales_order','delivery','invoice','credit_note',
    'purchase_requisition','rfq','purchase_order','goods_receipt','vendor_bill','debit_note',
    'service_order','work_order'
  )),
  document_number TEXT NOT NULL CHECK (char_length(btrim(document_number)) BETWEEN 5 AND 80),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','posted','voided','reversed')),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  document_date DATE NOT NULL,
  due_date DATE NULL CHECK (due_date IS NULL OR due_date >= document_date),
  subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  source_type TEXT NULL CHECK (source_type IS NULL OR char_length(source_type) <= 80),
  source_id UUID NULL,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  issued_at TIMESTAMPTZ NULL,
  issued_by_user_id UUID NULL,
  posted_at TIMESTAMPTZ NULL,
  posted_by_user_id UUID NULL,
  voided_at TIMESTAMPTZ NULL,
  voided_by_user_id UUID NULL,
  void_reason TEXT NULL CHECK (void_reason IS NULL OR char_length(btrim(void_reason)) BETWEEN 1 AND 2000),
  reversed_at TIMESTAMPTZ NULL,
  reversed_by_user_id UUID NULL,
  reversal_reason TEXT NULL CHECK (reversal_reason IS NULL OR char_length(btrim(reversal_reason)) BETWEEN 1 AND 2000),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_documents_scope
    FOREIGN KEY (business_id,organization_id)
    REFERENCES businesses(id,organization_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_business_documents_location
    FOREIGN KEY (location_id,business_id,organization_id)
    REFERENCES business_locations(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_documents_party
    FOREIGN KEY (party_id,business_id,organization_id)
    REFERENCES business_parties(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_documents_source_pair
    CHECK ((source_type IS NULL) = (source_id IS NULL)),
  CONSTRAINT ck_business_documents_amount_math
    CHECK (total_amount = subtotal_amount - discount_amount + tax_amount),
  CONSTRAINT ck_business_documents_state_timestamps CHECK (
    (status <> 'issued' OR issued_at IS NOT NULL)
    AND (status <> 'posted' OR posted_at IS NOT NULL)
    AND (status <> 'voided' OR (voided_at IS NOT NULL AND void_reason IS NOT NULL))
    AND (status <> 'reversed' OR (reversed_at IS NOT NULL AND reversal_reason IS NOT NULL))
  ),
  UNIQUE (id,business_id,organization_id),
  UNIQUE (business_id,document_number),
  UNIQUE (business_id,idempotency_key)
);

CREATE INDEX idx_business_documents_timeline
  ON business_documents (
    business_id,organization_id,document_type,status,document_date DESC,created_at DESC,id DESC
  );
CREATE INDEX idx_business_documents_party
  ON business_documents (business_id,organization_id,party_id,document_date DESC)
  WHERE party_id IS NOT NULL;
CREATE INDEX idx_business_documents_location
  ON business_documents (business_id,organization_id,location_id,document_date DESC)
  WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX ux_business_documents_source
  ON business_documents (business_id,source_type,source_id,document_type)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE business_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  document_id UUID NOT NULL,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  product_id UUID NULL,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  quantity NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  unit_price_amount BIGINT NOT NULL CHECK (unit_price_amount >= 0),
  discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total_amount BIGINT NOT NULL CHECK (line_total_amount >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_document_lines_document
    FOREIGN KEY (document_id,business_id,organization_id)
    REFERENCES business_documents(id,business_id,organization_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_business_document_lines_product
    FOREIGN KEY (product_id,business_id,organization_id)
    REFERENCES business_products(id,business_id,organization_id)
    ON DELETE RESTRICT,
  UNIQUE (document_id,line_no)
);

CREATE INDEX idx_business_document_lines_document
  ON business_document_lines (business_id,organization_id,document_id,line_no);

CREATE TABLE business_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  from_document_id UUID NOT NULL,
  to_document_id UUID NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'converts_to','fulfills','bills','credits','debits','reverses','references'
  )),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_document_links_from
    FOREIGN KEY (from_document_id,business_id,organization_id)
    REFERENCES business_documents(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_document_links_to
    FOREIGN KEY (to_document_id,business_id,organization_id)
    REFERENCES business_documents(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_document_links_distinct
    CHECK (from_document_id <> to_document_id),
  UNIQUE (from_document_id,to_document_id,relation_type)
);

CREATE INDEX idx_business_document_links_from
  ON business_document_links (business_id,organization_id,from_document_id,created_at);
CREATE INDEX idx_business_document_links_to
  ON business_document_links (business_id,organization_id,to_document_id,created_at);

CREATE TABLE business_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    '*','quotation','sales_order','delivery','invoice','credit_note',
    'purchase_requisition','rfq','purchase_order','goods_receipt','vendor_bill','debit_note',
    'service_order','work_order'
  )),
  action_key TEXT NOT NULL CHECK (action_key IN ('issue','post','void','reverse')),
  min_amount BIGINT NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  required_role TEXT NOT NULL CHECK (char_length(btrim(required_role)) BETWEEN 1 AND 80),
  required_approvals INTEGER NOT NULL DEFAULT 1 CHECK (required_approvals BETWEEN 1 AND 5),
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_approval_rules_scope
    FOREIGN KEY (business_id,organization_id)
    REFERENCES businesses(id,organization_id)
    ON DELETE CASCADE,
  UNIQUE (id,business_id,organization_id)
);

CREATE INDEX idx_business_approval_rules_match
  ON business_approval_rules (
    business_id,organization_id,active,action_key,document_type,min_amount DESC,priority ASC
  );

CREATE TABLE business_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  document_id UUID NOT NULL,
  action_key TEXT NOT NULL CHECK (action_key IN ('issue','post','void','reverse')),
  rule_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected','cancelled','consumed')),
  required_role TEXT NOT NULL CHECK (char_length(btrim(required_role)) BETWEEN 1 AND 80),
  required_approvals INTEGER NOT NULL CHECK (required_approvals BETWEEN 1 AND 5),
  requested_by_user_id UUID NOT NULL,
  request_reason TEXT NOT NULL DEFAULT '' CHECK (char_length(request_reason) <= 2000),
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  decided_at TIMESTAMPTZ NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_approval_requests_document
    FOREIGN KEY (document_id,business_id,organization_id)
    REFERENCES business_documents(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_approval_requests_rule
    FOREIGN KEY (rule_id,business_id,organization_id)
    REFERENCES business_approval_rules(id,business_id,organization_id)
    ON DELETE RESTRICT,
  UNIQUE (id,business_id,organization_id),
  UNIQUE (business_id,idempotency_key)
);

CREATE UNIQUE INDEX ux_business_approval_requests_active
  ON business_approval_requests (document_id,action_key)
  WHERE state IN ('pending','approved');
CREATE INDEX idx_business_approval_requests_queue
  ON business_approval_requests (
    business_id,organization_id,state,created_at ASC,id ASC
  );

CREATE TABLE business_approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  approval_request_id UUID NOT NULL,
  approver_user_id UUID NOT NULL,
  approver_role TEXT NOT NULL CHECK (char_length(btrim(approver_role)) BETWEEN 1 AND 80),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_approval_decisions_request
    FOREIGN KEY (approval_request_id,business_id,organization_id)
    REFERENCES business_approval_requests(id,business_id,organization_id)
    ON DELETE RESTRICT,
  UNIQUE (approval_request_id,approver_user_id)
);

CREATE INDEX idx_business_approval_decisions_request
  ON business_approval_decisions (
    business_id,organization_id,approval_request_id,created_at,id
  );

CREATE OR REPLACE FUNCTION reject_business_document_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_business_document_links_append_only
BEFORE UPDATE OR DELETE ON business_document_links
FOR EACH ROW EXECUTE FUNCTION reject_business_document_evidence_mutation();

CREATE TRIGGER trg_business_approval_decisions_append_only
BEFORE UPDATE OR DELETE ON business_approval_decisions
FOR EACH ROW EXECUTE FUNCTION reject_business_document_evidence_mutation();

COMMIT;
