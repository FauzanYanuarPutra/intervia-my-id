-- Lajukan Personal AI
-- Recipient-specific memory consent + durable request idempotency.
--
-- Design:
--   * Agent-owner memory preference does NOT grant memory consent for viewers.
--   * (agent_id, viewer_id) stores viewer-specific opt-in.
--   * (viewer_id, client_ref) is the durable idempotency identity.
--   * request_hash prevents a client_ref from being reused for a different body.
--   * processing rows use a lease so abandoned provider calls can be reclaimed.
--
-- This migration intentionally keeps the status contract limited to
-- `processing` and `completed` because that is the existing application model.
-- Provider failures are retried after lease expiry rather than becoming a
-- separate schema state.

CREATE TABLE IF NOT EXISTS public.personal_ai_memory_preferences (
    agent_id TEXT NOT NULL
        REFERENCES public.personal_ai_agents(id)
        ON DELETE CASCADE,

    viewer_id TEXT NOT NULL,

    enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT personal_ai_memory_preferences_pkey
        PRIMARY KEY (agent_id, viewer_id),

    CONSTRAINT personal_ai_memory_preferences_agent_id_nonempty
        CHECK (btrim(agent_id) <> ''),

    CONSTRAINT personal_ai_memory_preferences_viewer_id_nonempty
        CHECK (btrim(viewer_id) <> '')
);

COMMENT ON TABLE public.personal_ai_memory_preferences IS
  'Viewer-specific consent for an agent to use Personal AI memory. Owner consent never implies viewer consent.';

COMMENT ON COLUMN public.personal_ai_memory_preferences.enabled IS
  'Explicit viewer opt-in. False is the privacy-safe default.';

CREATE INDEX IF NOT EXISTS personal_ai_memory_preferences_viewer_idx
    ON public.personal_ai_memory_preferences (viewer_id, updated_at DESC);


CREATE TABLE IF NOT EXISTS public.personal_ai_chat_requests (
    viewer_id TEXT NOT NULL,
    client_ref TEXT NOT NULL,

    agent_id TEXT NOT NULL
        REFERENCES public.personal_ai_agents(id)
        ON DELETE CASCADE,

    -- Canonical hash of the request identity/body. Keep TEXT because the
    -- application owns the hash encoding/algorithm.
    request_hash TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'processing',

    -- Persist the completed application response so exact retries can return
    -- it without invoking an AI provider again.
    response JSONB NULL,

    -- A processing request can be reclaimed only after this timestamp.
    lease_expires_at TIMESTAMPTZ NOT NULL
        DEFAULT (NOW() + INTERVAL '10 minutes'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT personal_ai_chat_requests_pkey
        PRIMARY KEY (viewer_id, client_ref),

    CONSTRAINT personal_ai_chat_requests_viewer_id_nonempty
        CHECK (btrim(viewer_id) <> ''),

    CONSTRAINT personal_ai_chat_requests_client_ref_nonempty
        CHECK (btrim(client_ref) <> ''),

    CONSTRAINT personal_ai_chat_requests_agent_id_nonempty
        CHECK (btrim(agent_id) <> ''),

    CONSTRAINT personal_ai_chat_requests_request_hash_nonempty
        CHECK (btrim(request_hash) <> ''),

    CONSTRAINT personal_ai_chat_requests_status_check
        CHECK (status IN ('processing', 'completed')),

    CONSTRAINT personal_ai_chat_requests_completed_response_check
        CHECK (status <> 'completed' OR response IS NOT NULL)
);

COMMENT ON TABLE public.personal_ai_chat_requests IS
  'Durable idempotency ledger for Personal AI provider requests.';

COMMENT ON COLUMN public.personal_ai_chat_requests.client_ref IS
  'Client-generated idempotency reference, scoped by viewer_id.';

COMMENT ON COLUMN public.personal_ai_chat_requests.request_hash IS
  'Canonical request hash used to reject reuse of client_ref with a different payload.';

COMMENT ON COLUMN public.personal_ai_chat_requests.lease_expires_at IS
  'Processing lease expiry; expired processing rows may be safely reclaimed by application logic.';

CREATE INDEX IF NOT EXISTS personal_ai_chat_requests_agent_updated_idx
    ON public.personal_ai_chat_requests (agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS personal_ai_chat_requests_processing_lease_idx
    ON public.personal_ai_chat_requests (lease_expires_at)
    WHERE status = 'processing';


-- Keep updated_at trustworthy even when a caller forgets to set it.
CREATE OR REPLACE FUNCTION public.personal_ai_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personal_ai_memory_preferences_touch_updated_at
    ON public.personal_ai_memory_preferences;

CREATE TRIGGER personal_ai_memory_preferences_touch_updated_at
BEFORE UPDATE ON public.personal_ai_memory_preferences
FOR EACH ROW
EXECUTE FUNCTION public.personal_ai_touch_updated_at();

DROP TRIGGER IF EXISTS personal_ai_chat_requests_touch_updated_at
    ON public.personal_ai_chat_requests;

CREATE TRIGGER personal_ai_chat_requests_touch_updated_at
BEFORE UPDATE ON public.personal_ai_chat_requests
FOR EACH ROW
EXECUTE FUNCTION public.personal_ai_touch_updated_at();