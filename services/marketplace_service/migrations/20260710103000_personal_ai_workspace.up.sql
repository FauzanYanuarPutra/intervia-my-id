CREATE TABLE IF NOT EXISTS personal_ai_agents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private',
    instructions TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '',
    model_preference TEXT NOT NULL DEFAULT 'auto',
    temperature REAL NOT NULL DEFAULT 0.4,
    quick_buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    starter_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
    memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    share_id TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ai_agents_owner_idx
    ON personal_ai_agents(owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS personal_ai_agents_share_idx
    ON personal_ai_agents(share_id);

CREATE TABLE IF NOT EXISTS personal_ai_threads (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Chat baru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ai_threads_owner_agent_idx
    ON personal_ai_threads(owner_id, agent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS personal_ai_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES personal_ai_threads(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ai_messages_thread_idx
    ON personal_ai_messages(thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS personal_ai_memories (
    agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(agent_id, owner_id)
);
