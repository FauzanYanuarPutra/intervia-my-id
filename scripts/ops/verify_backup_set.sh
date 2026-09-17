#!/usr/bin/env bash
set -euo pipefail

set_dir="${1:-}"
if [[ -z "$set_dir" ]]; then
  echo "Usage: $0 BACKUP_SET_DIR [docker compose arguments...]" >&2
  exit 64
fi
shift
compose_args=("$@")

set_dir="$(cd "$set_dir" && pwd -P)"
[[ -f "$set_dir/manifest.json" ]] || { echo "Missing manifest.json" >&2; exit 2; }
[[ -f "$set_dir/checksums.sha256" ]] || { echo "Missing checksums.sha256" >&2; exit 2; }

(
  cd "$set_dir"
  sha256sum -c checksums.sha256
)

services=(
  "identity_db:identity"
  "marketplace_db:marketplace"
  "community_db:community"
)

for item in "${services[@]}"; do
  service="${item%%:*}"
  logical_name="${item##*:}"
  dump="$set_dir/postgres/$logical_name.dump"
  [[ -s "$dump" ]] || { echo "Missing or empty dump: $dump" >&2; exit 3; }

  container_id="$(docker compose "${compose_args[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || {
    echo "Compose service '$service' is required to provide pg_restore for catalog validation." >&2
    exit 4
  }

  docker compose "${compose_args[@]}" exec -T "$service" pg_restore --list < "$dump" >/dev/null
done

echo "Backup set checksum and PostgreSQL catalog verification passed: $set_dir"
echo "This does not replace an isolated restore drill."
