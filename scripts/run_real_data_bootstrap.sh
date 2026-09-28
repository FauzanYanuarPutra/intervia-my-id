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
TMP_DIR=""
run_sql() {
  psql "$1" -v ON_ERROR_STOP=1 -Atqc "$2"
}

echo "[real-data] ensuring bootstrap state schema..."
run_sql "$MARKETPLACE_DATABASE_URL" "CREATE TABLE IF NOT EXISTS real_data_bootstrap_runs (
  bootstrap_key TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  last_provider_count INTEGER NOT NULL DEFAULT 0,
  last_buyer_count INTEGER NOT NULL DEFAULT 0,
  last_community_media_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); ALTER TABLE real_data_bootstrap_runs ADD COLUMN IF NOT EXISTS bootstrap_version TEXT NOT NULL DEFAULT ''; CREATE INDEX IF NOT EXISTS idx_real_data_bootstrap_version ON real_data_bootstrap_runs(bootstrap_version);"

PREFLIGHT_HOSTS="${REAL_DATA_NETWORK_PREFLIGHT_HOSTS:-data.go.id,overpass-api.de,commons.wikimedia.org,satudata.denpasarkota.go.id}"
PREFLIGHT_ATTEMPTS="${REAL_DATA_NETWORK_PREFLIGHT_ATTEMPTS:-12}"
PREFLIGHT_DELAY="${REAL_DATA_NETWORK_PREFLIGHT_DELAY_SECONDS:-5}"
DNS_PRIMARY="${REAL_DATA_DNS_PRIMARY:-1.1.1.1}"
DNS_SECONDARY="${REAL_DATA_DNS_SECONDARY:-8.8.8.8}"

echo "[real-data] resolver configuration:"
echo "[real-data] configured DNS failover: primary=${DNS_PRIMARY} secondary=${DNS_SECONDARY}"
cat /etc/resolv.conf 2>/dev/null || true
if command -v nslookup >/dev/null 2>&1; then
  nslookup data.go.id 2>&1 | sed -n '1,16p' || true
fi

PROXY_URL="${HTTPS_PROXY:-${HTTP_PROXY:-}}"
PROXY_HOST=""
PROXY_REACHABLE=0
if [ -n "$PROXY_URL" ]; then
  PROXY_HOST="$(python - "$PROXY_URL" <<'PY'
import sys
from urllib.parse import urlparse
parsed = urlparse(sys.argv[1])
print(parsed.hostname or "")
PY
)"
  if [ -n "$PROXY_HOST" ] && python -c 'import socket,sys; socket.getaddrinfo(sys.argv[1],443,type=socket.SOCK_STREAM)' "$PROXY_HOST" >/dev/null 2>&1; then
    PROXY_REACHABLE=1
    echo "[real-data] configured proxy host resolves: $PROXY_HOST"
  else
    echo "[real-data] configured proxy host does not resolve: $PROXY_HOST" >&2
  fi
fi

echo "[real-data] checking external DNS/network..."
for attempt in $(seq 1 "$PREFLIGHT_ATTEMPTS"); do
  resolved_count=0
  for host in $(printf "%s" "$PREFLIGHT_HOSTS" | tr "," " "); do
    if python -c 'import socket,sys; socket.getaddrinfo(sys.argv[1],443,type=socket.SOCK_STREAM)' "$host" >/dev/null 2>&1; then
      resolved_count=$((resolved_count + 1))
    fi
  done
  echo "[real-data] network preflight attempt ${attempt}/${PREFLIGHT_ATTEMPTS}: resolved=${resolved_count}"
  if [ "$resolved_count" -gt 0 ]; then
    break
  fi
  if [ "$attempt" -lt "$PREFLIGHT_ATTEMPTS" ]; then
    sleep "$PREFLIGHT_DELAY"
  fi
done

if [ "$resolved_count" -eq 0 ] && [ "$PROXY_REACHABLE" -eq 1 ]; then
  echo "[real-data] direct DNS is unavailable; validating outbound access through configured proxy..."
  if python - <<'PY'
