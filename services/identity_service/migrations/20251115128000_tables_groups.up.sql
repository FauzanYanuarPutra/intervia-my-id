-- 20251115128000_tables_groups.up.sql
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name CITEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);
DROP TRIGGER IF EXISTS groups_update_timestamp ON groups;
CREATE TRIGGER groups_update_timestamp BEFORE
UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE INDEX IF NOT EXISTS idx_group_org ON groups(org_id);
CREATE TABLE IF NOT EXISTS group_users (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_users_user ON group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_group_users_group ON group_users(group_id);
CREATE TABLE IF NOT EXISTS group_roles (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY(group_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_group_roles_group ON group_roles(group_id);
