#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${MARKETPLACE_DATABASE_URL:-${DATABASE_URL:-}}"
EVENT_ID="${EVENT_ID:-}"
EVENT_KEY="${EVENT_KEY:-}"
CONFIRM_REQUEUE="${CONFIRM_REQUEUE:-}"

[[ -n "$DATABASE_URL" ]] || {
  echo "MARKETPLACE_DATABASE_URL or DATABASE_URL is required" >&2
  exit 2
}
[[ "$CONFIRM_REQUEUE" == "I_UNDERSTAND_REQUEUE" ]] || {
  echo "CONFIRM_REQUEUE=I_UNDERSTAND_REQUEUE is required" >&2
  exit 2
}
if [[ -n "$EVENT_ID" && -n "$EVENT_KEY" ]]; then
  echo "Set exactly one of EVENT_ID or EVENT_KEY" >&2
  exit 2
fi
if [[ -z "$EVENT_ID" && -z "$EVENT_KEY" ]]; then
  echo "Set exactly one of EVENT_ID or EVENT_KEY" >&2
  exit 2
fi

if [[ -n "$EVENT_ID" ]]; then
  selector_sql="id = :'selector'::uuid"
  selector="$EVENT_ID"
else
  selector_sql="event_key = :'selector'"
  selector="$EVENT_KEY"
fi

result="$(
  psql "$DATABASE_URL"     -v ON_ERROR_STOP=1     -v selector="$selector"     -Atc "
      UPDATE events.event_outbox
      SET
        status = 'pending',
        retry_count = 0,
        available_at = NOW(),
        error_message = NULL
      WHERE $selector_sql
        AND status = 'failed'
      RETURNING id::text || '|' || COALESCE(event_key, '') || '|' || event_type;
    "
)"

if [[ -z "$result" ]]; then
  echo "No failed outbox event matched the selector; nothing was changed." >&2
  exit 3
fi

echo "Requeued outbox event: $result"
