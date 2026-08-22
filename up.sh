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

# Keep compatibility with existing local installations that still use `.env`.
# Staging and production remain fail-closed and require their explicit files.
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

COMPOSE=(
  docker compose
  --env-file "$ENV_FILE"
  -f docker-compose.yml
  -f "$OVERLAY"
)

for profile in "${PROFILES[@]}"; do
  IFS=',' read -r -a split_profiles <<< "$profile"
  for item in "${split_profiles[@]}"; do
    if [[ -n "$item" ]]; then
      COMPOSE+=(--profile "$item")
      ACTIVE_PROFILES+=("$item")
    fi
  done
done

# Fail before changing container state if the merged Compose model is invalid.
"${COMPOSE[@]}" config --quiet

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN=python
else
  echo "Python 3 is required by the runtime contract validator." >&2
  exit 1
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
  echo "Waiting for Cloudflare Tunnel edge registration..."
  TUNNEL_READY=0
  for _ in {1..30}; do
    if "${COMPOSE[@]}" logs --no-color --since 2m cloudflared 2>&1 | grep -q "Registered tunnel connection"; then
      TUNNEL_READY=1
      break
    fi
    sleep 2
  done
  if ((!TUNNEL_READY)); then
    "${COMPOSE[@]}" ps cloudflared
    echo "Cloudflare Tunnel did not register an edge connection within 60 seconds. Check the rotated token, tunnel DNS, and cloudflared logs." >&2
    exit 1
  fi
  echo "Cloudflare Tunnel registered with the edge."
fi

"${COMPOSE[@]}" ps
