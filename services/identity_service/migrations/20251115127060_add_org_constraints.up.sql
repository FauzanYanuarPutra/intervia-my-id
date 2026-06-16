-- 20251115127060_add_org_constraints.up.sql
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owner_is_member'
) THEN
ALTER TABLE organizations
ADD CONSTRAINT owner_is_member CHECK (
        owner_user_id IS NULL
        OR public.org_owner_is_member(id, owner_user_id)
    );
END IF;
END $$;