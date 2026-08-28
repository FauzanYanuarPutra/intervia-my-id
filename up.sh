#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENVIRONMENT="development"
BUILD=0
PULL=0
DOWN=0
FRESH=0
PROFILES=()
ACTIVE_PROFILES=()
SERVICES=()

usage() {
  cat <<'USAGE'
Usage: ./up.sh [options] [service ...]

Options:
  --env development|staging|production
  --profile NAME          Repeatable. Enables an optional Compose profile.
  --service NAME          Repeatable. Starts only selected services.
  --build                 Build selected/all buildable services first.
  --pull                  Pull images before startup.
  --down                  Stop the selected environment stack.
  --fresh                 Recreate containers; volumes are preserved.
  -h, --help              Show this help.

Examples:
  ./up.sh
  ./up.sh --profile ai
  ./up.sh --profile ai --profile kyc
  ./up.sh --build www marketplace_service
  ./up.sh --env staging --pull
USAGE
}

while (($#)); do
  case "$1" in
    --env)
      [[ $# -ge 2 ]] || { echo "--env requires a value" >&2; exit 2; }
      ENVIRONMENT="$2"
      shift 2
      ;;
    --profile)
      [[ $# -ge 2 ]] || { echo "--profile requires a value" >&2; exit 2; }
      PROFILES+=("$2")
      shift 2
      ;;
    --service)
      [[ $# -ge 2 ]] || { echo "--service requires a value" >&2; exit 2; }
      SERVICES+=("$2")
      shift 2
      ;;
    --build)
      BUILD=1
      shift
      ;;
    --pull)
      PULL=1
      shift
      ;;
    --down)
      DOWN=1
      shift
      ;;
    --fresh)
      FRESH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      SERVICES+=("$@")
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      SERVICES+=("$1")
      shift
      ;;
  esac
done

case "$ENVIRONMENT" in
  development)
    ENV_FILE=".env.development"
    OVERLAY="docker-compose.dev.yml"
    ;;
  staging)
    ENV_FILE=".env.staging"
    OVERLAY="docker-compose.staging.yml"
    ;;
  production)
    ENV_FILE=".env.production"
    OVERLAY="docker-compose.prod.yml"
    ;;
  *)
    echo "Invalid environment: $ENVIRONMENT" >&2
    exit 2
    ;;
esac

command -v docker >/dev/null 2>&1 || {
  echo "Docker CLI is not installed or not in PATH." >&2
  exit 1
}

docker compose version >/dev/null 2>&1 || {
  echo "Docker Compose v2 ('docker compose') is required." >&2
  exit 1
}

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$ENVIRONMENT" == "development" && -f ".env" ]]; then
    echo "warning: .env.development not found; using .env for legacy development compatibility." >&2
    ENV_FILE=".env"
  elif [[ -f "$ENV_FILE.example" ]]; then
    echo "Missing $ENV_FILE. Copy $ENV_FILE.example to $ENV_FILE and fill in its values." >&2
    exit 1
  else
    echo "Missing environment file: $ENV_FILE" >&2
    exit 1
  fi
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN=python
else
  echo "Python 3 is required by the runtime contract validator." >&2
  exit 1
fi

PROFILE_RESOLVER_ARGS=(
  scripts/config/launcher_profiles.py
  --env-file "$ENV_FILE"
  --environment "$ENVIRONMENT"
)
for profile in "${PROFILES[@]}"; do
  PROFILE_RESOLVER_ARGS+=(--profile "$profile")
done
mapfile -t ACTIVE_PROFILES < <("$PYTHON_BIN" "${PROFILE_RESOLVER_ARGS[@]}")

COMPOSE=(
  docker compose
  --env-file "$ENV_FILE"
  -f docker-compose.yml
  -f "$OVERLAY"
)

for profile in "${ACTIVE_PROFILES[@]}"; do
  [[ -n "$profile" ]] && COMPOSE+=(--profile "$profile")
done

"${COMPOSE[@]}" config --quiet

KYC_REQUESTED=0
for profile in "${ACTIVE_PROFILES[@]}"; do
  [[ "$profile" == "kyc" ]] && KYC_REQUESTED=1
done
if [[ "$ENVIRONMENT" == "development" && "$KYC_REQUESTED" == "1" && "$DOWN" == "0" ]]; then
  echo "Verifying local KYC liveness models..."
  "$PYTHON_BIN" scripts/config/provision_kyc_models.py --env-file "$ENV_FILE"
fi

COMPOSE_MODEL="$("${COMPOSE[@]}" config --format json)"
VALIDATOR_ARGS=(
  scripts/config/runtime_contract.py
  --model -
  --env-file "$ENV_FILE"
  --environment "$ENVIRONMENT"
)
for profile in "${ACTIVE_PROFILES[@]}"; do
  VALIDATOR_ARGS+=(--profile "$profile")
