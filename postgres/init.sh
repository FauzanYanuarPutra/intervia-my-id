#!/bin/sh
set -e

# Gunakan variabel POSTGRES_USER yang dikirim dari docker-compose.
# Jika tidak ada, default ke 'postgres'
ADMIN_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-laju_db}"

echo "=== [INIT] Running PostgreSQL initialization script with user: $ADMIN_USER ==="

# Tunggu sampai PostgreSQL siap menggunakan user admin
until pg_isready -U "$ADMIN_USER" -d "$DB_NAME" -h /var/run/postgresql; do
    echo "Waiting for PostgreSQL to be available..."
    sleep 2
done

echo "PostgreSQL is ready!"

# Jalankan SQL menggunakan user admin
psql -U "$ADMIN_USER" -d "$DB_NAME" <<EOF
-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. PRIVILEGES (Karena POSTGRES_USER sudah 'app', dia sudah punya akses)
-- Tapi kita pastikan lagi agar aman
GRANT ALL PRIVILEGES ON SCHEMA public TO "$ADMIN_USER";

-- 3. VIEW Monitoring
CREATE OR REPLACE VIEW public.vw_pg_stat_statements_top AS
SELECT userid, dbid, queryid, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 50;

EOF

echo "=== [INIT] PostgreSQL initialization complete ==="
