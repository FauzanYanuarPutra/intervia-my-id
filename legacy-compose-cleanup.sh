#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$PWD")}"
REMOVE_ALL=0
SERVICES=()

usage() {
  cat <<'EOF'
Usage: ./legacy-compose-cleanup.sh [options] [service ...]

Removes stale containers from a Compose project. This is useful when legacy
docker-compose v1 fails during recreate with:
  KeyError: 'ContainerConfig'

Options:
  -p, --project-name <name>   Override Compose project name
  -a, --all                   Remove all containers from the project
  -h, --help                  Show this help

Examples:
  ./legacy-compose-cleanup.sh cms crm
  ./legacy-compose-cleanup.sh www cms crm
  ./legacy-compose-cleanup.sh --all
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--project-name)
      [[ $# -ge 2 ]] || {
        echo "Missing value for $1" >&2
        exit 1
      }
      PROJECT_NAME="$2"
      shift 2
      ;;
    -a|--all)
      REMOVE_ALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        SERVICES+=("$1")
        shift
      done
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      SERVICES+=("$1")
      shift
      ;;
  esac
done

if (( REMOVE_ALL == 0 )) && [[ "${#SERVICES[@]}" -eq 0 ]]; then
  echo "Specify one or more services, or use --all." >&2
  exit 1
fi

container_ids=()

if (( REMOVE_ALL == 1 )); then
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    container_ids+=("$container_id")
  done < <(
    docker ps -aq --filter "label=com.docker.compose.project=$PROJECT_NAME"
  )
else
  for service in "${SERVICES[@]}"; do
    while IFS= read -r container_id; do
      [[ -n "$container_id" ]] || continue
      container_ids+=("$container_id")
    done < <(
      docker ps -aq \
        --filter "label=com.docker.compose.project=$PROJECT_NAME" \
        --filter "label=com.docker.compose.service=$service"
    )
  done
fi

if [[ "${#container_ids[@]}" -eq 0 ]]; then
  echo "No matching containers found for project '$PROJECT_NAME'."
  exit 0
fi

if (( REMOVE_ALL == 1 )); then
  echo "Removing stale Compose containers for project '$PROJECT_NAME'..."
else
  echo "Removing stale Compose containers for project '$PROJECT_NAME' and services: ${SERVICES[*]}"
fi

docker rm -f "${container_ids[@]}"
