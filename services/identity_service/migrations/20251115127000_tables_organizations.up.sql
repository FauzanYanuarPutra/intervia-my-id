-- 20251115127000_tables_organizations.up.sql
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name CITEXT UNIQUE NOT NULL,
    slug CITEXT UNIQUE,
    owner_user_id UUID REFERENCES users(id) ON DELETE
    SET NULL,
        deleted_at TIMESTAMPTZ,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS organizations_update_timestamp ON organizations;
CREATE TRIGGER organizations_update_timestamp BEFORE
UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
DROP TRIGGER IF EXISTS organizations_normalize_slug ON organizations;
CREATE TRIGGER organizations_normalize_slug BEFORE
INSERT
    OR
UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION public.normalize_org_slug();
DROP TRIGGER IF EXISTS organizations_track_updated_by ON organizations;
CREATE TRIGGER organizations_track_updated_by BEFORE
UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION public.track_updated_by();
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_deleted ON organizations(deleted_at);
CREATE TABLE IF NOT EXISTS organization_users (
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_users_user ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org ON organization_users(org_id);
-- ensure owner is member check (we add the constraint in the next step)
