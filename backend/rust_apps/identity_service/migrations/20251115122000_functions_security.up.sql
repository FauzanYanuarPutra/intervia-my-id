-- 20251115122000_functions_security.up.sql
-- prevent_remove_last_org_admin (used later)
CREATE OR REPLACE FUNCTION public.prevent_remove_last_org_admin() RETURNS TRIGGER AS $$
DECLARE admin_count INT;
org uuid;
role_uuid uuid;
BEGIN IF TG_OP = 'DELETE' THEN org := OLD.org_id;
SELECT id INTO role_uuid
FROM roles
WHERE lower(name) = 'org_admin'
LIMIT 1;
IF role_uuid IS NULL THEN RETURN OLD;
END IF;
SELECT COUNT(*) INTO admin_count
FROM organization_users
WHERE org_id = org
    AND role_id = role_uuid;
IF OLD.role_id = role_uuid
AND admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove last org_admin from organization %',
org;
END IF;
END IF;
RETURN OLD;
END;
$$ LANGUAGE plpgsql;