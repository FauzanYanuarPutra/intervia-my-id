.#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-.env.development}"
WITH_MAILSERVER="${WITH_MAILSERVER:-1}"

cd "$SCRIPT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$ENV_FILE" == ".env.development" && -f .env ]]; then
    ENV_FILE=".env"
  else
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_BIN=(docker-compose)
else
  echo "Docker Compose not found." >&2
  exit 1
fi

compose_cmd() {
  "${COMPOSE_BIN[@]}" "$@"
}

image_only_services=(
  identity_db
  community_db
  marketplace_db
  redis_cache
  rabbitmq
  meilisearch
  scylla_db
  minio
  mailhog
  caddy
  cloudflare_tunnel
  pgadmin
)

core_infra_services=(
  identity_db
  community_db
  marketplace_db
  redis_cache
  rabbitmq
  meilisearch
  scylla_db
  minio
)

support_services=(
  mailhog
  caddy
  cloudflare_tunnel
  pgadmin
)

backend_services=(
  identity_service
  marketplace_service
  scylla_keyspace_setup
  chat_service
)

frontend_services=(
  www
  usaha
  cms
  crm
)

if [[ "$WITH_MAILSERVER" == "1" ]]; then
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}mailserver"
  image_only_services+=(mailserver)
  support_services+=(mailserver)
fi

echo "Pulling external images first..."
compose_cmd --env-file "$ENV_FILE" pull "${image_only_services[@]}"

echo
echo "Starting core infrastructure..."
bash ./up-super-fast.sh --env-file "$ENV_FILE" --no-build "${core_infra_services[@]}"

echo
echo "Starting backend services..."
bash ./up-super-fast.sh --env-file "$ENV_FILE" --no-build "${backend_services[@]}"

echo
echo "Starting frontend services..."
bash ./up-super-fast.sh --env-file "$ENV_FILE" --no-build "${frontend_services[@]}"

echo
echo "Starting support services..."
bash ./up-super-fast.sh --env-file "$ENV_FILE" --no-build "${support_services[@]}"

echo
echo "Current compose status:"
compose_cmd --env-file "$ENV_FILE" ps
