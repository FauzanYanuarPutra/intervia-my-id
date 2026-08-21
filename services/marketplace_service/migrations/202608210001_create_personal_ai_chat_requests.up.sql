-- Lajukan Marketplace
-- Personal AI chat request idempotency / replay-safe request claims.
--
-- Ownership:
--   marketplace_service migrations
--   Next.js Personal AI store/runtime remains DDL-free.
--
-- Additive migration: existing Personal AI data is not modified.

CREATE TABLE IF NOT EXISTS personal_ai_chat_requests (
    viewer_id        TEXT        NOT NULL,
    client_ref       TEXT        NOT NULL,
    agent_id         TEXT        NOT NULL,
    request_hash     TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'processing',
    response         JSONB       NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT personal_ai_chat_requests_pkey
        PRIMARY KEY (viewer_id, client_ref),

    CONSTRAINT personal_ai_chat_requests_client_ref_check
        CHECK (char_length(client_ref) BETWEEN 12 AND 128),

    CONSTRAINT personal_ai_chat_requests_request_hash_check
        CHECK (
            char_length(request_hash) = 64
            AND request_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT personal_ai_chat_requests_status_check
        CHECK (status IN ('processing', 'completed'))
);

-- Used when a processing claim lease expires and a request may be reclaimed.
CREATE INDEX IF NOT EXISTS idx_personal_ai_chat_requests_processing_lease
    ON personal_ai_chat_requests (lease_expires_at)
    WHERE status = 'processing';

-- Bounded diagnostics / cleanup by agent and recency.
CREATE INDEX IF NOT EXISTS idx_personal_ai_chat_requests_agent_updated
    ON personal_ai_chat_requests (agent_id, updated_at DESC);

COMMENT ON TABLE personal_ai_chat_requests IS
    'Idempotency claims and completed response cache for Personal AI chat requests.';

COMMENT ON COLUMN personal_ai_chat_requests.viewer_id IS
    'Authenticated viewer/user id owning this idempotency claim.';

COMMENT ON COLUMN personal_ai_chat_requests.client_ref IS
    'Client-generated idempotency reference, unique per viewer.';

COMMENT ON COLUMN personal_ai_chat_requests.request_hash IS
    'Lowercase SHA-256 request fingerprint used to reject client_ref payload reuse.';

COMMENT ON COLUMN personal_ai_chat_requests.lease_expires_at IS
    'Expiry of a processing claim; expired claims may be safely reclaimed.';

COMMENT ON COLUMN personal_ai_chat_requests.response IS
    'Completed normalized Personal AI response cached for idempotent replay.';