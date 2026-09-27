#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${MARKETPLACE_BASE_URL:-http://127.0.0.1:${PORT_MARKETPLACE:-8081}}"
ATTEMPTS="${DATA_BOOTSTRAP_ATTEMPTS:-60}"
DELAY="${DATA_BOOTSTRAP_DELAY_SECONDS:-5}"

for ((attempt=1; attempt<=ATTEMPTS; attempt++)); do
  response="$(curl --fail --silent --show-error --max-time 10 "${BASE_URL}/v1/data/bootstrap-status" 2>/dev/null || true)"

  if [[ -n "$response" ]] && echo "$response" | jq -e .status >/dev/null 2>&1; then
    status="$(echo "$response" | jq -r '.status')"
    persistent_sources="$(echo "$response" | jq -r '.persistent_sources')"
    active_jobs="$(echo "$response" | jq -r '.active_jobs')"
    failed_jobs_24h="$(echo "$response" | jq -r '.failed_jobs_24h')"
    accepted_records="$(echo "$response" | jq -r '.accepted_records')"
    published_references="$(echo "$response" | jq -r '.published_references')"
    aggregate_references="$(echo "$response" | jq -r '.aggregate_references')"

    echo "data bootstrap attempt=${attempt}/${ATTEMPTS} status=${status} persistent_sources=${persistent_sources} active_jobs=${active_jobs} failed_jobs_24h=${failed_jobs_24h} accepted_records=${accepted_records} published_references=${published_references} aggregate_references=${aggregate_references}"

    if [[ "$status" == "ready" ]]; then
      echo "::group::Data bootstrap sources"
      echo "$response" | jq -r '.sources[] | [
        .source_key,
        .source_kind,
        (.enabled|tostring),
        (.storage_allowed|tostring),
        .latest_job_status,
        (.latest_accepted_count|tostring),
        (.latest_error // "")
      ] | @tsv'
      echo "::endgroup::"
      exit 0
    fi

    if [[ "$status" == "error" && "$active_jobs" == "0" ]]; then
      echo "::group::Data bootstrap diagnostics"
      echo "$response" | jq .
      echo "::endgroup::"
      exit 1
    fi
  else
    echo "data bootstrap endpoint unavailable (${attempt}/${ATTEMPTS})"
  fi

  sleep "$DELAY"
done

echo "::group::Final data bootstrap response"
curl --fail --silent --show-error --max-time 10 "${BASE_URL}/v1/data/bootstrap-status" | jq .
echo "::endgroup::"
exit 1
