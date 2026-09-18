#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Missing env file: $ENV_FILE" >&2; exit 1; }

read_env_value() {
  local key="$1"
  local line
  line="$(grep -m1 "^${key}=" "$ENV_FILE" || true)"
  printf "%s" "${line#*=}"
}

require_key() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"
  [[ -n "$value" ]] || { echo "External data-plane preflight: missing $key" >&2; exit 1; }
}

reject_local_endpoint() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"
  case "$value" in
    *identity_db*|*marketplace_db*|*community_db*|*redis_cache*|*rabbitmq:5672*|*meilisearch:7700*|*minio:9002*|*localhost*|*127.0.0.1*)
      echo "External data-plane preflight: $key still points to a local/single-host service." >&2
      exit 1
      ;;
  esac
}

[[ "$(read_env_value DATA_PLANE_MODE)" == "external" ]] || {
  echo "External data-plane preflight requires DATA_PLANE_MODE=external" >&2
  exit 1
}

[[ "$(read_env_value COMMUNITY_UPLOADS_SHARED)" == "true" ]] || {
  echo "External data-plane mode requires COMMUNITY_UPLOADS_SHARED=true and a pre-created shared/replicated COMMUNITY_UPLOADS_VOLUME." >&2
  exit 1
}

profiles="$(read_env_value COMPOSE_PROFILES)"
if [[ ",$profiles," == *",observability,"* ]]; then
  echo "Repository observability exporters still target local data services; disable the observability profile or provide a dedicated external-data observability overlay." >&2
  exit 1
fi

required_keys=(
  IDENTITY_DATABASE_URL IDENTITY_POSTGRES_HOST
  MARKETPLACE_DATABASE_URL COMMUNITY_DATABASE_URL
  REDIS_URL REDIS_HOST REDIS_PASSWORD
  RABBITMQ_URL RABBITMQ_HOST RABBITMQ_USER RABBITMQ_PASSWORD
  MEILI_URL MEILI_MASTER_KEY
  MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY MINIO_PUBLIC_URL
)
for key in "${required_keys[@]}"; do require_key "$key"; done

for key in \
  IDENTITY_DATABASE_URL MARKETPLACE_DATABASE_URL COMMUNITY_DATABASE_URL \
  REDIS_URL REDIS_HOST RABBITMQ_URL RABBITMQ_HOST MEILI_URL MINIO_ENDPOINT MINIO_PUBLIC_URL
do
  reject_local_endpoint "$key"
done

identity_db="$(read_env_value IDENTITY_DATABASE_URL)"
marketplace_db="$(read_env_value MARKETPLACE_DATABASE_URL)"
community_db="$(read_env_value COMMUNITY_DATABASE_URL)"
[[ "$identity_db" != "$marketplace_db" && "$identity_db" != "$community_db" && "$marketplace_db" != "$community_db" ]] || {
  echo "External data-plane preflight: service-owned PostgreSQL URLs must remain distinct." >&2
  exit 1
}

echo "External data-plane configuration contract passed."
echo "This validates configuration boundaries only; provider replication/failover must be verified independently."
