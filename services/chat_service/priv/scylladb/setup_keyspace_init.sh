#!/bin/sh
# scylladb/setup_keyspace_init.sh
# Skrip ini memastikan keyspace bersih sebelum menjalankan schema.
set -e

HOST="scylla_db"
CQL_FILE="/scylladb/init.cql"
RESET_KEYSPACE="${SCYLLA_RESET_KEYSPACE:-0}"

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
if [ $? -eq 0 ]; then
    echo "Keyspace and all tables created successfully."
    echo "=== [INIT] ScyllaDB keyspace setup complete ==="
else
    echo "Error running cqlsh. Check your init.cql file."
    exit 1
fi
