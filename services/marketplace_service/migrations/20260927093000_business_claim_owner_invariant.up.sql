-- Enforce one active owner per business reference while allowing manager/editor grants.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_business_single_owner
    ON business_ownership_grants(content_id)
    WHERE role = 'owner' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_claim_evidence_sensitive
    ON business_claim_evidence(claim_id, is_sensitive, reviewed);

COMMENT ON TABLE business_claims IS
    'Human-reviewed ownership/management claims for externally seeded business references. Claims never create fake users.';
COMMENT ON TABLE business_claim_evidence IS
    'Private verification evidence. Never expose sensitive evidence through public business APIs.';
COMMENT ON TABLE business_ownership_grants IS
    'Access grants created by an approved claim; owner is unique per business.';
