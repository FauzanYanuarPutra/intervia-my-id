#!/usr/bin/env bash

set -euo pipefail

MODE="dev"
ENV_FILE=""
NO_BUILD=0
PULL_LATEST=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.docker-build-state.sh.tsv"
COMPOSE_IS_LEGACY_V1=0
COMPOSE_BIN=()

usage() {
  cat <<'EOF'
Usage: ./up-super-fast.sh [options] [service ...]

Options:
  -m, --mode <dev|prod>   Run in dev or prod mode. Default: dev
  -e, --env-file <path>   Env file for compose. Default: .env.development in dev, .env.production in prod
      --no-build          Skip compose build
      --pull-latest       In prod mode, pull images before starting
  -h, --help              Show this help

Examples:
  ./up-super-fast.sh
  ./up-super-fast.sh www crm
  ./up-super-fast.sh --no-build
  ./up-super-fast.sh --mode prod --pull-latest

In dev mode the script only rebuilds services whose inputs changed and
reuses existing local images for everything else.
EOF
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

init_compose() {
  local version_output=""

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN=(docker compose)
    COMPOSE_IS_LEGACY_V1=0
    return 0
  fi

  if ! docker-compose version >/dev/null 2>&1; then
    die "Docker Compose not found. Install Docker Compose v2 or docker-compose."
  fi

  COMPOSE_BIN=(docker-compose)
  version_output="$(docker-compose version 2>/dev/null || true)"
  if grep -Eqi '(^|[[:space:]])(docker-compose[[:space:]]+)?version[[:space:]]+1\.' <<<"$version_output"; then
    COMPOSE_IS_LEGACY_V1=1
  else
    COMPOSE_IS_LEGACY_V1=0
  fi
}

compose_cmd() {
  "${COMPOSE_BIN[@]}" "$@"
}

configure_build_backend() {
  local buildkit_requested compose_cli_requested

  buildkit_requested="${DOCKER_BUILDKIT:-1}"
  compose_cli_requested="${COMPOSE_DOCKER_CLI_BUILD:-1}"

  if [[ "$buildkit_requested" != "1" || "$compose_cli_requested" != "1" ]]; then
    export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
    export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-0}"
    return 0
  fi

  if docker buildx version >/dev/null 2>&1; then
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    return 0
  fi

  export DOCKER_BUILDKIT=0
  export COMPOSE_DOCKER_CLI_BUILD=0
  echo "Docker BuildKit requested but docker buildx is unavailable. Falling back to the legacy builder."
}

remove_legacy_compose_service_containers() {
  local project_name="$1"
  shift

  (( COMPOSE_IS_LEGACY_V1 == 1 )) || return 0
  [[ "$#" -gt 0 ]] || return 0

  local service container_id
  local -a container_ids=()

  for service in "$@"; do
    while IFS= read -r container_id; do
      [[ -n "$container_id" ]] || continue
      container_ids+=("$container_id")
    done < <(
      docker ps -aq \
        --filter "label=com.docker.compose.project=$project_name" \
        --filter "label=com.docker.compose.service=$service"
    )
  done

  [[ "${#container_ids[@]}" -gt 0 ]] || return 0

  echo "Legacy docker-compose v1 detected. Removing stale containers before recreate: $*"
  docker rm -f "${container_ids[@]}" >/dev/null
}

test_local_image() {
  local image_name="$1"
  docker image inspect "$image_name" >/dev/null 2>&1
}

pull_image_with_retry() {
  local image_name="$1"
  local attempt

  for attempt in 1 2 3; do
    echo "Pulling base image: $image_name (attempt $attempt/3)"
    if docker pull "$image_name"; then
      return 0
    fi

    if (( attempt < 3 )); then
      sleep $(( attempt * 3 ))
    fi
  done

  return 1
}

warm_base_images_for_services() {
  local service image_name
  local -A seen_images=()
  local images_to_pull=()

  for service in "$@"; do
    read -r -a service_images <<<"${SERVICE_BASE_IMAGES[$service]:-}"
    for image_name in "${service_images[@]}"; do
      [[ -n "$image_name" ]] || continue
      [[ -n "${seen_images[$image_name]:-}" ]] && continue
      seen_images["$image_name"]=1

      if test_local_image "$image_name"; then
        continue
      fi

      images_to_pull+=("$image_name")
    done
  done

  if [[ "${#images_to_pull[@]}" -eq 0 ]]; then
    return 0
  fi

  echo "Warming missing base images before build..."
  for image_name in "${images_to_pull[@]}"; do
    pull_image_with_retry "$image_name"
  done
}

