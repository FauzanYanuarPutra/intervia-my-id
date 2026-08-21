#!/bin/sh

# Idempotent production migration runner for additive Chat CQL migrations.
# Secrets are consumed only as cqlsh arguments and are never printed.
set -eu

if [ -z "${SCYLLA_NODES:-}" ]; then
  echo "SCYLLA_NODES is required" >&2
  exit 1
fi

FIRST_NODE=$(printf '%s' "$SCYLLA_NODES" | cut -d',' -f1 | tr -d ' ')
case "$FIRST_NODE" in
  *:*)
    SCYLLA_MIGRATION_HOST=${FIRST_NODE%:*}
    SCYLLA_MIGRATION_PORT=${FIRST_NODE##*:}
    ;;
  *)
    SCYLLA_MIGRATION_HOST=$FIRST_NODE
    SCYLLA_MIGRATION_PORT=${SCYLLA_PORT:-9042}
    ;;
esac

if [ -z "$SCYLLA_MIGRATION_HOST" ]; then
  echo "SCYLLA_NODES does not contain a usable host" >&2
  exit 1
fi

if [ -n "${SCYLLA_PASSWORD:-}" ] && [ -z "${SCYLLA_USERNAME:-}" ]; then
  echo "SCYLLA_USERNAME is required when SCYLLA_PASSWORD is configured" >&2
  exit 1
fi

run_cql() {
  if [ "${SCYLLA_SSL:-0}" = "1" ] && [ -n "${SCYLLA_USERNAME:-}" ]; then
    cqlsh --request-timeout=60 --ssl -u "$SCYLLA_USERNAME" -p "${SCYLLA_PASSWORD:-}" "$@" "$SCYLLA_MIGRATION_HOST" "$SCYLLA_MIGRATION_PORT"
  elif [ "${SCYLLA_SSL:-0}" = "1" ]; then
    cqlsh --request-timeout=60 --ssl "$@" "$SCYLLA_MIGRATION_HOST" "$SCYLLA_MIGRATION_PORT"
  elif [ -n "${SCYLLA_USERNAME:-}" ]; then
    cqlsh --request-timeout=60 -u "$SCYLLA_USERNAME" -p "${SCYLLA_PASSWORD:-}" "$@" "$SCYLLA_MIGRATION_HOST" "$SCYLLA_MIGRATION_PORT"
  else
    cqlsh --request-timeout=60 "$@" "$SCYLLA_MIGRATION_HOST" "$SCYLLA_MIGRATION_PORT"
  fi
}

attempt=0
until run_cql -e "DESCRIBE CLUSTER" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "ScyllaDB did not become ready for migrations" >&2
    exit 1
  fi
  sleep 2
done

found=0
for migration in /scylladb/migrations/*.cql; do
  if [ ! -f "$migration" ]; then
    continue
  fi
  found=1
  migration_name=$(basename "$migration")
  echo "Applying Chat migration: $migration_name"
  sed 's/\r$//' "$migration" > /tmp/chat_migration.cql
  run_cql -f /tmp/chat_migration.cql
done

if [ "$found" -ne 1 ]; then
  echo "No Chat migrations were found" >&2
  exit 1
fi

echo "Chat migrations applied successfully"