import urllib.error
import urllib.request

url = "https://data.go.id/"
request = urllib.request.Request(url, headers={"User-Agent": "LajukanOpenDataImporter/1.0"})
try:
    with urllib.request.urlopen(request, timeout=20) as response:
        print(f"[real-data] proxy network probe status={getattr(response, 'status', 'ok')}")
    raise SystemExit(0)
except urllib.error.HTTPError as exc:
    print(f"[real-data] proxy network probe reached origin with HTTP {exc.code}")
    raise SystemExit(0)
PY
  then
    resolved_count=1
  fi
fi

if [ "$resolved_count" -eq 0 ]; then
  DEFERRED_ERROR="External DNS/network resolution is unavailable inside real_data_bootstrap; external source import is deferred and will retry on the next startup."
  echo "[real-data] $DEFERRED_ERROR" >&2
  echo "[real-data] resolver above must reach at least one approved source host." >&2
  echo "[real-data] DNS failover configured as primary=${DNS_PRIMARY}, secondary=${DNS_SECONDARY}, with Docker embedded resolver as the final fallback." >&2
  echo "[real-data] If a corporate/VPN proxy is required, set REAL_DATA_HTTP_PROXY and REAL_DATA_HTTPS_PROXY." >&2
  psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO real_data_bootstrap_runs (bootstrap_key, bootstrap_version, last_success_at, last_provider_count, last_buyer_count, last_community_media_count, last_error, updated_at)
VALUES ('$LOCK_KEY', '$BOOTSTRAP_VERSION', NULL, 0, 0, 0, '$DEFERRED_ERROR', NOW())
ON CONFLICT (bootstrap_key) DO UPDATE SET
  last_provider_count = EXCLUDED.last_provider_count,
  last_buyer_count = EXCLUDED.last_buyer_count,
  last_community_media_count = EXCLUDED.last_community_media_count,
  last_error = EXCLUDED.last_error,
  updated_at = NOW();
SQL
  # This is a transient external-data condition. Return EX_TEMPFAIL so the
  # compose restart policy retries automatically; the application stack itself
  # remains healthy while hydration is retried.
  exit 75
fi

echo "[real-data] acquiring bootstrap advisory lock..."
LOCK_ACQUIRED="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT pg_try_advisory_lock(hashtextextended('$LOCK_KEY', 0))")"
if [ "$LOCK_ACQUIRED" != "t" ]; then
  echo "[real-data] another bootstrap worker is already running; exiting idempotently."
  exit 0
fi
cleanup_lock() {
  run_sql "$MARKETPLACE_DATABASE_URL" "SELECT pg_advisory_unlock(hashtextextended('$LOCK_KEY', 0))" >/dev/null 2>&1 || true
}
trap 'cleanup_lock; if [ -n "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi' EXIT

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
MARKETPLACE_SQL="$TMP_DIR/marketplace.sql"
COMMUNITY_SQL="$TMP_DIR/community.sql"
MANIFEST_JSON="$TMP_DIR/manifest.json"

echo "[real-data] crawling approved public/open sources..."
python /workspace/scripts/import_real_marketplace_open_data.py --out "$MARKETPLACE_SQL" --community-out "$COMMUNITY_SQL" --manifest "$MANIFEST_JSON" --max-providers "$MAX_PROVIDERS" --max-buyers "$MAX_BUYERS" --max-insights "$MAX_INSIGHTS" --max-community-media "$MAX_MEDIA" --sleep "$SLEEP_SECONDS" --allow-image-less-records

SOURCE_ERROR_COUNT="$(python - "$MANIFEST_JSON" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
print(int(payload.get("source_error_count", 0)))
PY
)"
SOURCE_ERROR_SUMMARY="$(python - "$MANIFEST_JSON" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
errors = payload.get("source_errors") or []
summary = "; ".join(f"{item.get('id')}: {item.get('error', 'unknown error')}" for item in errors)
print(summary[:1800])
PY
)"
echo "[real-data] source diagnostics: errors=${SOURCE_ERROR_COUNT}"
if [ "$SOURCE_ERROR_COUNT" -gt 0 ]; then
  echo "[real-data] source diagnostic summary: ${SOURCE_ERROR_SUMMARY}"
