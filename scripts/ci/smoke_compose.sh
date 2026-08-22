#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE=(
  docker compose
  --env-file .env.development.example
  -f docker-compose.yml
  -f docker-compose.dev.yml
)

cleanup() {
  local status=$?
  if (( status != 0 )); then
    echo "::group::Docker Compose status"
    "${COMPOSE[@]}" ps -a || true
    echo "::endgroup::"
    echo "::group::Docker Compose logs"
    "${COMPOSE[@]}" logs --no-color --tail=200 || true
    echo "::endgroup::"
  fi
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

wait_http() {
  local name=$1
  local url=$2
  local attempts=${3:-30}
  local delay=${4:-2}

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo "${name}: ready (${url})"
      return 0
    fi
    echo "${name}: waiting (${attempt}/${attempts})"
    sleep "$delay"
  done

  echo "${name}: failed to become ready at ${url}" >&2
  return 1
}

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up --detach --wait --wait-timeout 420

# Compose healthchecks cover the stateful/core backend services. These probes
# additionally prove that the host-published application endpoints are usable.
wait_http "identity" "http://127.0.0.1:${PORT_IDENTITY:-8080}/health"
wait_http "marketplace" "http://127.0.0.1:${PORT_MARKETPLACE:-8081}/health"
wait_http "community" "http://127.0.0.1:${PORT_COMMUNITY:-8082}/health"
wait_http "chat" "http://127.0.0.1:${PORT_CHAT:-4000}/api/health"
wait_http "www" "http://127.0.0.1:${PORT_FRONTEND:-3000}/"

"${COMPOSE[@]}" ps -a
