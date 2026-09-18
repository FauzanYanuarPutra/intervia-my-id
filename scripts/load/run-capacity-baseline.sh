#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:?BASE_URL is required}"
PROFILE="${PROFILE:-baseline}"
PATHS="${PATHS:-/,/id/news}"
ALLOW_PRODUCTION_LOAD="${ALLOW_PRODUCTION_LOAD:-0}"
HIGH_LOAD_CONFIRM="${HIGH_LOAD_CONFIRM:-}"
PRODUCTION_LOAD_CONFIRM="${PRODUCTION_LOAD_CONFIRM:-}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:0.54.0}"

host="$(printf '%s' "$BASE_URL" | sed -E 's#^https?://##; s#/.*##; s/:.*##' | tr '[:upper:]' '[:lower:]')"
case "$host" in
  lajukan.com|www.lajukan.com|api.lajukan.com|usaha.lajukan.com|cms.lajukan.com|crm.lajukan.com|chat.lajukan.com)
    if [[ "$ALLOW_PRODUCTION_LOAD" != "1" || "$PRODUCTION_LOAD_CONFIRM" != "I_UNDERSTAND_PRODUCTION_LOAD" ]]; then
      echo "Refusing production load test. Explicit approval token is required." >&2
      exit 2
    fi
    ;;
esac

case "$PROFILE" in
  smoke)
    start_rps=5
    peak_rps=50
    preallocated_vus=20
    max_vus=200
    ramp_duration=10s
    hold_duration=30s
    cooldown_duration=10s
    ;;
  baseline)
    start_rps=25
    peak_rps=250
    preallocated_vus=100
    max_vus=1000
    ramp_duration=30s
    hold_duration=2m
    cooldown_duration=30s
    ;;
  stress)
    [[ "$HIGH_LOAD_CONFIRM" == "I_UNDERSTAND_HIGH_LOAD" ]] || {
      echo "stress profile requires HIGH_LOAD_CONFIRM=I_UNDERSTAND_HIGH_LOAD" >&2
      exit 2
    }
    start_rps=100
    peak_rps=1000
    preallocated_vus=500
    max_vus=4000
    ramp_duration=1m
    hold_duration=3m
    cooldown_duration=1m
    ;;
  extreme)
    [[ "$HIGH_LOAD_CONFIRM" == "I_UNDERSTAND_HIGH_LOAD" ]] || {
      echo "extreme profile requires HIGH_LOAD_CONFIRM=I_UNDERSTAND_HIGH_LOAD" >&2
      exit 2
    }
    start_rps=250
    peak_rps=5000
    preallocated_vus=1000
    max_vus=10000
    ramp_duration=2m
    hold_duration=3m
    cooldown_duration=1m
    ;;
  *)
    echo "Unknown PROFILE: $PROFILE" >&2
    exit 2
    ;;
esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_dir="${CAPACITY_ARTIFACT_DIR:-$PWD/.runtime/capacity/$timestamp-$PROFILE}"
mkdir -p "$artifact_dir"

cat > "$artifact_dir/run-metadata.txt" <<META
timestamp_utc=$timestamp
profile=$PROFILE
base_url=$BASE_URL
paths=$PATHS
start_rps=$start_rps
peak_rps=$peak_rps
preallocated_vus=$preallocated_vus
max_vus=$max_vus
ramp_duration=$ramp_duration
hold_duration=$hold_duration
cooldown_duration=$cooldown_duration
git_sha=${GITHUB_SHA:-unknown}
META

docker run --rm \
  -v "$PWD:/work:ro" \
  -v "$artifact_dir:/out" \
  -e BASE_URL="$BASE_URL" \
  -e PATHS="$PATHS" \
  -e START_RPS="$start_rps" \
  -e PEAK_RPS="$peak_rps" \
  -e PREALLOCATED_VUS="$preallocated_vus" \
  -e MAX_VUS="$max_vus" \
  -e RAMP_DURATION="$ramp_duration" \
  -e HOLD_DURATION="$hold_duration" \
  -e COOLDOWN_DURATION="$cooldown_duration" \
  -e ALLOW_PRODUCTION_LOAD="$ALLOW_PRODUCTION_LOAD" \
  "$K6_IMAGE" run \
  --summary-export /out/summary.json \
  /work/scripts/load/k6-read-paths.js

echo "Capacity result written to $artifact_dir"
