CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (crm_leads) FROM SERVER legacy_marketplace INTO legacy;
CREATE TABLE IF NOT EXISTS crm_leads (LIKE legacy.crm_leads INCLUDING DEFAULTS);
INSERT INTO crm_leads SELECT * FROM legacy.crm_leads ON CONFLICT DO NOTHING;