#!/usr/bin/env bash
set -euo pipefail

compose_args=("$@")
service="${MINIO_SERVICE:-minio}"
bucket="${MINIO_BUCKET:-laju-chat}"
probe_key="_health/deploy-$(date +%s)-$$.txt"
probe_body="lajukan-media-durability-$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  docker compose "${compose_args[@]}" exec -T "$service" sh -ec \
    'mc rm --force "local/$1/$2" >/dev/null 2>&1 || true' -- "$bucket" "$probe_key" || true
}
trap cleanup EXIT

docker compose "${compose_args[@]}" exec -T "$service" sh -ec '
  set -eu
  bucket="$1"
  key="$2"
  expected="$3"
  mc alias set local http://localhost:9002 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc ready local >/dev/null
  mc stat "local/$bucket" >/dev/null
  printf "%s" "$expected" | mc pipe "local/$bucket/$key" >/dev/null
  actual="$(mc cat "local/$bucket/$key")"
  [ "$actual" = "$expected" ]
  mc stat "local/$bucket/$key" >/dev/null
' -- "$bucket" "$probe_key" "$probe_body"

echo "MinIO durability probe passed for bucket $bucket."
