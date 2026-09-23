-- Lajukan Personal AI
-- Idempotent repair/guard migration for production schema drift.
--
-- The release pipeline owns migrations in staging/production. This migration
-- repairs missing additive Personal AI structures instead of relying only on
-- historical migration state.

CREATE TABLE IF NOT EXISTS public.personal_ai_agents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'AI Usaha Saya',
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private',
    instructions TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '',
    model_preference TEXT NOT NULL DEFAULT 'auto',
    temperature REAL NOT NULL DEFAULT 0.4,
    quick_buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    starter_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
    builder_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    share_id TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.personal_ai_agents
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS model_preference TEXT NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS temperature REAL NOT NULL DEFAULT 0.4,
    ADD COLUMN IF NOT EXISTS quick_buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS starter_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS builder_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS share_id TEXT,
    ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.personal_ai_agents
SET share_id = CONCAT(
    'repair-', id, '-', md5(random()::text || clock_timestamp()::text)
)
WHERE share_id IS NULL OR btrim(share_id) = '';

ALTER TABLE public.personal_ai_agents
    ALTER COLUMN share_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS personal_ai_agents_share_idx
    ON public.personal_ai_agents(share_id);

CREATE INDEX IF NOT EXISTS personal_ai_agents_owner_idx
    ON public.personal_ai_agents(owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS personal_ai_agents_builder_template_idx
    ON public.personal_ai_agents ((builder_config->>'templateId'));

CREATE TABLE IF NOT EXISTS public.personal_ai_threads (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES public.personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Chat baru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ai_threads_owner_agent_idx
    ON public.personal_ai_threads(owner_id, agent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.personal_ai_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES public.personal_ai_threads(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES public.personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ai_messages_thread_idx
    ON public.personal_ai_messages(thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.personal_ai_memories (
    agent_id TEXT NOT NULL REFERENCES public.personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(agent_id, owner_id)
);

CREATE TABLE IF NOT EXISTS public.personal_ai_memory_preferences (
    agent_id TEXT NOT NULL REFERENCES public.personal_ai_agents(id) ON DELETE CASCADE,
    viewer_id TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(agent_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS personal_ai_memory_preferences_viewer_idx
    ON public.personal_ai_memory_preferences(viewer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.personal_ai_chat_requests (
    viewer_id TEXT NOT NULL,
    client_ref TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    response JSONB NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(viewer_id, client_ref)
);

CREATE INDEX IF NOT EXISTS personal_ai_chat_requests_processing_lease_idx
    ON public.personal_ai_chat_requests(lease_expires_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS personal_ai_chat_requests_agent_updated_idx
    ON public.personal_ai_chat_requests(agent_id, updated_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'personal_ai_agents'
          AND column_name = 'builder_config'
    ) THEN
        RAISE EXCEPTION 'personal_ai_agents.builder_config is missing after repair migration';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'personal_ai_agents'
          AND column_name = 'memory_enabled'
    ) THEN
        RAISE EXCEPTION 'personal_ai_agents.memory_enabled is missing after repair migration';
    END IF;

    IF to_regclass('public.personal_ai_memory_preferences') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_memory_preferences is missing after repair migration';
    END IF;

    IF to_regclass('public.personal_ai_chat_requests') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_chat_requests is missing after repair migration';
    END IF;
END;
$$;