fi

echo "[real-data] applying marketplace data..."
if [ -s "$MARKETPLACE_SQL" ]; then psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MARKETPLACE_SQL"; fi

echo "[real-data] applying community data..."
if [ -s "$COMMUNITY_SQL" ]; then psql "$COMMUNITY_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$COMMUNITY_SQL"; fi

PROVIDER_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND COALESCE(metadata->>'market_side','') = 'reference' AND COALESCE(metadata->>'reference_subtype','') <> 'aggregate_data'")"
INSIGHT_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND COALESCE(metadata->>'reference_subtype','') = 'aggregate_data'")"
BUYER_COUNT="$(run_sql "$MARKETPLACE_DATABASE_URL" "SELECT COUNT(*) FROM content_items WHERE content_status='active' AND COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data' AND pricing_mode = 'request'")"
MEDIA_COUNT="$(run_sql "$COMMUNITY_DATABASE_URL" "SELECT COUNT(*) FROM reel.lajukan_reels WHERE COALESCE(metadata->>'seed_pack','') = 'real_indonesia_bulk_open_data'")"

if [ "$PROVIDER_COUNT" -gt 0 ] || [ "$BUYER_COUNT" -gt 0 ] || [ "$INSIGHT_COUNT" -gt 0 ] || [ "$MEDIA_COUNT" -gt 0 ]; then
  psql "$MARKETPLACE_DATABASE_URL" -v ON_ERROR_STOP=1 -v "bootstrap_error=$SOURCE_ERROR_SUMMARY" <<SQL
INSERT INTO real_data_bootstrap_runs (bootstrap_key, bootstrap_version, last_success_at, last_provider_count, last_buyer_count, last_community_media_count, last_error, updated_at)
VALUES (
  '$LOCK_KEY',
  '$BOOTSTRAP_VERSION',
  CASE WHEN $SOURCE_ERROR_COUNT = 0 THEN NOW() ELSE NULL END,
  $PROVIDER_COUNT,
  $BUYER_COUNT,
  $MEDIA_COUNT,
  NULLIF(:'bootstrap_error', ''),
  NOW()
)
ON CONFLICT (bootstrap_key) DO UPDATE SET
  bootstrap_version = EXCLUDED.bootstrap_version,
  last_success_at = CASE
    WHEN $SOURCE_ERROR_COUNT = 0 THEN NOW()
    ELSE real_data_bootstrap_runs.last_success_at
  END,
  last_provider_count = EXCLUDED.last_provider_count,
  last_buyer_count = EXCLUDED.last_buyer_count,
  last_community_media_count = EXCLUDED.last_community_media_count,
  last_error = EXCLUDED.last_error,
  updated_at = NOW();
SQL
  if [ "$SOURCE_ERROR_COUNT" -gt 0 ]; then
    echo "[real-data] bootstrap partially hydrated: providers=${PROVIDER_COUNT} buyers=${BUYER_COUNT} insights=${INSIGHT_COUNT} community_media=${MEDIA_COUNT} source_errors=${SOURCE_ERROR_COUNT}; successful timestamp retained only when every source succeeds"
  else
    echo "[real-data] bootstrap complete: providers=${PROVIDER_COUNT} buyers=${BUYER_COUNT} insights=${INSIGHT_COUNT} community_media=${MEDIA_COUNT}"
  fi
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
  echo "[real-data] bootstrap completed without external rows; will retry automatically."
  # A source error with zero hydrated rows is a temporary bootstrap failure.
  # Return EX_TEMPFAIL so Docker retries without marking the app services failed.
  if [ "$SOURCE_ERROR_COUNT" -gt 0 ]; then
    exit 75
  fi
  exit 0
fi

echo "[real-data] bootstrap complete: providers=${PROVIDER_COUNT} buyers=${BUYER_COUNT} community_media=${MEDIA_COUNT}"