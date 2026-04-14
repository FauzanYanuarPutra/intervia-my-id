-- postgres/init.sql
-- Initial bootstrap (runs ONLY once when the DB volume is empty)
-- 1. CREATE APPLICATION ROLE (idempotent)
DO $$ BEGIN IF NOT EXISTS (
    SELECT
    FROM pg_roles
    WHERE rolname = 'app'
) THEN CREATE ROLE app WITH LOGIN PASSWORD 'laju123';
END IF;
END;
$$;
-- 2. EXTENSIONS (safe & required)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS unaccent;
-- 3. BASIC PRIVILEGES FOR 'app'
GRANT USAGE ON SCHEMA public TO app;
-- 4. DEFAULT PRIVILEGES FOR FUTURE OBJECTS CREATED BY app
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public
GRANT USAGE ON SEQUENCES TO app;
-- 5. CREATE SUPER BASIC AUDIT VIEW (will be refreshed on every boot by post_start.sh)
CREATE OR REPLACE VIEW public.vw_pg_stat_statements_top AS
SELECT userid,
    dbid,
    queryid,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 50;
GRANT SELECT ON public.vw_pg_stat_statements_top TO app;
-- NOTE:
-- All tables, triggers, RLS, etc. MUST be installed by Rust/sqlx migrations.