done
printf '%s' "$COMPOSE_MODEL" | "$PYTHON_BIN" "${VALIDATOR_ARGS[@]}"

if ((FRESH)); then
  echo "Recreating containers for $ENVIRONMENT (volumes are preserved)..."
  "${COMPOSE[@]}" down --remove-orphans
fi

if ((DOWN)); then
  exec "${COMPOSE[@]}" down --remove-orphans
fi

if ((PULL)); then
  "${COMPOSE[@]}" pull
fi

if ((BUILD)); then
  if ((${#SERVICES[@]})); then
    "${COMPOSE[@]}" build "${SERVICES[@]}"
  else
    "${COMPOSE[@]}" build
  fi
fi

if ((${#SERVICES[@]})); then
  "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 180 "${SERVICES[@]}"
else
  "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 180
fi

LOCAL_AI_REQUESTED=0
for profile in "${ACTIVE_PROFILES[@]}"; do
  [[ "$profile" == "local-ai" ]] && LOCAL_AI_REQUESTED=1
done
OLLAMA_SELECTED=0
if ((${#SERVICES[@]} == 0)); then
  OLLAMA_SELECTED=1
else
  for service in "${SERVICES[@]}"; do
    [[ "$service" == "ollama" ]] && OLLAMA_SELECTED=1
  done
fi
if [[ "$ENVIRONMENT" == "development" && "$LOCAL_AI_REQUESTED" == "1" && "$OLLAMA_SELECTED" == "1" ]]; then
  echo "Verifying configured Ollama model..."
  "$PYTHON_BIN" scripts/config/provision_ollama_models.py --env-file "$ENV_FILE"
fi

# Caddyfile is bind-mounted. Compose does not reload a long-running Caddy
# process when only that file changes, so activate the current configuration on
# every edge/tunnel startup after validating it inside the running container.
EDGE_REQUESTED=0
for profile in "${ACTIVE_PROFILES[@]}"; do
  if [[ "$profile" == "edge" || "$profile" == "tunnel" ]]; then
    EDGE_REQUESTED=1
  fi
done

CADDY_SELECTED=0
if ((${#SERVICES[@]} == 0)); then
  CADDY_SELECTED=1
else
  for service in "${SERVICES[@]}"; do
    [[ "$service" == "caddy" ]] && CADDY_SELECTED=1
  done
fi

if ((EDGE_REQUESTED && CADDY_SELECTED)); then
  echo "Validating and reloading Caddy edge configuration..."

  if ! "${COMPOSE[@]}" exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
    "${COMPOSE[@]}" logs --no-color --tail 80 caddy >&2 || true
    echo "Caddy configuration is invalid. Edge configuration was not reloaded." >&2
    exit 1
  fi

  if ! "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    "${COMPOSE[@]}" logs --no-color --tail 80 caddy >&2 || true
    echo "Caddy failed to activate the latest edge configuration." >&2
    exit 1
  fi

  echo "Caddy edge configuration is active."
fi

TUNNEL_REQUESTED=0
for profile in "${ACTIVE_PROFILES[@]}"; do
  [[ "$profile" == "tunnel" ]] && TUNNEL_REQUESTED=1
done

TUNNEL_SELECTED=0
if ((${#SERVICES[@]} == 0)); then
  TUNNEL_SELECTED=1
else
  for service in "${SERVICES[@]}"; do
    [[ "$service" == "cloudflared" ]] && TUNNEL_SELECTED=1
  done
fi

if ((TUNNEL_REQUESTED && TUNNEL_SELECTED)); then
  echo "Checking Cloudflare Tunnel edge readiness..."
  TUNNEL_READY=0
  for _ in {1..30}; do
    if "$PYTHON_BIN" scripts/config/tunnel_readiness.py --env-file "$ENV_FILE"; then
      TUNNEL_READY=1
      break
    fi

    # Metrics are host-published in development. For environments that keep
    # the metrics endpoint private, retain an all-history registration fallback.
    if "${COMPOSE[@]}" logs --no-color cloudflared 2>&1 | grep -q "Registered tunnel connection"; then
      echo "Cloudflare Tunnel registration found in connector history (metrics endpoint not reachable from host)."
      TUNNEL_READY=1
      break
    fi

    sleep 2
  done

  if ((!TUNNEL_READY)); then
    "${COMPOSE[@]}" ps cloudflared
    "${COMPOSE[@]}" logs --no-color --tail 80 cloudflared >&2 || true
    echo "Cloudflare Tunnel has no active edge connection after 60 seconds. Check the token, outbound network, and tunnel configuration." >&2
    exit 1
  fi
  echo "Cloudflare Tunnel is connected to the edge."
fi

"${COMPOSE[@]}" ps
