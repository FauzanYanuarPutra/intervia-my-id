#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
image="${POSTGRES_RESTORE_IMAGE:-postgres:16-alpine}"
source_container="lajukan-restore-source-$$-$RANDOM"
set_dir="$(mktemp -d)"
mkdir -p "$set_dir/postgres"

cleanup() {
  docker rm -f "$source_container" >/dev/null 2>&1 || true
  rm -rf "$set_dir"
}
trap cleanup EXIT INT TERM

docker run -d   --name "$source_container"   -e POSTGRES_USER=postgres   -e POSTGRES_PASSWORD=restore-source-test   -e POSTGRES_DB=postgres   "$image" >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec "$source_container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || {
  echo "Synthetic backup source PostgreSQL did not become ready." >&2
  docker logs "$source_container" >&2 || true
  exit 1
}

for logical_name in identity marketplace community; do
  db_name="source_$logical_name"
  table_name="restore_contract_$logical_name"

  docker exec "$source_container" createdb -U postgres "$db_name"
  docker exec "$source_container"     psql -v ON_ERROR_STOP=1 -U postgres -d "$db_name" -c "
      CREATE TABLE $table_name (
        id bigint PRIMARY KEY,
        payload text NOT NULL
      );
      INSERT INTO $table_name (id, payload) VALUES (1, '$logical_name');
    " >/dev/null

  docker exec "$source_container"     pg_dump -U postgres -d "$db_name" -Fc --no-owner --no-privileges     > "$set_dir/postgres/$logical_name.dump"
done

(
  cd "$set_dir"
  sha256sum postgres/*.dump > checksums.sha256
)

cat > "$set_dir/manifest.json" <<'EOF'
{
  "schema_version": 1,
  "environment": "ci",
  "postgres_dump_format": "custom",
  "databases": ["identity", "marketplace", "community"]
}
EOF

POSTGRES_RESTORE_IMAGE="$image"   bash "$repo_root/scripts/ops/postgres_isolated_restore_drill.sh" "$set_dir"

echo "Synthetic end-to-end PostgreSQL restore drill passed."
