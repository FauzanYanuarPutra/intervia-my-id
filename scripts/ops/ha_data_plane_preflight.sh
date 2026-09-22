#!/usr/bin/env sh
set -eu

required_vars="
HA_IDENTITY_DATABASE_URL
HA_MARKETPLACE_DATABASE_URL
HA_COMMUNITY_DATABASE_URL
HA_REDIS_URL
HA_REDIS_HOST
HA_REDIS_PASSWORD
HA_RABBITMQ_URL
HA_MEILI_URL
HA_MEILI_MASTER_KEY
HA_OBJECT_STORAGE_ENDPOINT
HA_OBJECT_STORAGE_ACCESS_KEY
HA_OBJECT_STORAGE_SECRET_KEY
HA_OBJECT_STORAGE_BUCKET
HA_OBJECT_STORAGE_PUBLIC_URL
HA_COMMUNITY_MEDIA_MOUNT
"

missing=0
for name in $required_vars; do
  eval "value=${$name:-}"
  if [ -z "$value" ]; then
    echo "missing required HA setting: $name" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 2

reject_local_endpoint() {
  name="$1"
  value="$2"
  case "$value" in
    *"localhost"*|*"127.0.0.1"*|*"@identity_db:"*|*"@marketplace_db:"*|*"@community_db:"*|*"@redis_cache:"*|*"@rabbitmq:"*|*"//minio:"*|*"//meilisearch:"*)
      echo "$name still points at single-host/local Compose infrastructure: $value" >&2
      return 1
      ;;
  esac
}

reject_local_endpoint HA_IDENTITY_DATABASE_URL "$HA_IDENTITY_DATABASE_URL"
reject_local_endpoint HA_MARKETPLACE_DATABASE_URL "$HA_MARKETPLACE_DATABASE_URL"
reject_local_endpoint HA_COMMUNITY_DATABASE_URL "$HA_COMMUNITY_DATABASE_URL"
reject_local_endpoint HA_REDIS_URL "$HA_REDIS_URL"
reject_local_endpoint HA_RABBITMQ_URL "$HA_RABBITMQ_URL"
reject_local_endpoint HA_MEILI_URL "$HA_MEILI_URL"
reject_local_endpoint HA_OBJECT_STORAGE_ENDPOINT "$HA_OBJECT_STORAGE_ENDPOINT"

case "$HA_COMMUNITY_MEDIA_MOUNT" in
  /*) ;;
  *)
    echo "HA_COMMUNITY_MEDIA_MOUNT must be an absolute path backed by shared storage" >&2
    exit 2
    ;;
esac

compose_files="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ha.yml"
# shellcheck disable=SC2086
docker compose --env-file "${ENV_FILE:-.env.production}" $compose_files config --quiet

echo "HA data-plane preflight passed."
