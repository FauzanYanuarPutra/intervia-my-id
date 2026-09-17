#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_root="${1:-}"
if [[ -z "$backup_root" ]]; then
  echo "Usage: $0 BACKUP_ROOT [docker compose arguments...]" >&2
  echo "Example: $0 /var/backups/lajukan --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.observability.yml" >&2
  exit 64
fi
shift
compose_args=("$@")

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 2
}
command -v sha256sum >/dev/null 2>&1 || {
  echo "sha256sum is required" >&2
  exit 2
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
mkdir -p "$backup_root"
backup_root="$(cd "$backup_root" && pwd -P)"

case "$backup_root/" in
  "$repo_root/"*) echo "Refusing to place backups inside the Git repository: $backup_root" >&2; exit 3 ;;
esac
[[ "$backup_root" != "/" ]] || {
  echo "Refusing to use / as BACKUP_ROOT" >&2
  exit 3
}

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
set_dir="$backup_root/lajukan-$timestamp"
mkdir -p "$set_dir/postgres" "$set_dir/metadata"

repo_commit="unknown"
if command -v git >/dev/null 2>&1; then
  candidate="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || true)"
  if [[ "$candidate" =~ ^[0-9a-f]{40}$ ]]; then
    repo_commit="$candidate"
  fi
fi

services=(
  "identity_db:identity"
  "marketplace_db:marketplace"
  "community_db:community"
)

migration_file="$set_dir/metadata/migration-heads.txt"
: > "$migration_file"

for item in "${services[@]}"; do
  service="${item%%:*}"
  logical_name="${item##*:}"
  dump="$set_dir/postgres/$logical_name.dump"

  container_id="$(docker compose "${compose_args[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || {
    echo "Compose service '$service' is not running." >&2
    exit 4
  }

  echo "Creating $logical_name PostgreSQL custom-format dump..."
  docker compose "${compose_args[@]}" exec -T "$service" sh -ec '
    exec pg_dump \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -Fc \
      --no-owner \
      --no-privileges
  ' > "$dump"

  [[ -s "$dump" ]] || {
    echo "Backup dump is empty: $dump" >&2
    exit 5
  }

  # Validate the custom-format catalog without restoring or changing live data.
  docker compose "${compose_args[@]}" exec -T "$service" pg_restore --list < "$dump" >/dev/null

  migration_head="$(
    docker compose "${compose_args[@]}" exec -T "$service" sh -ec '
      psql -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -c "SELECT COALESCE(MAX(version)::text, '''none''') FROM _sqlx_migrations" 2>/dev/null || printf "unavailable"
    ' | tr -d '\r' | tail -n 1
  )"
  printf '%s=%s\n' "$logical_name" "$migration_head" >> "$migration_file"
done

(
  cd "$set_dir"
  sha256sum postgres/*.dump > checksums.sha256
)

cat > "$set_dir/manifest.json" <<EOF
{
  "schema_version": 1,
  "environment": "${ENV:-unknown}",
  "created_at_utc": "$timestamp",
  "repository_commit": "$repo_commit",
  "postgres_dump_format": "custom",
  "databases": ["identity", "marketplace", "community"],
  "verification": {
    "non_empty": true,
    "pg_restore_catalog": true,
    "sha256_manifest": "checksums.sha256"
  }
}
EOF

printf '%s\n' "$repo_commit" > "$set_dir/metadata/repository-commit.txt"
docker version --format '{{.Server.Version}}' > "$set_dir/metadata/docker-server-version.txt" 2>/dev/null || true

echo "PostgreSQL logical backup set created and catalog-verified:"
echo "$set_dir"
echo "This is a logical recovery tier, not a replacement for production PITR/WAL archiving."