get_latest_write_epoch() {
  local latest=0
  local relative_path full_path file_epoch

  for relative_path in "$@"; do
    full_path="$SCRIPT_DIR/$relative_path"
    [[ -e "$full_path" ]] || continue

    if [[ -f "$full_path" ]]; then
      file_epoch="$(stat -c %Y "$full_path" 2>/dev/null || stat -f %m "$full_path")"
      if [[ "$file_epoch" =~ ^[0-9]+$ ]] && (( file_epoch > latest )); then
        latest="$file_epoch"
      fi
      continue
    fi

    while IFS= read -r file_epoch; do
      file_epoch="${file_epoch%%.*}"
      if [[ "$file_epoch" =~ ^[0-9]+$ ]] && (( file_epoch > latest )); then
        latest="$file_epoch"
      fi
    done < <(
      find "$full_path" \
        \( -type d \( \
          -name .git -o \
          -name node_modules -o \
          -name .next -o \
          -name .turbo -o \
          -name dist -o \
          -name target -o \
          -name .cache -o \
          -name .gradle -o \
          -name playwright-report -o \
          -name coverage -o \
          -name test-results \
        \) -prune \) \
        -o -type f -printf '%T@\n' 2>/dev/null
    )
  done

  printf '%s\n' "$latest"
}

declare -A STATE_TICKS=()
declare -A STATE_BUILT_AT=()

load_state_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0

  while IFS=$'\t' read -r service tick built_at; do
    [[ -n "$service" ]] || continue
    [[ "$tick" =~ ^[0-9]+$ ]] || continue
    STATE_TICKS["$service"]="$tick"
    STATE_BUILT_AT["$service"]="$built_at"
  done < "$path"
}

save_state_file() {
  local path="$1"
  local tmp_path

  tmp_path="$(mktemp "${path}.XXXXXX")"
  while IFS= read -r service; do
    printf '%s\t%s\t%s\n' \
      "$service" \
      "${STATE_TICKS[$service]}" \
      "${STATE_BUILT_AT[$service]:-}" >> "$tmp_path"
  done < <(printf '%s\n' "${!STATE_TICKS[@]}" | sort)

  mv "$tmp_path" "$path"
}

get_project_container_ids() {
  local project_name="$1"
  local running_only="${2:-0}"

  if [[ "$running_only" -eq 1 ]]; then
    docker ps -q --filter "label=com.docker.compose.project=$project_name"
  else
    docker ps -a -q --filter "label=com.docker.compose.project=$project_name"
  fi
}

contains_service() {
  local needle="$1"
  shift || true
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

filter_group() {
  local -n out_ref="$1"
  shift
  out_ref=()

  local svc
  for svc in "$@"; do
    if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]] || contains_service "$svc" "${SELECTED_SERVICES[@]}"; then
      out_ref+=("$svc")
    fi
  done
}

SELECTED_SERVICES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mode)
      [[ $# -ge 2 ]] || die "Missing value for $1"
      MODE="$2"
      shift 2
      ;;
    -e|--env-file)
      [[ $# -ge 2 ]] || die "Missing value for $1"
      ENV_FILE="$2"
      shift 2
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    --pull-latest)
      PULL_LATEST=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        SELECTED_SERVICES+=("$1")
        shift
      done
      ;;
    -*)
      die "Unknown option: $1"
      ;;
    *)
      SELECTED_SERVICES+=("$1")
      shift
      ;;
  esac
done

case "$MODE" in
  dev|prod) ;;
  *)
    die "Invalid mode: $MODE"
    ;;
esac

if [[ -z "$ENV_FILE" ]]; then
  if [[ "$MODE" == "prod" ]]; then
    ENV_FILE=".env.production"
  else
    ENV_FILE=".env.development"
  fi
fi

cd "$SCRIPT_DIR"

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-1}"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
export BUILDKIT_PROGRESS="${BUILDKIT_PROGRESS:-plain}"

init_compose
configure_build_backend

if (( COMPOSE_IS_LEGACY_V1 == 1 )); then
  echo "Legacy docker-compose v1 detected. Wrapper mode will avoid known recreate bugs where possible."
  if [[ ! "${COMPOSE_PARALLEL_LIMIT:-}" =~ ^[0-9]+$ ]] || (( COMPOSE_PARALLEL_LIMIT < 2 )); then
    export COMPOSE_PARALLEL_LIMIT=2
  fi
fi

if [[ "$MODE" == "prod" ]]; then
  [[ -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE"
  compose_files=(-f docker-compose.yml -f docker-compose.prod.yml)

  if [[ "$PULL_LATEST" -eq 1 ]]; then
    echo "Pulling latest production images..."
    if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]]; then
      compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" pull
    else
      compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" pull "${SELECTED_SERVICES[@]}"
    fi
  fi

  echo "Starting production services without build..."
  if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]]; then
    compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" up -d --no-build --no-recreate --remove-orphans
    compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" ps
  else
    compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" up -d --no-build --no-recreate --remove-orphans "${SELECTED_SERVICES[@]}"
    compose_cmd --env-file "$ENV_FILE" "${compose_files[@]}" ps "${SELECTED_SERVICES[@]}"
  fi
  exit 0
