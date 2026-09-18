#!/usr/bin/env bash
set -euo pipefail
umask 077

set_dir="${1:-}"
if [[ -z "$set_dir" ]]; then
  echo "Usage: $0 BACKUP_SET_DIR" >&2
  exit 64
fi

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 2
}
command -v sha256sum >/dev/null 2>&1 || {
  echo "sha256sum is required" >&2
  exit 2
}

set_dir="$(cd "$set_dir" && pwd -P)"
[[ -f "$set_dir/manifest.json" ]] || { echo "Missing manifest.json" >&2; exit 3; }
[[ -f "$set_dir/checksums.sha256" ]] || { echo "Missing checksums.sha256" >&2; exit 3; }

for logical_name in identity marketplace community; do
  dump="$set_dir/postgres/$logical_name.dump"
  [[ -s "$dump" ]] || { echo "Missing or empty dump: $dump" >&2; exit 3; }
done

(
  cd "$set_dir"
  sha256sum -c checksums.sha256
)

image="${POSTGRES_RESTORE_IMAGE:-postgres:16-alpine}"
suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
container_name="lajukan-restore-drill-$suffix"
volume_name="$container_name-data"
keep_restore="${KEEP_RESTORE_DRILL:-0}"

cleanup() {
  if [[ "$keep_restore" == "1" ]]; then
    echo "KEEP_RESTORE_DRILL=1; leaving isolated container and volume for inspection:"
    echo "  container=$container_name"
    echo "  volume=$volume_name"
    return
  fi
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker volume rm "$volume_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker volume create "$volume_name" >/dev/null
docker run -d   --name "$container_name"   --label "lajukan.restore-drill=true"   -e POSTGRES_USER=postgres   -e POSTGRES_PASSWORD="restore-drill-$RANDOM-$RANDOM"   -e POSTGRES_DB=postgres   -v "$volume_name:/var/lib/postgresql/data"   "$image" >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || {
  echo "Isolated PostgreSQL restore target did not become ready." >&2
  docker logs "$container_name" >&2 || true
  exit 4
}

printf '%-14s %12s\n' "database" "user_tables"
printf '%-14s %12s\n' "--------" "-----------"

for logical_name in identity marketplace community; do
  db_name="restore_$logical_name"
  dump="$set_dir/postgres/$logical_name.dump"
  container_dump="/tmp/$logical_name.dump"

  docker exec "$container_name" createdb -U postgres "$db_name"
  docker cp "$dump" "$container_name:$container_dump" >/dev/null

  docker exec "$container_name"     pg_restore       --exit-on-error       --no-owner       --no-privileges       -U postgres       -d "$db_name"       "$container_dump"

  table_count="$(
    docker exec "$container_name"       psql -Atq -v ON_ERROR_STOP=1 -U postgres -d "$db_name" -c "
        SELECT count(*)
        FROM pg_catalog.pg_class AS c
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema');
      " | tr -d '\r'
  )"

  [[ "$table_count" =~ ^[0-9]+$ && "$table_count" -gt 0 ]] || {
    echo "Restore validation failed for $logical_name: no user tables were restored." >&2
    exit 5
  }

  # A schema-only re-dump proves the restored catalog is readable by PostgreSQL,
  # without touching the source backup or any live Lajukan database.
  docker exec "$container_name"     pg_dump -U postgres -d "$db_name" --schema-only --no-owner --no-privileges >/dev/null

  printf '%-14s %12s\n' "$logical_name" "$table_count"
  docker exec "$container_name" rm -f "$container_dump"
done

echo "Isolated PostgreSQL restore drill passed for identity, marketplace and community."
echo "The drill used a disposable container and volume with no published network port."
echo "This validates logical restore mechanics; application invariants and production PITR/WAL recovery remain separate drills."
