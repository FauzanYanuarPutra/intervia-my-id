-- 20251115130000_triggers_audit_attach.up.sql
-- Attach audit triggers
CREATE TRIGGER audit_users_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
CREATE TRIGGER audit_user_profiles_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON user_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
CREATE TRIGGER audit_organizations_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
CREATE TRIGGER audit_organization_users_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON organization_users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
CREATE TRIGGER audit_roles_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON roles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
CREATE TRIGGER audit_permissions_changes
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON permissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();
-- attach prevent_remove_last_org_admin
CREATE TRIGGER trg_org_user_no_last_admin BEFORE DELETE ON organization_users FOR EACH ROW EXECUTE FUNCTION public.prevent_remove_last_org_admin();