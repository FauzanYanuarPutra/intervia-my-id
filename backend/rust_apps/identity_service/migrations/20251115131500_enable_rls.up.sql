-- 20251115131500_enable_rls.up.sql
-- Enable RLS with safe policies (run when identity_service sets app.current_user_id or app.is_system_request)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_is_member ON organizations USING (
    current_setting('app.is_system_request', true) = 'true'
    OR public.is_system_admin(
        current_setting('app.current_user_id', true)::uuid
    )
    OR EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.org_id = organizations.id
            AND ou.user_id = current_setting('app.current_user_id', true)::uuid
    )
);
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_users_member ON organization_users USING (
    current_setting('app.is_system_request', true) = 'true'
    OR public.is_system_admin(
        current_setting('app.current_user_id', true)::uuid
    )
    OR user_id = current_setting('app.current_user_id', true)::uuid
);