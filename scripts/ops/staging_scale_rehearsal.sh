#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.staging}"
OVERLAY="${OVERLAY:-docker-compose.staging.yml}"
REPLICAS="${REPLICAS:-2}"
KEEP_SCALED="${KEEP_SCALED:-0}"

[[ -f "$ENV_FILE" ]] || { echo "Missing env file: $ENV_FILE" >&2; exit 1; }
[[ -f "$OVERLAY" ]] || { echo "Missing Compose overlay: $OVERLAY" >&2; exit 1; }
[[ "$REPLICAS" =~ ^[2-9][0-9]*$ ]] || { echo "REPLICAS must be an integer >= 2" >&2; exit 1; }

env_name="$(awk -F= '$1 == "ENV" || $1 == "APP_ENV" {gsub(/\r/,"",$2); print tolower($2); exit}' "$ENV_FILE")"
if [[ "$env_name" == "production" || "$ENV_FILE" == *production* || "$OVERLAY" == *prod* ]]; then
  echo "Refusing multi-replica rehearsal against production." >&2
  exit 1
fi

compose=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f "$OVERLAY")

restore_single_replica() {
  if [[ "$KEEP_SCALED" == "1" ]]; then
    echo "KEEP_SCALED=1; leaving rehearsal replicas running."
    return
  fi
  echo "Restoring stateless rehearsal services to one replica."
  "${compose[@]}" up -d     --scale identity_service=1     --scale marketplace_service=1     --scale community_service=1     --scale www=1     --wait --wait-timeout 420 >/dev/null || true
}
trap restore_single_replica EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 420

echo "Scaling stateless serving tier to $REPLICAS replicas."
"${compose[@]}" up -d   --scale identity_service="$REPLICAS"   --scale marketplace_service="$REPLICAS"   --scale community_service="$REPLICAS"   --scale www="$REPLICAS"   --wait --wait-timeout 420

assert_replica_health() {
  local service="$1"
  local expected="$2"
  local -a ids
  mapfile -t ids < <("${compose[@]}" ps -q "$service")

  if [[ "${#ids[@]}" -ne "$expected" ]]; then
    echo "$service expected $expected replicas, found ${#ids[@]}" >&2
    return 1
  fi

  local id health
  for id in "${ids[@]}"; do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
    if [[ "$health" != "healthy" && "$health" != "running" ]]; then
      echo "$service container $id is not healthy/running: $health" >&2
      return 1
    fi
  done
}

for service in identity_service marketplace_service community_service www; do
  assert_replica_health "$service" "$REPLICAS"
done

"${compose[@]}" ps

echo "Multi-replica rehearsal passed for identity, marketplace, community and www."
echo "This validates process-level replica startup only; it is not a multi-host or multi-AZ availability test."
