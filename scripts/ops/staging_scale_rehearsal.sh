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

probe_surviving_replicas() {
  local target_service="$1"
  local probe_service="$2"
  local probe_url="$3"

  local -a ids
  mapfile -t ids < <("${compose[@]}" ps -q "$target_service")
  [[ "${#ids[@]}" -ge 2 ]] || {
    echo "$target_service requires at least two replicas for failover rehearsal." >&2
    return 1
  }

  local victim="${ids[0]}"
  echo "Stopping one $target_service replica to verify service-discovery failover: $victim"
  docker stop --time 10 "$victim" >/dev/null
  sleep 2

  local attempt
  for attempt in $(seq 1 12); do
    if ! "${compose[@]}" exec -T "$probe_service" curl -fsS --max-time 5 "$probe_url" >/dev/null; then
      echo "$target_service failover probe failed on attempt $attempt while one replica was stopped." >&2
      "${compose[@]}" up -d --scale "$target_service=$REPLICAS" --wait --wait-timeout 180 >/dev/null || true
      return 1
    fi
  done

  echo "Restoring $target_service to $REPLICAS replicas."
  "${compose[@]}" up -d --scale "$target_service=$REPLICAS" --wait --wait-timeout 180 >/dev/null
  assert_replica_health "$target_service" "$REPLICAS"
}

# Probe through Docker service discovery from a different serving service. This
# catches single-replica assumptions and stale service-discovery behavior while
# remaining independent of public DNS/CDN configuration.
probe_surviving_replicas identity_service marketplace_service http://identity_service:8080/ready
probe_surviving_replicas marketplace_service identity_service http://marketplace_service:8081/ready
probe_surviving_replicas community_service identity_service http://community_service:8082/ready
probe_surviving_replicas www identity_service http://www:3000/api/health

"${compose[@]}" ps

echo "Multi-replica startup and single-replica failover rehearsal passed for identity, marketplace, community and www."
echo "This validates single-host process/service-discovery failover only; it is not a multi-host or multi-AZ availability test."
