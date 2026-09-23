#!/bin/sh
# scylladb/setup_keyspace_init.sh
# Skrip ini memastikan keyspace bersih sebelum menjalankan schema.
set -e

HOST="scylla_db"
CQL_FILE="/scylladb/init.cql"
RESET_KEYSPACE="${SCYLLA_RESET_KEYSPACE:-0}"
KEYSPACE="${SCYLLA_KEYSPACE:-laju_chat}"

echo "=== [INIT] Running ScyllaDB keyspace setup script ==="

# ----------------------------------------------------
# 1. TUNGGU SCYLLADB SIAP
# ----------------------------------------------------
echo "Waiting for ScyllaDB to be fully healthy..."
# Kita asumsikan Docker Healthcheck sudah lulus, tapi kita verifikasi dengan cqlsh.
until cqlsh $HOST 9042 -e "describe cluster" > /dev/null 2>&1; do
  echo "ScyllaDB not ready yet, waiting..."
  sleep 5
done
echo "ScyllaDB is up! Starting schema operations."

# ----------------------------------------------------
# 2. HAPUS KEYSPACE LAMA (UNTUK DEVEL)
# ----------------------------------------------------
if [ "$RESET_KEYSPACE" = "1" ]; then
  echo "Attempting to DROP KEYSPACE 'laju_chat' if it exists..."
  # Jalankan DROP KEYSPACE, jika gagal (keyspace tidak ada) ini akan diabaikan.
  cqlsh --request-timeout=60 -e "DROP KEYSPACE IF EXISTS laju_chat;" $HOST || true

  # Jeda waktu sejenak (penting!) agar ScyllaDB dapat menyelesaikan penghapusan
  # sebelum kita mencoba membuatnya kembali.
  echo "Waiting 10 seconds for keyspace deletion finalization..."
  sleep 10
else
  echo "Skip dropping keyspace (SCYLLA_RESET_KEYSPACE=0)."
fi

# ----------------------------------------------------
# 3. EKSEKUSI FILE CQL MENGGUNAKAN CQLSH
# ----------------------------------------------------
echo "Executing fresh schema from $CQL_FILE on $HOST..."

# Jalankan cqlsh dengan HOST target (nama layanan ScyllaDB)
cqlsh --request-timeout=60 -f $CQL_FILE $HOST

# Periksa status keluar (exit status) dari perintah cqlsh
if [ $? -ne 0 ]; then
    echo "Error running cqlsh. Check your init.cql file."
    exit 1
fi

# Apply additive, versioned Scylla migrations after the immutable baseline.
# Existing migrations are intentionally idempotent (CREATE ... IF NOT EXISTS),
# so rerunning them is safe during rolling/local restarts while new migrations
# become effective without rewriting init.cql.
MIGRATIONS_DIR="/scylladb/migrations"
cqlsh --request-timeout=60 -e "CREATE TABLE IF NOT EXISTS ${KEYSPACE}.chat_schema_migrations (migration_name text PRIMARY KEY, applied_at timestamp);" "$HOST"

if [ -d "$MIGRATIONS_DIR" ]; then
    for migration in "$MIGRATIONS_DIR"/*.cql; do
        [ -f "$migration" ] || continue
        migration_name="$(basename "$migration")"
        applied="$(cqlsh --request-timeout=60 -e "SELECT migration_name FROM ${KEYSPACE}.chat_schema_migrations WHERE migration_name = '$migration_name';" "$HOST" 2>/dev/null | grep -F "$migration_name" | head -n 1 || true)"
        if [ -n "$applied" ]; then
            echo "Skipping Scylla migration (already applied): $migration_name"
            continue
        fi
        echo "Applying Scylla migration: $migration_name"
        tmp_migration="$(mktemp)"
        printf 'USE %s;\n' "$KEYSPACE" > "$tmp_migration"
        cat "$migration" >> "$tmp_migration"
        cqlsh --request-timeout=60 -f "$tmp_migration" "$HOST"
        rm -f "$tmp_migration"
        cqlsh --request-timeout=60 -e "INSERT INTO ${KEYSPACE}.chat_schema_migrations (migration_name, applied_at) VALUES ('$migration_name', toTimestamp(now()));" "$HOST"
    done
fi

echo "Keyspace, baseline schema, and additive migrations applied successfully."
echo "=== [INIT] ScyllaDB keyspace setup complete ==="
exit 0
