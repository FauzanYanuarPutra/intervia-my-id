#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.development}"
OVERLAY="${OVERLAY:-docker-compose.dev.yml}"
SETTLE_SECONDS="${SETTLE_SECONDS:-3}"

[[ -f "$ENV_FILE" ]] || { echo "Missing env file: $ENV_FILE" >&2; exit 1; }
[[ -f "$OVERLAY" ]] || { echo "Missing Compose overlay: $OVERLAY" >&2; exit 1; }

env_name="$(awk -F= '$1 == "ENV" || $1 == "APP_ENV" {gsub(/\r/,"",$2); print tolower($2); exit}' "$ENV_FILE")"
if [[ "$env_name" == "production" || "$ENV_FILE" == *production* || "$OVERLAY" == *prod* ]]; then
  echo "Refusing dependency degradation rehearsal against production." >&2
  exit 1
fi

compose=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f "$OVERLAY")

restore_dependency() {
  local dependency="$1"
  "${compose[@]}" up -d "$dependency" --wait --wait-timeout 180 >/dev/null
}

probe_core() {
  local label="$1"
  echo "Probing core readiness after $label"
  "${compose[@]}" exec -T identity_service curl -fsS http://localhost:8080/ready >/dev/null
  "${compose[@]}" exec -T marketplace_service curl -fsS http://localhost:8081/ready >/dev/null
  "${compose[@]}" exec -T community_service curl -fsS http://localhost:8082/ready >/dev/null
}

exercise_dependency() {
  local dependency="$1"
  echo "Stopping degradable dependency: $dependency"
  "${compose[@]}" stop "$dependency" >/dev/null
  sleep "$SETTLE_SECONDS"

  if ! probe_core "$dependency outage"; then
    echo "Core readiness failed while $dependency was unavailable." >&2
    restore_dependency "$dependency"
    return 1
  fi

  restore_dependency "$dependency"
  probe_core "$dependency recovery"
}

"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 420

# These systems must not become synchronous availability requirements for
# canonical core HTTP serving. Business features may degrade while they are down.
for dependency in redis_cache rabbitmq meilisearch; do
  exercise_dependency "$dependency"
done

echo "Dependency degradation rehearsal passed."
echo "This verifies process/readiness isolation only; feature-level fallback behavior still needs journey-specific tests."
