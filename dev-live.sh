#!/usr/bin/env bash

set -euo pipefail

APP="${1:-www}"
ENV_FILE="${2:-.env.development}"
FULL_STACK="${FULL_STACK:-0}"
NO_INSTALL="${NO_INSTALL:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$APP" in
  www|cms|crm) ;;
  *)
    echo "Usage: ./dev-live.sh [www|cms|crm] [env-file]" >&2
    exit 1
    ;;
esac

cd "$SCRIPT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$ENV_FILE" == ".env.development" && -f .env ]]; then
    ENV_FILE=".env"
  else
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
fi

core_services=(
  postgres_db
  redis_cache
  rabbitmq
  meilisearch
  identity_service
  marketplace_service
  mailhog
)

if [[ "$FULL_STACK" == "1" ]]; then
  core_services+=(scylla_db scylla_keyspace_setup chat_service)
fi

echo "Starting core containers for live dev..."
bash ./up-super-fast.sh --env-file "$ENV_FILE" --no-build "${core_services[@]}"

if docker compose version >/dev/null 2>&1; then
  docker compose --env-file "$ENV_FILE" rm -sf "$APP" >/dev/null 2>&1 || true
else
  docker-compose --env-file "$ENV_FILE" rm -sf "$APP" >/dev/null 2>&1 || true
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

case "$APP" in
  www)
    APP_DIR="frontend/www"
    PORT="3000"
    export NEXT_PUBLIC_MARKETPLACE_URL="${NEXT_PUBLIC_MARKETPLACE_URL:-http://localhost:8081}"
    export INTERNAL_MARKETPLACE_URL="${INTERNAL_MARKETPLACE_URL:-http://localhost:8081}"
    export MARKETPLACE_URL="${MARKETPLACE_URL:-http://localhost:8081}"
    export INTERNAL_CHAT_URL="${INTERNAL_CHAT_URL:-http://localhost:4000}"
    ;;
  cms)
    APP_DIR="frontend/cms"
    PORT="3001"
    ;;
  crm)
    APP_DIR="frontend/crm"
    PORT="3002"
    export NEXT_PUBLIC_MARKETPLACE_URL="${NEXT_PUBLIC_MARKETPLACE_URL:-http://localhost:8081}"
    export INTERNAL_CHAT_URL="${INTERNAL_CHAT_URL:-http://localhost:4000}"
    ;;
esac

export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1
export PORT
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://localhost:8080}"

if [[ "$NO_INSTALL" != "1" && ! -d "$APP_DIR/node_modules" ]]; then
  echo "Installing npm dependencies for $APP..."
  (
    cd "$APP_DIR"
    npm install
  )
fi

echo "Starting $APP live dev server on http://localhost:$PORT"
if [[ "$FULL_STACK" == "1" ]]; then
  echo "Full stack mode enabled, including chat/scylla containers."
fi

cd "$APP_DIR"
npm run dev