fi

[[ -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE"

mapfile -t AVAILABLE_SERVICES < <(compose_cmd --env-file "$ENV_FILE" config --services)
declare -A AVAILABLE_SERVICE_LOOKUP=()
for svc in "${AVAILABLE_SERVICES[@]}"; do
  AVAILABLE_SERVICE_LOOKUP["$svc"]=1
done

compose_project_name="${COMPOSE_PROJECT_NAME:-$(basename "$SCRIPT_DIR")}"

declare -A SERVICE_INPUTS=(
  [identity_service]="backend/rust_apps docker-compose.yml"
  [marketplace_service]="backend/rust_apps docker-compose.yml"
  [ai_service]="backend/rust_apps docker-compose.yml"
  [chat_service]="backend/chat_service docker-compose.yml"
  [ocr_service]="ai/ocr_paddle docker-compose.yml"
  [liveness_service]="ai/liveness docker-compose.yml"
  [www]="frontend/www frontend/shared frontend/.dockerignore docker-compose.yml"
  [cms]="frontend/cms frontend/shared frontend/.dockerignore docker-compose.yml"
  [crm]="frontend/crm frontend/shared frontend/.dockerignore docker-compose.yml"
)

declare -A SERVICE_IMAGES=(
  [identity_service]="${compose_project_name}-identity_service"
  [marketplace_service]="${compose_project_name}-marketplace_service"
  [ai_service]="${compose_project_name}-ai_service"
  [chat_service]="${compose_project_name}-chat_service"
  [ocr_service]="${compose_project_name}-ocr_service"
  [liveness_service]="${compose_project_name}-liveness_service"
  [www]="${compose_project_name}-www"
  [cms]="${compose_project_name}-cms"
  [crm]="${compose_project_name}-crm"
)

declare -A SERVICE_BASE_IMAGES=(
  [identity_service]="rustlang/rust:nightly-bookworm debian:bookworm-slim"
  [marketplace_service]="rustlang/rust:nightly-bookworm debian:bookworm-slim"
  [ai_service]="rustlang/rust:nightly-bookworm debian:bookworm-slim"
  [chat_service]="docker/dockerfile:1.7 elixir:1.15-slim erlang:26-slim"
  [ocr_service]="python:3.9-slim"
  [liveness_service]="python:3.11-slim"
  [www]="docker/dockerfile:1.7 node:20-bullseye-slim"
  [cms]="docker/dockerfile:1.7 node:20-bullseye-slim"
  [crm]="docker/dockerfile:1.7 node:20-bullseye-slim"
)

build_groups=(
  "identity_service marketplace_service ai_service"
  "chat_service"
  "ocr_service liveness_service"
  "www cms crm"
)

load_state_file "$STATE_FILE"

declare -A CURRENT_TICKS_BY_SERVICE=()
declare -A IMAGE_EXISTS_BY_SERVICE=()
services_to_build=()

for service in "${!SERVICE_INPUTS[@]}"; do
  if [[ -z "${AVAILABLE_SERVICE_LOOKUP[$service]:-}" ]]; then
    continue
  fi

  if [[ "${#SELECTED_SERVICES[@]}" -gt 0 ]] && ! contains_service "$service" "${SELECTED_SERVICES[@]}"; then
    continue
  fi

  read -r -a input_paths <<<"${SERVICE_INPUTS[$service]}"
  CURRENT_TICKS_BY_SERVICE["$service"]="$(get_latest_write_epoch "${input_paths[@]}")"

  if test_local_image "${SERVICE_IMAGES[$service]}"; then
    IMAGE_EXISTS_BY_SERVICE["$service"]=1
  else
    IMAGE_EXISTS_BY_SERVICE["$service"]=0
  fi

  previous_tick=0
  if [[ -n "${STATE_TICKS[$service]:-}" ]]; then
    previous_tick="${STATE_TICKS[$service]}"
  elif [[ "${IMAGE_EXISTS_BY_SERVICE[$service]}" -eq 1 ]]; then
    previous_tick="${CURRENT_TICKS_BY_SERVICE[$service]}"
    STATE_TICKS["$service"]="$previous_tick"
    STATE_BUILT_AT["$service"]="bootstrap-existing-image"
  fi

  if [[ "$NO_BUILD" -eq 0 ]]; then
    if [[ "${IMAGE_EXISTS_BY_SERVICE[$service]}" -eq 0 ]] || (( CURRENT_TICKS_BY_SERVICE[$service] > previous_tick )); then
      services_to_build+=("$service")
    fi
  fi
done

if [[ "$NO_BUILD" -eq 0 ]]; then
  if [[ "${#services_to_build[@]}" -gt 0 ]]; then
    warm_base_images_for_services "${services_to_build[@]}"

    local_group=()
    for group in "${build_groups[@]}"; do
      read -r -a group_services <<<"$group"
      local_group=()
      for svc in "${group_services[@]}"; do
        [[ -n "${AVAILABLE_SERVICE_LOOKUP[$svc]:-}" ]] || continue
        contains_service "$svc" "${services_to_build[@]}" || continue
        local_group+=("$svc")
      done

      if [[ "${#local_group[@]}" -eq 0 ]]; then
        continue
      fi

      echo "Building services: ${local_group[*]}"
      compose_cmd --env-file "$ENV_FILE" build "${local_group[@]}"
    done

    build_timestamp="$(date -Iseconds)"
    for service in "${services_to_build[@]}"; do
      STATE_TICKS["$service"]="${CURRENT_TICKS_BY_SERVICE[$service]}"
      STATE_BUILT_AT["$service"]="$build_timestamp"
    done
    save_state_file "$STATE_FILE"
  else
    echo "No image rebuild needed. Reusing existing local images."
    for service in "${!CURRENT_TICKS_BY_SERVICE[@]}"; do
      if [[ -z "${STATE_TICKS[$service]:-}" ]] && [[ "${IMAGE_EXISTS_BY_SERVICE[$service]}" -eq 1 ]]; then
        STATE_TICKS["$service"]="${CURRENT_TICKS_BY_SERVICE[$service]}"
        STATE_BUILT_AT["$service"]="bootstrap-no-build"
      fi
    done
    save_state_file "$STATE_FILE"
  fi
else
  echo "Skipping image rebuild because --no-build was requested."
  for service in "${!CURRENT_TICKS_BY_SERVICE[@]}"; do
    if [[ -z "${STATE_TICKS[$service]:-}" ]] && [[ "${IMAGE_EXISTS_BY_SERVICE[$service]}" -eq 1 ]]; then
      STATE_TICKS["$service"]="${CURRENT_TICKS_BY_SERVICE[$service]}"
      STATE_BUILT_AT["$service"]="bootstrap-no-build"
    fi
  done
  save_state_file "$STATE_FILE"
fi

echo "Starting services..."
if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]]; then
  if [[ "${#services_to_build[@]}" -gt 0 ]]; then
    remove_legacy_compose_service_containers "$compose_project_name" "${services_to_build[@]}"
    compose_cmd --env-file "$ENV_FILE" up -d --no-build "${services_to_build[@]}"
    if ! compose_cmd --env-file "$ENV_FILE" start; then
      compose_cmd --env-file "$ENV_FILE" up -d --no-build --no-recreate
    fi
  else
    mapfile -t all_project_container_ids < <(get_project_container_ids "$compose_project_name" 0)
    if [[ "${#all_project_container_ids[@]}" -gt 0 ]]; then
      mapfile -t running_project_container_ids < <(get_project_container_ids "$compose_project_name" 1)
      declare -A RUNNING_LOOKUP=()
      for running_id in "${running_project_container_ids[@]}"; do
        RUNNING_LOOKUP["$running_id"]=1
      done

      to_start_ids=()
      for container_id in "${all_project_container_ids[@]}"; do
        [[ -n "${RUNNING_LOOKUP[$container_id]:-}" ]] && continue
        to_start_ids+=("$container_id")
      done

      if [[ "${#to_start_ids[@]}" -gt 0 ]]; then
        docker start "${to_start_ids[@]}" >/dev/null
      else
        echo "All containers already running. Skip start/recreate."
      fi
    else
      compose_cmd --env-file "$ENV_FILE" up -d --no-build --no-recreate
    fi
  fi
  compose_cmd --env-file "$ENV_FILE" ps
else
  if (( COMPOSE_IS_LEGACY_V1 == 1 )); then
    remove_legacy_compose_service_containers "$compose_project_name" "${SELECTED_SERVICES[@]}"
  elif [[ "${#services_to_build[@]}" -gt 0 ]]; then
    remove_legacy_compose_service_containers "$compose_project_name" "${services_to_build[@]}"
  fi
  compose_cmd --env-file "$ENV_FILE" up -d --no-build "${SELECTED_SERVICES[@]}"
  compose_cmd --env-file "$ENV_FILE" ps "${SELECTED_SERVICES[@]}"
fi
