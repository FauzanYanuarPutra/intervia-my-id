-- 20251115127050_functions_org_dependent.up.sql
-- org_owner_is_member
CREATE OR REPLACE FUNCTION public.org_owner_is_member(org_id UUID, owner_user_id UUID) RETURNS boolean AS $$
SELECT EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.org_id = org_id
            AND ou.user_id = owner_user_id
    );
$$ LANGUAGE sql STABLE;