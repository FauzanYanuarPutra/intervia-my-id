CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (reviews) FROM SERVER legacy_marketplace INTO legacy;
INSERT INTO reviews SELECT id,transaction_id,content_id,reviewer_id,reviewee_id,rating,comment,created_at FROM legacy.reviews ON CONFLICT(id) DO NOTHING;
