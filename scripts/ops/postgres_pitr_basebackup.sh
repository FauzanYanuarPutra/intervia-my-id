#!/usr/bin/env bash
set -euo pipefail

command -v pg_basebackup >/dev/null 2>&1 || { echo "pg_basebackup is required" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 1; }

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ROOT:?BACKUP_ROOT is required}"

timestamp="${BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
backup_dir="${BACKUP_ROOT%/}/${timestamp}"
tmp_dir="${backup_dir}.partial"

case "$BACKUP_ROOT" in
  "."|"./"|"/") echo "Refusing unsafe BACKUP_ROOT=$BACKUP_ROOT" >&2; exit 1 ;;
esac

rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"
start_lsn="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT pg_current_wal_lsn()")"
start_time="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT clock_timestamp()")"

pg_basebackup   --dbname="$DATABASE_URL"   --pgdata="$tmp_dir/base"   --format=tar   --gzip   --wal-method=stream   --checkpoint=fast   --label="lajukan-pitr-${timestamp}"   --progress

end_lsn="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT pg_current_wal_lsn()")"
end_time="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT clock_timestamp()")"

(
  cd "$tmp_dir"
  find base -type f -print0 | sort -z | xargs -0 sha256sum > checksums.sha256
)

cat > "$tmp_dir/manifest.env" <<EOF
backup_timestamp=$timestamp
backup_started_at=$start_time
backup_completed_at=$end_time
start_lsn=$start_lsn
end_lsn=$end_lsn
format=pg_basebackup_tar_gzip
wal_method=stream
EOF

mv "$tmp_dir" "$backup_dir"
echo "$backup_dir"
