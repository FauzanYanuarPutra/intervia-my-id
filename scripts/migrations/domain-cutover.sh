#!/usr/bin/env bash
set -Eeuo pipefail

# Lajukan domain cutover runner.
#
# This command is intentionally explicit: it performs the real backfill only when
# the operator supplies live PostgreSQL credentials. It never guesses database
# credentials and never drops the legacy database.
#
# Required:
#   LEGACY_PGHOST LEGACY_PGPORT LEGACY_PGUSER LEGACY_PGPASSWORD
#   TARGET_PGHOST TARGET_PGPORT TARGET_PGUSER TARGET_PGPASSWORD
#
# Optional:
#   TARGET_DB_PREFIX (default: "")
#   DRY_RUN=true
#
# Usage:
#   DOMAIN=news ./domain-cutover.sh
#   DOMAIN=order ./domain-cutover.sh
#   DOMAIN=payment ./domain-cutover.sh
#   DOMAIN=crm ./domain-cutover.sh
#   DOMAIN=communication ./domain-cutover.sh
#   DOMAIN=trust ./domain-cutover.sh
#   DOMAIN=profile ./domain-cutover.sh
#   DOMAIN=promotion ./domain-cutover.sh
#
# The script is expand/backfill/switch-safe: it never deletes source rows.
# Legacy writes must be frozen or dual-written by the application before a
# production cutover is declared complete.

required=(LEGACY_PGHOST LEGACY_PGPORT LEGACY_PGUSER LEGACY_PGPASSWORD TARGET_PGHOST TARGET_PGPORT TARGET_PGUSER TARGET_PGPASSWORD)
for key in "${required[@]}"; do
  [[ -n "${!key:-}" ]] || { echo "missing $key" >&2; exit 2; }
done

DOMAIN="${DOMAIN:-}"
DRY_RUN="${DRY_RUN:-false}"
export PGPASSWORD="${TARGET_PGPASSWORD}"

legacy_psql() {
  PGPASSWORD="${LEGACY_PGPASSWORD}" psql -X -v ON_ERROR_STOP=1 \
    -h "${LEGACY_PGHOST}" -p "${LEGACY_PGPORT}" -U "${LEGACY_PGUSER}" -d marketplace_db "$@"
}

target_psql() {
  PGPASSWORD="${TARGET_PGPASSWORD}" psql -X -v ON_ERROR_STOP=1 \
    -h "${TARGET_PGHOST}" -p "${TARGET_PGPORT}" -U "${TARGET_PGUSER}" -d "$1" "${@:2}"
}

ensure_target_db() {
  local db="$1"
  echo "==> ensuring target database $db exists"
  if [[ "${DRY_RUN}" == "true" ]]; then return; fi
  PGPASSWORD="${TARGET_PGPASSWORD}" psql -X -v ON_ERROR_STOP=1 \
    -h "${TARGET_PGHOST}" -p "${TARGET_PGPORT}" -U "${TARGET_PGUSER}" -d postgres \
    -v db="$db" -c 'SELECT 1 FROM pg_database WHERE datname = :'db \ 
    | grep -q 1 || PGPASSWORD="${TARGET_PGPASSWORD}" psql -X -v ON_ERROR_STOP=1 \
      -h "${TARGET_PGHOST}" -p "${TARGET_PGPORT}" -U "${TARGET_PGUSER}" -d postgres \
      -c "CREATE DATABASE \"$db\";"
}

run_sql_file() {
  local db="$1"; local file="$2"
  echo "==> applying $DOMAIN backfill to $db from $file"
  if [[ "${DRY_RUN}" == "true" ]]; then
    sed -n '1,240p' "$file"
    return
  fi
  TARGET_PGPASSWORD="${TARGET_PGPASSWORD}" psql -X -v ON_ERROR_STOP=1 \
    -h "${TARGET_PGHOST}" -p "${TARGET_PGPORT}" -U "${TARGET_PGUSER}" -d "$db" \
    -v legacy_host="${LEGACY_PGHOST}" \
    -v legacy_port="${LEGACY_PGPORT}" \
    -v legacy_user="${LEGACY_PGUSER}" \
    -v legacy_password="${LEGACY_PGPASSWORD}" \
    -f "$file"
}

case "$DOMAIN" in
  news)
    ensure_target_db news_db
    run_sql_file news_db "$(dirname "$0")/sql/news.sql"
    ;;
  order)
    ensure_target_db order_db
    run_sql_file order_db "$(dirname "$0")/sql/order.sql"
    ;;
  payment)
    ensure_target_db payment_db
    run_sql_file payment_db "$(dirname "$0")/sql/payment.sql"
    ;;
  crm)
    ensure_target_db crm_db
    run_sql_file crm_db "$(dirname "$0")/sql/crm.sql"
    ;;
  communication)
    ensure_target_db communication_db
    run_sql_file communication_db "$(dirname "$0")/sql/communication.sql"
    ;;
  trust)
    ensure_target_db trust_db
    run_sql_file trust_db "$(dirname "$0")/sql/trust.sql"
    ;;
  profile)
    ensure_target_db profile_db
    run_sql_file profile_db "$(dirname "$0")/sql/profile.sql"
    ;;
  promotion)
    ensure_target_db promotion_db
    run_sql_file promotion_db "$(dirname "$0")/sql/promotion.sql"
    ;;
  *)
    echo "DOMAIN must be one of: news order payment crm communication trust profile promotion" >&2
    exit 2
    ;;
esac
