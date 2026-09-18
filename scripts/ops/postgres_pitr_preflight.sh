#!/usr/bin/env bash
set -euo pipefail

command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 1
}

: "${DATABASE_URL:?DATABASE_URL is required}"

query() {
  psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'
}

wal_level="$(query 'SHOW wal_level')"
archive_mode="$(query 'SHOW archive_mode')"
archive_command="$(query 'SHOW archive_command')"
archive_timeout="$(query 'SHOW archive_timeout')"
max_wal_senders="$(query 'SHOW max_wal_senders')"
in_recovery="$(query 'SELECT pg_is_in_recovery()')"

case "$wal_level" in
  replica|logical) ;;
  *)
    echo "PITR preflight failed: wal_level=$wal_level; expected replica or logical" >&2
    exit 1
    ;;
esac

[[ "$archive_mode" == "on" || "$archive_mode" == "always" ]] || {
  echo "PITR preflight failed: archive_mode=$archive_mode" >&2
  exit 1
}

trimmed_archive_command="$(printf '%s' "$archive_command" | xargs)"
[[ -n "$trimmed_archive_command" && "$trimmed_archive_command" != "(disabled)" && "$trimmed_archive_command" != "/bin/true" && "$trimmed_archive_command" != "true" ]] || {
  echo "PITR preflight failed: archive_command is disabled or a no-op" >&2
  exit 1
}

[[ "$max_wal_senders" =~ ^[0-9]+$ ]] && (( max_wal_senders > 0 )) || {
  echo "PITR preflight failed: max_wal_senders must be greater than zero" >&2
  exit 1
}

echo "PostgreSQL PITR prerequisites are configured."
echo "wal_level=$wal_level archive_mode=$archive_mode archive_timeout=$archive_timeout max_wal_senders=$max_wal_senders in_recovery=$in_recovery"
echo "This verifies database-side prerequisites only; it does not prove offsite WAL delivery or restore success."
