#!/usr/bin/env bash
set -Eeuo pipefail

# Strangler-migration backfill runner.
# No legacy rows are deleted. Backfill alone never switches production traffic.
#
# Required:
#   LEGACY_PGHOST LEGACY_PGPORT LEGACY_PGUSER LEGACY_PGPASSWORD
#   TARGET_PGHOST TARGET_PGPORT TARGET_PGUSER TARGET_PGPASSWORD
# Optional:
#   DOMAIN=all|news|order|payment|crm|communication|trust|profile|promotion
#   DRY_RUN=true
#   VERIFY_AFTER_BACKFILL=true
#   TARGET_RESET=true   # destructive to target-only data; never use on a live owner

required=(LEGACY_PGHOST LEGACY_PGPORT LEGACY_PGUSER LEGACY_PGPASSWORD TARGET_PGHOST TARGET_PGPORT TARGET_PGUSER TARGET_PGPASSWORD)
for key in "${required[@]}"; do
  [[ -n "${!key:-}" ]] || { echo "missing $key" >&2; exit 2; }
done

DOMAIN="${DOMAIN:-all}"
DRY_RUN="${DRY_RUN:-false}"
VERIFY_AFTER_BACKFILL="${VERIFY_AFTER_BACKFILL:-true}"
TARGET_RESET="${TARGET_RESET:-false}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ensure_target_db() {
  local db="$1"
  echo "==> ensuring target database $db exists"
  [[ "$DRY_RUN" == "true" ]] && return 0
  local exists
  exists="$(PGPASSWORD="$TARGET_PGPASSWORD" psql -X -At -h "$TARGET_PGHOST" -p "$TARGET_PGPORT" -U "$TARGET_PGUSER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$db'")"
  if [[ "$exists" != "1" ]]; then
    PGPASSWORD="$TARGET_PGPASSWORD" psql -X -v ON_ERROR_STOP=1 -h "$TARGET_PGHOST" -p "$TARGET_PGPORT" -U "$TARGET_PGUSER" -d postgres -c "CREATE DATABASE \"$db\";"
  fi
}

reset_target_tables() {
  local db="$1"
  [[ "$TARGET_RESET" == "true" ]] || return 0
  echo "==> TARGET_RESET=true: clearing target-only rows in $db"
  PGPASSWORD="$TARGET_PGPASSWORD" psql -X -v ON_ERROR_STOP=1 -h "$TARGET_PGHOST" -p "$TARGET_PGPORT" -U "$TARGET_PGUSER" -d "$db" -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'service_meta' LOOP EXECUTE format('TRUNCATE TABLE public.%I CASCADE',r.tablename); END LOOP; END \$\$;"
}

run_sql_file() {
  local db="$1"
  local file="$2"
  echo "==> applying $DOMAIN backfill to $db from $file"
  if [[ "$DRY_RUN" == "true" ]]; then
    cat "$file"
    return 0
  fi
  reset_target_tables "$db"
  PGPASSWORD="$TARGET_PGPASSWORD" psql -X -v ON_ERROR_STOP=1     -h "$TARGET_PGHOST" -p "$TARGET_PGPORT" -U "$TARGET_PGUSER" -d "$db"     -v legacy_host="$LEGACY_PGHOST"     -v legacy_port="$LEGACY_PGPORT"     -v legacy_user="$LEGACY_PGUSER"     -v legacy_password="$LEGACY_PGPASSWORD"     -f "$file"
}

verify_domain() {
  [[ "$DRY_RUN" == "true" || "$VERIFY_AFTER_BACKFILL" != "true" ]] && return 0
  DOMAIN="$1"     LEGACY_PGHOST="$LEGACY_PGHOST" LEGACY_PGPORT="$LEGACY_PGPORT" LEGACY_PGUSER="$LEGACY_PGUSER" LEGACY_PGPASSWORD="$LEGACY_PGPASSWORD"     TARGET_PGHOST="$TARGET_PGHOST" TARGET_PGPORT="$TARGET_PGPORT" TARGET_PGUSER="$TARGET_PGUSER" TARGET_PGPASSWORD="$TARGET_PGPASSWORD"     "$SCRIPT_DIR/domain-verify.sh"
}

run_domain() {
  local d="$1"
  case "$d" in
    news)
      ensure_target_db news_db
      run_sql_file news_db "$SCRIPT_DIR/sql/news.sql"
      verify_domain news
      ;;
    order)
      ensure_target_db order_db
      run_sql_file order_db "$SCRIPT_DIR/sql/order.sql"
      verify_domain order
      ;;
    payment)
      ensure_target_db payment_db
      run_sql_file payment_db "$SCRIPT_DIR/sql/payment.sql"
      verify_domain payment
      ;;
    crm)
      ensure_target_db crm_db
      run_sql_file crm_db "$SCRIPT_DIR/sql/crm.sql"
      verify_domain crm
      ;;
    communication)
      ensure_target_db communication_db
      run_sql_file communication_db "$SCRIPT_DIR/sql/communication.sql"
      verify_domain communication
      ;;
    trust)
      ensure_target_db trust_db
      run_sql_file trust_db "$SCRIPT_DIR/sql/trust.sql"
      verify_domain trust
      ;;
    profile)
      ensure_target_db profile_db
      run_sql_file profile_db "$SCRIPT_DIR/sql/profile.sql"
      verify_domain profile
      ;;
    promotion)
      ensure_target_db promotion_db
      run_sql_file promotion_db "$SCRIPT_DIR/sql/promotion.sql"
      verify_domain promotion
      ;;
    *)
      echo "DOMAIN must be one of: all news order payment crm communication trust profile promotion" >&2
      exit 2
      ;;
  esac
}

if [[ "$DOMAIN" == "all" ]]; then
  for d in profile news order payment crm communication trust promotion; do
    echo "================ $d ================"
    run_domain "$d"
  done
else
  run_domain "$DOMAIN"
fi

echo "DOMAIN BACKFILL COMPLETE — legacy data has NOT been deleted and traffic has NOT been switched."
