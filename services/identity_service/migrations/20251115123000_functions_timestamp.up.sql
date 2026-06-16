-- 20251115123000_functions_timestamp.up.sql -- ==============================================
-- FUNCTIONS: Timestamp, Username Normalizer, Etc
-- ==============================================
-- 1) Update updated_at on row update
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 2) Reset login attempts when password changes
CREATE OR REPLACE FUNCTION public.reset_login_attempts_on_password_change() RETURNS trigger AS $$ BEGIN IF NEW.password_hash IS DISTINCT
FROM OLD.password_hash THEN NEW.failed_login_attempts = 0;
NEW.lockout_expires_at = NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 3) Set updated_by from app.current_user_id
CREATE OR REPLACE FUNCTION public.track_updated_by() RETURNS trigger AS $$ BEGIN IF current_setting('app.current_user_id', true) IS NOT NULL THEN NEW.updated_by = current_setting('app.current_user_id')::uuid;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 4) Normalize username → lowercase + trim spaces
CREATE OR REPLACE FUNCTION public.normalize_username() RETURNS trigger AS $$ BEGIN IF NEW.username IS NOT NULL THEN NEW.username = lower(trim(NEW.username));
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- prevent delete system roles
CREATE OR REPLACE FUNCTION public.prevent_delete_system_roles() RETURNS TRIGGER AS $func$ BEGIN IF OLD.system = TRUE THEN RAISE EXCEPTION 'Cannot delete system-protected role.';
END IF;
RETURN OLD;
END;
$func$ LANGUAGE plpgsql;