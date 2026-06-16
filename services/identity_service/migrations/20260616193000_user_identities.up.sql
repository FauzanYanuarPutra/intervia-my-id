CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS core;

ALTER TABLE core.users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS core.user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email CITEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT user_identities_provider_check CHECK (provider <> ''),
    CONSTRAINT user_identities_provider_user_id_check CHECK (provider_user_id <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_subject
    ON core.user_identities(provider, provider_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_user
    ON core.user_identities(provider, user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
    ON core.user_identities(user_id);

DROP TRIGGER IF EXISTS user_identities_update_timestamp ON core.user_identities;
CREATE TRIGGER user_identities_update_timestamp
BEFORE UPDATE ON core.user_identities
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
