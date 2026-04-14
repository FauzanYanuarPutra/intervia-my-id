-- 20251115126000_tables_roles_permissions.up.sql
-- roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name CITEXT UNIQUE NOT NULL,
    description TEXT,
    system BOOLEAN DEFAULT FALSE,
    role_type TEXT DEFAULT 'global',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roles_type ON roles(role_type);
CREATE TRIGGER roles_update_timestamp BEFORE
UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_no_delete_system_roles BEFORE DELETE ON roles FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_system_roles();
-- permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name CITEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER permissions_update_timestamp BEFORE
UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
-- role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY(role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
-- user_roles (global)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);