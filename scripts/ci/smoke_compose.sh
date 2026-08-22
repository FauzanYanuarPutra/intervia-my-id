#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE=(
  docker compose
  --env-file .env.development.example
  -f docker-compose.yml
  -f docker-compose.dev.yml
)

FULL_COMPOSE=(
  "${COMPOSE[@]}"
  --profile backoffice
  --profile edge
)

cleanup() {
  local status=${1:-$?}
  local -a compose_cmd=("${COMPOSE[@]}")
  if [[ "${2:-core}" == "full" ]]; then
    compose_cmd=("${FULL_COMPOSE[@]}")
  fi

  if (( status != 0 )); then
    echo "::group::Docker Compose status"
    "${compose_cmd[@]}" ps -a || true
    echo "::endgroup::"
    echo "::group::Docker Compose logs"
    "${compose_cmd[@]}" logs --no-color --tail=200 || true
    echo "::endgroup::"
  fi
  "${compose_cmd[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
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

wait_host() {
  local name=$1
  local host=$2
  local path=${3:-/api/health}
  local attempts=${4:-30}
  local delay=${5:-2}
  local url="http://127.0.0.1${path}"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error --max-time 5 -H "Host: ${host}" "$url" >/dev/null; then
      echo "${name}: ready (${host}${path})"
      return 0
    fi
    echo "${name}: waiting (${attempt}/${attempts})"
    sleep "$delay"
  done

  echo "${name}: failed to become ready through Caddy host ${host}${path}" >&2
  return 1
}

probe_core() {
  wait_http "identity" "http://127.0.0.1:${PORT_IDENTITY:-8080}/health"
  wait_http "marketplace" "http://127.0.0.1:${PORT_MARKETPLACE:-8081}/health"
  wait_http "community" "http://127.0.0.1:${PORT_COMMUNITY:-8082}/health"
  wait_http "chat" "http://127.0.0.1:${PORT_CHAT:-4000}/api/health"
  wait_http "ai orchestrator" "http://127.0.0.1:${PORT_AI_SERVICE:-8084}/health"
  wait_http "www" "http://127.0.0.1:${PORT_FRONTEND:-3000}/api/health"
  wait_http "usaha" "http://127.0.0.1:${PORT_USAHA:-3003}/api/health"
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
    probe_core
    "${COMPOSE[@]}" ps -a
    ;;
  full)
    trap 'cleanup $? full' EXIT
    "${FULL_COMPOSE[@]}" config --quiet
    "${FULL_COMPOSE[@]}" build www usaha cms crm caddy
    "${FULL_COMPOSE[@]}" up --detach --wait --wait-timeout 420
    probe_core
    wait_http "cms" "http://127.0.0.1:${PORT_CMS:-3001}/api/health"
    wait_http "crm" "http://127.0.0.1:${PORT_CRM:-3002}/api/health"
    wait_host "caddy www" "www.localhost"
    wait_host "caddy usaha" "usaha.localhost"
    wait_host "caddy cms" "cms.localhost"
    wait_host "caddy crm" "crm.localhost"
    "${FULL_COMPOSE[@]}" ps -a
    ;;
  cleanup)
    cleanup "${SMOKE_STATUS:-0}" "${SMOKE_SCOPE:-core}"
    ;;
  all)
    trap 'cleanup $?' EXIT
    "$0" validate
    "$0" build
    "$0" start
    "$0" probe
    ;;
  *)
    echo "usage: $0 {validate|build|start|probe|full|cleanup|all}" >&2
    exit 64
    ;;
esac
