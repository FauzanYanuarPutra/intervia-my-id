#!/usr/bin/env sh
set -eu

PORT="${PORT:-8080}"
RUST_LOG="${RUST_LOG:-info}"

case "$PORT" in
  ''|*[!0-9]*)
    echo "[ai_service] invalid PORT: $PORT" >&2
    exit 64
    ;;
esac

if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "[ai_service] PORT must be between 1 and 65535: $PORT" >&2
  exit 64
fi

export PORT RUST_LOG

echo "[ai_service] starting Lajukan AI Orchestrator on :$PORT"
exec "$@"
