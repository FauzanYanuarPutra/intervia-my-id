-- 20251115125000_tables_users.up.sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- user_status enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'user_status'
) THEN CREATE TYPE user_status AS ENUM ('active', 'disabled', 'banned', 'pending');
END IF;
END $$;
-- users
CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash TEXT NOT NULL,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT,
    phone_verified BOOLEAN DEFAULT FALSE,
    status user_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts SMALLINT DEFAULT 0,
    lockout_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    public_key_jwks JSONB,
    actor_id UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT users_email_format CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT users_is_active_check CHECK (is_active = (status = 'active'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON core.users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON core.users(status);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON core.users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_locked ON core.users(lockout_expires_at)
WHERE lockout_expires_at IS NOT NULL;
-- triggers
DROP TRIGGER IF EXISTS users_update_timestamp ON core.users;
CREATE TRIGGER users_update_timestamp BEFORE
UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
DROP TRIGGER IF EXISTS users_reset_login_attempts ON core.users;
CREATE TRIGGER users_reset_login_attempts BEFORE
UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.reset_login_attempts_on_password_change();
DROP TRIGGER IF EXISTS users_track_updated_by ON core.users;
CREATE TRIGGER users_track_updated_by BEFORE
UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.track_updated_by();
-- user_profiles
CREATE TABLE IF NOT EXISTS core.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    full_name TEXT,
    bio TEXT,
    picture TEXT,
    username CITEXT UNIQUE,
    birthdate DATE,
    location TEXT,
    search_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'simple',
            coalesce(full_name, '') || ' ' || coalesce(bio, '')
        )
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_tsv ON core.user_profiles USING gin(search_tsv);
DROP TRIGGER IF EXISTS user_profiles_normalize_username ON core.user_profiles;
CREATE TRIGGER user_profiles_normalize_username BEFORE
INSERT
    OR
UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_username();
DROP TRIGGER IF EXISTS user_profiles_update_timestamp ON core.user_profiles;
CREATE TRIGGER user_profiles_update_timestamp BEFORE
UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();