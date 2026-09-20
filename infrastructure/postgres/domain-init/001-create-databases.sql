-- Idempotent domain database provisioning.
-- profile_db is also POSTGRES_DB, so it already exists on a fresh volume.
-- psql \gexec executes only the CREATE DATABASE statements that are needed.

SELECT format('CREATE DATABASE %I', db_name)
FROM (VALUES
  ('profile_db'),
  ('media_db'),
  ('news_db'),
  ('order_db'),
  ('payment_db'),
  ('promotion_db'),
  ('crm_db'),
  ('communication_db'),
  ('trust_db'),
  ('audit_db'),
  ('support_db'),
  ('review_db')
) AS databases(db_name)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = databases.db_name
);
\gexec
