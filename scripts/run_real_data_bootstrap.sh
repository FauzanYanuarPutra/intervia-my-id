#!/bin/sh
set -eu

: "${MARKETPLACE_DATABASE_URL:?MARKETPLACE_DATABASE_URL is required}"
: "${COMMUNITY_DATABASE_URL:?COMMUNITY_DATABASE_URL is required}"

REFRESH_HOURS="${REAL_DATA_REFRESH_HOURS:-24}"
MAX_PROVIDERS="${REAL_DATA_MAX_PROVIDERS:-5000}"
MAX_BUYERS="${REAL_DATA_MAX_BUYERS:-1000}"
MAX_INSIGHTS="${REAL_DATA_MAX_INSIGHTS:-2000}"
MAX_MEDIA="${REAL_DATA_MAX_COMMUNITY_MEDIA:-80}"
SLEEP_SECONDS="${REAL_DATA_REQUEST_SLEEP_SECONDS:-1}"
SOURCE_FINGERPRINT="$(
  (
    sha256sum /workspace/config/real_marketplace_open_data.sources.json
    sha256sum /workspace/scripts/import_real_marketplace_open_data.py
    sha256sum /workspace/scripts/run_real_data_bootstrap.sh
) | sha256sum | awk '{print $1}'
)"
BOOTSTRAP_VERSION="${REAL_DATA_BOOTSTRAP_VERSION:-config-${SOURCE_FINGERPRINT}}"
LOCK_KEY="real_marketplace_open_data"

run_sql() {
  psql "$1" -v ON_ERROR_STOP=1 -Atqc "$2"
}

echo "[real-data] ensuring bootstrap state schema..."
run_sql "$MARKETPLACE_DATABASE_URL" "ALTER TABLE real_data_bootstrap_runs ADD COLUMN IF NOT EXISTS bootstrap_version TEXT NOT NULL DEFAULT ''; CREATE INDEX IF NOT EXISTS idx_real_data_bootstrap_version ON real_data_bootstrap_runs(bootstrap_version);"

echo "[real-data] checking bootstrap state..."
STATE="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COALESCE(bootstrap_version,'') || '|' || COALESCE(EXTRACT(EPOCH FROM (NOW() - last_success_at))/3600.0, 999999) FROM real_data_bootstrap_runs WHERE bootstrap_key = '$LOCK_KEY'")"
LAST_VERSION="${STATE%%|*}"
LAST_SUCCESS="${STATE#*|}"

if [ "$LAST_VERSION" = "$BOOTSTRAP_VERSION" ]; then
  SKIP="$(awk -v age="$LAST_SUCCESS" -v hours="$REFRESH_HOURS" 'BEGIN { print (age < hours) ? "yes" : "no" }')"
  if [ "$SKIP" = "yes" ]; then
    echo "[real-data] bootstrap version $BOOTSTRAP_VERSION succeeded ${LAST_SUCCESS}h ago; refresh window is ${REFRESH_HOURS}h. Nothing to do."
    exit 0
  fi
else
  echo "[real-data] bootstrap version changed from '$LAST_VERSION' to '$BOOTSTRAP_VERSION'; forcing a refresh."
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
MARKETPLACE_SQL="$TMP_DIR/marketplace.sql"
COMMUNITY_SQL="$TMP_DIR/community.sql"

echo "[real-data] crawling approved public/open sources..."
python /workspace/scripts/import_real_marketplace_open_data.py --out "$MARKETPLACE_SQL" --community-out "$COMMUNITY_SQL" --max-providers "$MAX_PROVIDERS" --max-buyers "$MAX_BUYERS" --max-insights "$MAX_INSIGHTS" --max-community-media "$MAX_MEDIA" --sleep "$SLEEP_SECONDS" --allow-image-less-records

echo "[real-data] applying marketplace data..."
if [ -s "$MARKETPLACE_SQL" ]; then psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MARKETPLACE_SQL"; fi

echo "[real-data] applying community data..."
if [ -s "$COMMUNITY_SQL" ]; then psql "$COMMUNITY_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$COMMUNITY_SQL"; fi

PROVIDER_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND COALESCE(metadata->>'market_side','') = 'reference' AND COALESCE(metadata->>'reference_subtype','') <> 'aggregate_data'")"
INSIGHT_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND COALESCE(metadata->>'reference_subtype','') = 'aggregate_data'")"
BUYER_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND pricing_mode = 'request'")"
MEDIA_COUNT="$(run_sql "$COMMUNITY_DATABASE_URL" "SELECT COUNT(*) FROM reel.lajukan_reels WHERE COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data'")"

if [ "$PROVIDER_COUNT" -gt 0 ] || [ "$BUYER_COUNT" -gt 0 ] || [ "$INSIGHT_COUNT" -gt 0 ] || [ "$MEDIA_COUNT" -gt 0 ]; then
  psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO real_data_bootstrap_runs (bootstrap_key, bootstrap_version, last_success_at, last_provider_count, last_buyer_count, last_community_media_count, last_error, updated_at)
VALUES ('$LOCK_KEY', '$BOOTSTRAP_VERSION', NOW(), $PROVIDER_COUNT, $BUYER_COUNT, $MEDIA_COUNT, NULL, NOW())
ON CONFLICT (bootstrap_key) DO UPDATE SET
  bootstrap_version = EXCLUDED.bootstrap_version,
  last_success_at = NOW(),
  last_provider_count = EXCLUDED.last_provider_count,
  last_buyer_count = EXCLUDED.last_buyer_count,
  last_community_media_count = EXCLUDED.last_community_media_count,
  last_error = NULL,
  updated_at = NOW();
SQL
  echo "[real-data] bootstrap complete: providers=${PROVIDER_COUNT} buyers=${BUYER_COUNT} insights=${INSIGHT_COUNT} community_media=${MEDIA_COUNT}"
else
  psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO real_data_bootstrap_runs (bootstrap_key, bootstrap_version, last_success_at, last_provider_count, last_buyer_count, last_community_media_count, last_error, updated_at)
VALUES ('$LOCK_KEY', '$BOOTSTRAP_VERSION', NULL, 0, 0, 0, 'No external rows were imported; source mirrors may be unavailable.', NOW())
ON CONFLICT (bootstrap_key) DO UPDATE SET
  bootstrap_version = EXCLUDED.bootstrap_version,
  last_provider_count = EXCLUDED.last_provider_count,
  last_buyer_count = EXCLUDED.last_buyer_count,
  last_community_media_count = EXCLUDED.last_community_media_count,
  last_error = EXCLUDED.last_error,
  updated_at = NOW();
SQL
  echo "[real-data] bootstrap completed without external rows; will retry on next startup."
fi

echo "[real-data] bootstrap complete: providers=${PROVIDER_COUNT} buyers=${BUYER_COUNT} community_media=${MEDIA_COUNT}"