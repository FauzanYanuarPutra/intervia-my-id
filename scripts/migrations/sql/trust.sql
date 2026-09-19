CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (super_app_trust_profiles) FROM SERVER legacy_marketplace INTO legacy;
CREATE TABLE IF NOT EXISTS super_app_trust_profiles (LIKE legacy.super_app_trust_profiles INCLUDING DEFAULTS);
INSERT INTO super_app_trust_profiles SELECT * FROM legacy.super_app_trust_profiles ON CONFLICT DO NOTHING;