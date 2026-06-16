-- 20251115130000_triggers_audit_attach.up.sql
-- Attach audit triggers
DROP TRIGGER IF EXISTS audit_users_changes ON core.users;
CREATE TRIGGER audit_users_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON core.users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
DROP TRIGGER IF EXISTS audit_user_profiles_changes ON core.user_profiles;
CREATE TRIGGER audit_user_profiles_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
DROP TRIGGER IF EXISTS audit_organizations_changes ON organizations;
CREATE TRIGGER audit_organizations_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
DROP TRIGGER IF EXISTS audit_organization_users_changes ON organization_users;
CREATE TRIGGER audit_organization_users_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON organization_users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
DROP TRIGGER IF EXISTS audit_roles_changes ON roles;
CREATE TRIGGER audit_roles_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON roles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
DROP TRIGGER IF EXISTS audit_permissions_changes ON permissions;
CREATE TRIGGER audit_permissions_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON permissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
-- attach prevent_remove_last_org_admin
DROP TRIGGER IF EXISTS trg_org_user_no_last_admin ON organization_users;
CREATE TRIGGER trg_org_user_no_last_admin BEFORE DELETE ON organization_users FOR EACH ROW EXECUTE FUNCTION public.prevent_remove_last_org_admin();
