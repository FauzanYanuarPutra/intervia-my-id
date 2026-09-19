#!/usr/bin/env bash
set -euo pipefail

command -v docker >/dev/null
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
PRIMARY="lajukan-pitr-primary-$$"
NETWORK="lajukan-pitr-net-$$"
ARCHIVE="$WORK/wal"
BACKUPS="$WORK/backups"
mkdir -p "$ARCHIVE" "$BACKUPS"

cleanup() {
  docker rm -f "$PRIMARY" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null
docker run -d --name "$PRIMARY" --network "$NETWORK"   -e POSTGRES_HOST_AUTH_METHOD=trust   -v "$ARCHIVE:/wal-archive"   postgres:16-alpine   -c wal_level=replica   -c archive_mode=on   -c "archive_command=test ! -f /wal-archive/%f && cp %p /wal-archive/%f"   -c archive_timeout=1s   -c max_wal_senders=10 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$PRIMARY" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker exec "$PRIMARY" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c   "CREATE TABLE pitr_probe(id integer primary key, label text, created_at timestamptz default clock_timestamp()); INSERT INTO pitr_probe VALUES (1,'before',clock_timestamp());"

DATABASE_URL="postgres://postgres@$PRIMARY:5432/postgres" BACKUP_ROOT="/backups" docker run --rm --network "$NETWORK"   -v "$ROOT:/repo:ro"   -v "$BACKUPS:/backups"   -e DATABASE_URL="postgres://postgres@$PRIMARY:5432/postgres"   -e BACKUP_ROOT=/backups   postgres:16-alpine   sh -lc "apk add --no-cache bash coreutils >/dev/null && /repo/scripts/ops/postgres_pitr_basebackup.sh" >/tmp/lajukan-pitr-backup-path.txt

backup_dir="$BACKUPS/$(basename "$(tail -n1 /tmp/lajukan-pitr-backup-path.txt)")"
target_time="$(docker exec "$PRIMARY" psql -U postgres -d postgres -X -A -t -c "SELECT clock_timestamp()")"
sleep 1
docker exec "$PRIMARY" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c   "INSERT INTO pitr_probe VALUES (2,'after',clock_timestamp()); SELECT pg_switch_wal();"

for _ in $(seq 1 30); do
  archived="$(docker exec "$PRIMARY" psql -U postgres -d postgres -X -A -t -c "SELECT archived_count FROM pg_stat_archiver")"
  [[ "$archived" =~ ^[0-9]+$ ]] && (( archived > 0 )) && break
  sleep 1
done

BASE_BACKUP_DIR="$backup_dir" WAL_ARCHIVE_DIR="$ARCHIVE" RECOVERY_TARGET_TIME="$target_time" PITR_ASSERT_SQL="DO \$\$ BEGIN IF (SELECT count(*) FROM pitr_probe WHERE id=1) <> 1 THEN RAISE EXCEPTION 'missing before row'; END IF; IF (SELECT count(*) FROM pitr_probe WHERE id=2) <> 0 THEN RAISE EXCEPTION 'after row survived target-time recovery'; END IF; END \$\$;" PITR_DRILL_PORT=55439 "$ROOT/scripts/ops/postgres_pitr_restore_drill.sh"
