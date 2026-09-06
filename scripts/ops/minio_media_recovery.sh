#!/usr/bin/env bash
set -euo pipefail
umask 077

mode="${1:-inventory}"
bucket="${MINIO_BUCKET:-laju-chat}"
active_alias="${ACTIVE_ALIAS:-active}"
source_alias="${SOURCE_ALIAS:-historical}"

tmp_files=()
cleanup() {
  if ((${#tmp_files[@]})); then
    rm -f -- "${tmp_files[@]}"
  fi
}
trap cleanup EXIT

make_tmp() {
  local file
  file="$(mktemp)"
  tmp_files+=("$file")
  printf '%s\n' "$file"
}

inventory_volumes() {
  echo "Docker volumes that may contain MinIO data:"
  docker volume ls --format '{{.Name}}' | grep -Ei '(^|[_-])minio([_-]|$)|minio.*data|data.*minio' || true
  echo
  echo "Current MinIO container mounts:"
  ids="$(docker ps -aq --filter 'name=minio')"
  if [[ -n "$ids" ]]; then
    docker inspect $ids --format '{{.Name}} {{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}} -> {{.Source}}{{end}}{{end}}'
  else
    echo "No MinIO container found."
  fi
}

require_mc() {
  command -v mc >/dev/null 2>&1 || {
    echo "MinIO client (mc) is required for compare/recover mode." >&2
    exit 2
  }
}

require_aliases() {
  require_mc
  mc stat "$active_alias/$bucket" >/dev/null
  mc stat "$source_alias/$bucket" >/dev/null
}

list_objects() {
  local alias="$1"
  mc find "$alias/$bucket" --type f --print '{path}' 2>/dev/null |
    sed "s#^$alias/$bucket/##" |
    awk '/^(content|forum)\//' |
    sort -u
}

compare_objects() {
  require_aliases
  local active_file source_file
  active_file="$(make_tmp)"
  source_file="$(make_tmp)"
  list_objects "$active_alias" > "$active_file"
  list_objects "$source_alias" > "$source_file"
  echo "Objects present in historical source but missing from active bucket:"
  comm -23 "$source_file" "$active_file"
}

recover_objects() {
  [[ "${CONFIRM_ADDITIVE_RECOVERY:-}" == "YES" ]] || {
    echo "Refusing recovery. Set CONFIRM_ADDITIVE_RECOVERY=YES after reviewing compare output." >&2
    exit 3
  }
  require_aliases
  local active_file source_file missing_file recovered key
  active_file="$(make_tmp)"
  source_file="$(make_tmp)"
  missing_file="$(make_tmp)"
  list_objects "$active_alias" > "$active_file"
  list_objects "$source_alias" > "$source_file"
  comm -23 "$source_file" "$active_file" > "$missing_file"

  recovered=0
  while IFS= read -r key; do
    [[ -n "$key" ]] || continue
    case "$key" in
      content/*|forum/*) ;;
      *) echo "Skipping non-public key: $key" >&2; continue ;;
    esac
    if mc stat "$active_alias/$bucket/$key" >/dev/null 2>&1; then
      echo "Already exists, skip: $key"
      continue
    fi
    mc cp "$source_alias/$bucket/$key" "$active_alias/$bucket/$key" >/dev/null
    mc stat "$active_alias/$bucket/$key" >/dev/null
    echo "Recovered: $key"
    recovered=$((recovered + 1))
  done < "$missing_file"
  echo "Recovered $recovered missing public media objects. Existing active objects were never overwritten."
}

case "$mode" in
  inventory) inventory_volumes ;;
  compare) compare_objects ;;
  recover) recover_objects ;;
  *)
    echo "Usage: $0 {inventory|compare|recover}" >&2
    echo "compare/recover require mc aliases ACTIVE_ALIAS (default active) and SOURCE_ALIAS (default historical)." >&2
    exit 64
    ;;
esac
