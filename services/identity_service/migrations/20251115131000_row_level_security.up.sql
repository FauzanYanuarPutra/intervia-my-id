-- 20251115131000_row_level_security.up.sql
-- RLS helpers (will be enabled later; safe policies provided)
CREATE OR REPLACE FUNCTION public.is_system_admin(uid uuid) RETURNS boolean AS $$
SELECT EXISTS (
        SELECT 1
        FROM core.user_roles ur
            JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = uid
            AND lower(r.name) = 'super_admin'
    );
$$ LANGUAGE sql STABLE;
-- DO NOT ENABLE RLS HERE AUTOMATICALLY.
-- Use the next migration (enable_rls) to activate RLS after identity_service supports session-setting.