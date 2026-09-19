CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (user_notifications) FROM SERVER legacy_marketplace INTO legacy;
CREATE TABLE IF NOT EXISTS user_notifications (LIKE legacy.user_notifications INCLUDING DEFAULTS);
INSERT INTO user_notifications SELECT * FROM legacy.user_notifications ON CONFLICT DO NOTHING;