#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE=(
  docker compose
  --env-file .env.development.example
  -f docker-compose.yml
  -f docker-compose.dev.yml
)

cleanup() {
  local status=${1:-$?}
  if (( status != 0 )); then
    echo "::group::Docker Compose status"
    "${COMPOSE[@]}" ps -a || true
    echo "::endgroup::"
    echo "::group::Docker Compose logs"
    "${COMPOSE[@]}" logs --no-color --tail=200 || true
    echo "::endgroup::"
  fi
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}

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

phase=${1:-all}

case "$phase" in
  validate)
    "${COMPOSE[@]}" config --quiet
    ;;
  build)
    "${COMPOSE[@]}" build
    ;;
  start)
    "${COMPOSE[@]}" up --detach --wait --wait-timeout 420
    ;;
  probe)
    # Compose healthchecks cover the stateful/core backend services. These probes
    # additionally prove that the host-published application endpoints are usable.
    wait_http "identity" "http://127.0.0.1:${PORT_IDENTITY:-8080}/health"
    wait_http "marketplace" "http://127.0.0.1:${PORT_MARKETPLACE:-8081}/health"
    wait_http "community" "http://127.0.0.1:${PORT_COMMUNITY:-8082}/health"
    wait_http "chat" "http://127.0.0.1:${PORT_CHAT:-4000}/api/health"
    wait_http "ai orchestrator" "http://127.0.0.1:${PORT_AI_SERVICE:-8084}/health"
    wait_http "www" "http://127.0.0.1:${PORT_FRONTEND:-3000}/"
    "${COMPOSE[@]}" ps -a
    ;;
  cleanup)
    cleanup "${SMOKE_STATUS:-0}"
    ;;
  all)
    trap 'cleanup $?' EXIT
    "$0" validate
    "$0" build
    "$0" start
    "$0" probe
    ;;
  *)
    echo "usage: $0 {validate|build|start|probe|cleanup|all}" >&2
    exit 64
    ;;
esac
