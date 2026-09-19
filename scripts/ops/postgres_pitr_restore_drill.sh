#!/usr/bin/env bash
set -euo pipefail

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 1; }

: "${BASE_BACKUP_DIR:?BASE_BACKUP_DIR is required}"
: "${WAL_ARCHIVE_DIR:?WAL_ARCHIVE_DIR is required}"
: "${RECOVERY_TARGET_TIME:?RECOVERY_TARGET_TIME is required}"

POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
DRILL_NAME="${DRILL_NAME:-lajukan-pitr-drill-$}"
WORK_ROOT="${WORK_ROOT:-$(mktemp -d)}"
PGDATA_HOST="$WORK_ROOT/pgdata"
PORT="${PITR_DRILL_PORT:-55439}"
HOST_UID="$(id -u)"
HOST_GID="$(id -g)"

cleanup() {
  docker rm -f "$DRILL_NAME" >/dev/null 2>&1 || true
  if [[ "${KEEP_PITR_WORKDIR:-0}" != "1" ]]; then
    if [[ -d "$PGDATA_HOST" ]]; then
      # PostgreSQL writes the bind-mounted data directory as its container UID.
      # Reclaim it through the already-pulled PostgreSQL image so an unprivileged
      # CI runner can remove the temporary recovery workspace deterministically.
      docker run --rm --user 0 --entrypoint sh \
        -v "$PGDATA_HOST:/pgdata" \
        "$POSTGRES_IMAGE" \
        -ec "chown -R $HOST_UID:$HOST_GID /pgdata" >/dev/null 2>&1 || true
    fi
    rm -rf "$WORK_ROOT"
  else
    echo "Keeping PITR workdir: $WORK_ROOT"
  fi
}
trap cleanup EXIT

test -f "$BASE_BACKUP_DIR/checksums.sha256"
(
  cd "$BASE_BACKUP_DIR"
  sha256sum -c checksums.sha256
)

mkdir -p "$PGDATA_HOST"
tar -xzf "$BASE_BACKUP_DIR/base/base.tar.gz" -C "$PGDATA_HOST"
if [[ -f "$BASE_BACKUP_DIR/base/pg_wal.tar.gz" ]]; then
  mkdir -p "$PGDATA_HOST/pg_wal"
  tar -xzf "$BASE_BACKUP_DIR/base/pg_wal.tar.gz" -C "$PGDATA_HOST/pg_wal"
fi

touch "$PGDATA_HOST/recovery.signal"
recovery_target_time_escaped="$(printf '%s' "$RECOVERY_TARGET_TIME" | sed "s/'/''/g")"
cat >> "$PGDATA_HOST/postgresql.auto.conf" <<EOF
restore_command = 'cp /wal-archive/%f %p'
recovery_target_time = '$recovery_target_time_escaped'
recovery_target_action = 'promote'
EOF

docker run -d --name "$DRILL_NAME"   -p "127.0.0.1:$PORT:5432"   -v "$PGDATA_HOST:/var/lib/postgresql/data"   -v "$WAL_ARCHIVE_DIR:/wal-archive:ro"   "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 90); do
  if docker exec "$DRILL_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$DRILL_NAME" pg_isready -U postgres >/dev/null
docker exec "$DRILL_NAME" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c "SELECT pg_is_in_recovery();" >/dev/null

if [[ -n "${PITR_ASSERT_SQL:-}" ]]; then
  docker exec "$DRILL_NAME" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c "$PITR_ASSERT_SQL"
fi

echo "PITR restore drill succeeded for target $RECOVERY_TARGET_TIME"
