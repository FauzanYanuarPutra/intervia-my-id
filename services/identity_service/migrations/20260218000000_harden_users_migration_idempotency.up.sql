-- Make users/profile trigger setup safe for repeated migration runs.
-- Keeps old migration checksum unchanged while applying idempotent fixes forward.

DO $$
BEGIN
    BEGIN
        CREATE TYPE user_status AS ENUM ('active', 'disabled', 'banned', 'pending');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'update_timestamp'
        ) THEN
            DROP TRIGGER IF EXISTS users_update_timestamp ON public.users;
            CREATE TRIGGER users_update_timestamp
            BEFORE UPDATE ON public.users
            FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'reset_login_attempts_on_password_change'
        ) THEN
            DROP TRIGGER IF EXISTS users_reset_login_attempts ON public.users;
            CREATE TRIGGER users_reset_login_attempts
            BEFORE UPDATE ON public.users
            FOR EACH ROW EXECUTE FUNCTION public.reset_login_attempts_on_password_change();
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'track_updated_by'
        ) THEN
            DROP TRIGGER IF EXISTS users_track_updated_by ON public.users;
            CREATE TRIGGER users_track_updated_by
            BEFORE UPDATE ON public.users
            FOR EACH ROW EXECUTE FUNCTION public.track_updated_by();
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.user_profiles') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'normalize_username'
        ) THEN
            DROP TRIGGER IF EXISTS user_profiles_normalize_username ON public.user_profiles;
            CREATE TRIGGER user_profiles_normalize_username
            BEFORE INSERT OR UPDATE ON public.user_profiles
            FOR EACH ROW EXECUTE FUNCTION public.normalize_username();
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname = 'update_timestamp'
        ) THEN
            DROP TRIGGER IF EXISTS user_profiles_update_timestamp ON public.user_profiles;
            CREATE TRIGGER user_profiles_update_timestamp
            BEFORE UPDATE ON public.user_profiles
            FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
        END IF;
    END IF;
END $$;
