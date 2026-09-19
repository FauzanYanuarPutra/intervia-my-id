BEGIN;

DROP TRIGGER IF EXISTS trg_business_approval_decisions_append_only
  ON business_approval_decisions;
DROP TRIGGER IF EXISTS trg_business_document_links_append_only
  ON business_document_links;
DROP FUNCTION IF EXISTS reject_business_document_evidence_mutation();

DROP TABLE IF EXISTS business_approval_decisions;
DROP INDEX IF EXISTS ux_business_approval_requests_active;
DROP TABLE IF EXISTS business_approval_requests;
DROP TABLE IF EXISTS business_approval_rules;
DROP TABLE IF EXISTS business_document_links;
DROP TABLE IF EXISTS business_document_lines;
DROP TABLE IF EXISTS business_documents;

ALTER TABLE business_document_sequences
  DROP CONSTRAINT IF EXISTS business_document_sequences_document_type_check;
ALTER TABLE business_document_sequences
  ADD CONSTRAINT business_document_sequences_document_type_check
  CHECK (document_type IN ('sale','purchase','payment'));

COMMIT;
