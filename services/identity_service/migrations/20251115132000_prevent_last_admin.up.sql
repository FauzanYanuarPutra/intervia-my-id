-- 20251115132000_prevent_last_admin.up.sql 
-- Prevent removing the last org_admin from organization_users
CREATE OR REPLACE FUNCTION public.prevent_remove_last_org_admin() RETURNS TRIGGER AS $$
DECLARE admin_count INT;
org uuid;
role_uuid uuid;
BEGIN IF TG_OP = 'DELETE' THEN org := OLD.org_id;
-- find role id for 'org_admin' (if missing, skip)
SELECT id INTO role_uuid
FROM roles
WHERE lower(name) = 'org_admin'
LIMIT 1;
IF role_uuid IS NULL THEN RETURN OLD;
END IF;
-- Check how many admins are left for this organization
SELECT COUNT(*) INTO admin_count
FROM organization_users
WHERE org_id = org
    AND role_id = role_uuid;
-- if deleting an admin row and it is the last one, prevent
IF OLD.role_id = role_uuid
AND admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove last org_admin from organization %',
org;
END IF;
END IF;
RETURN OLD;
END;
$$ LANGUAGE plpgsql;
-- Attach trigger to organization_users table
-- CREATE TRIGGER trg_org_user_no_last_admin BEFORE DELETE ON organization_users FOR EACH ROW EXECUTE FUNCTION public.prevent_remove_last_org_admin();