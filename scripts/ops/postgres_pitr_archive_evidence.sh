#!/usr/bin/env bash
set -euo pipefail

command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 1
}

: "${DATABASE_URL:?DATABASE_URL is required}"

force_switch="${FORCE_WAL_SWITCH:-}"
wait_seconds="${ARCHIVE_WAIT_SECONDS:-60}"
poll_seconds="${ARCHIVE_POLL_SECONDS:-2}"

[[ "$wait_seconds" =~ ^[0-9]+$ ]] && (( wait_seconds >= 1 && wait_seconds <= 600 )) || {
  echo "ARCHIVE_WAIT_SECONDS must be an integer between 1 and 600" >&2
  exit 1
}
[[ "$poll_seconds" =~ ^[0-9]+$ ]] && (( poll_seconds >= 1 && poll_seconds <= 30 )) || {
  echo "ARCHIVE_POLL_SECONDS must be an integer between 1 and 30" >&2
  exit 1
}

query() {
  psql "$DATABASE_URL" -X -A -t -F '|' -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'
}

archiver_snapshot() {
  query "
    SELECT
      archived_count::text,
      failed_count::text,
      COALESCE(last_archived_wal, ''),
      COALESCE(last_failed_wal, ''),
      COALESCE(EXTRACT(EPOCH FROM (NOW() - last_archived_time))::bigint, -1)::text,
      CASE
        WHEN last_failed_time IS NULL THEN 'false'
        WHEN last_archived_time IS NULL THEN 'true'
        ELSE (last_failed_time > last_archived_time)::text
      END
    FROM pg_stat_archiver
  "
}

IFS='|' read -r archived_before failed_before last_archived last_failed archive_age failure_newer <<<"$(archiver_snapshot)"

[[ "$archived_before" =~ ^[0-9]+$ ]] || {
  echo "Unable to read pg_stat_archiver archived_count" >&2
  exit 1
}
[[ "$failed_before" =~ ^[0-9]+$ ]] || {
  echo "Unable to read pg_stat_archiver failed_count" >&2
  exit 1
}

if [[ "$failure_newer" == "true" ]]; then
  echo "PITR archive evidence failed: latest archive attempt is a failure (last_failed_wal=$last_failed)" >&2
  exit 1
fi

if [[ "$force_switch" == "I_UNDERSTAND_WAL_SWITCH" ]]; then
  in_recovery="$(query 'SELECT pg_is_in_recovery()')"
  [[ "$in_recovery" == "f" || "$in_recovery" == "false" ]] || {
    echo "Refusing pg_switch_wal() while connected to a recovery/standby server" >&2
    exit 1
  }

  query 'SELECT pg_switch_wal()' >/dev/null
  deadline=$(( $(date +%s) + wait_seconds ))

  while (( $(date +%s) <= deadline )); do
    IFS='|' read -r archived_now failed_now last_archived last_failed archive_age failure_newer <<<"$(archiver_snapshot)"
    if [[ "$failure_newer" == "true" ]]; then
      echo "PITR archive evidence failed after WAL switch: latest archive attempt failed (last_failed_wal=$last_failed)" >&2
      exit 1
    fi
    if [[ "$archived_now" =~ ^[0-9]+$ ]] && (( archived_now > archived_before )); then
      echo "PostgreSQL WAL archive probe succeeded."
      echo "archived_count_before=$archived_before archived_count_after=$archived_now last_archived_wal=$last_archived archive_age_seconds=$archive_age"
      echo "This proves PostgreSQL's archive command completed for the probe; it does not prove independent-storage durability or timestamp restore correctness."
      exit 0
    fi
    sleep "$poll_seconds"
  done

  echo "PITR archive evidence failed: archived_count did not advance within ${wait_seconds}s after pg_switch_wal()" >&2
  exit 1
fi

if (( archived_before < 1 )) || [[ -z "$last_archived" ]]; then
  echo "PITR archive evidence unavailable: pg_stat_archiver has no successful archive yet." >&2
  echo "Run with FORCE_WAL_SWITCH=I_UNDERSTAND_WAL_SWITCH during an approved operational check to create a bounded probe." >&2
  exit 1
fi

echo "PostgreSQL archiver has successful history."
echo "archived_count=$archived_before failed_count=$failed_before last_archived_wal=$last_archived archive_age_seconds=$archive_age"
echo "For active proof, rerun with FORCE_WAL_SWITCH=I_UNDERSTAND_WAL_SWITCH. This does not prove independent-storage durability or timestamp restore correctness."
