-- Shared PostgreSQL trigger helper used by marketplace business migrations.
-- This is deliberately not a versioned marketplace migration: existing migration
-- history is immutable, while the application/bootstrap can safely ensure the
-- helper exists before applying migrations.

CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
