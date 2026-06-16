#!/usr/bin/env sh
set -e

POSTGRES_HOST=${POSTGRES_HOST:-postgres_db}
POSTGRES_USER=${POSTGRES_USER:-app}
REDIS_HOST=${REDIS_HOST:-redis_cache}
REDIS_PASSWORD=${REDIS_PASSWORD:-}

RABBITMQ_HOST=${RABBITMQ_HOST:-rabbitmq}
RABBITMQ_USER=${RABBITMQ_USER:-identity_service}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD:-strongpassword}
RUN_MIGRATIONS=${RUN_MIGRATIONS:-true}
DATABASE_URL=${DATABASE_URL:-${COMMUNITY_DATABASE_URL:-${COMMUNITY_DB_URL:-}}}
export DATABASE_URL
ENVIRONMENT=${ENV:-development}
STRICT_MIGRATIONS=false
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "staging" ]; then
  STRICT_MIGRATIONS=true
fi

echo "Checking Postgres..."
until pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -q; do
  echo "Waiting for Postgres at $POSTGRES_HOST..."
  sleep 2
done
echo "Postgres ready."

echo "Checking Redis..."
if [ -n "$REDIS_PASSWORD" ]; then
  export REDISCLI_AUTH="$REDIS_PASSWORD"
fi
until redis-cli -h "$REDIS_HOST" ping | grep -q PONG; do
  echo "Waiting for Redis at $REDIS_HOST..."
  sleep 2
done
echo "Redis ready."
unset REDISCLI_AUTH

echo "Checking RabbitMQ port..."
/usr/local/bin/wait-for-it.sh "${RABBITMQ_HOST}:5672" -t 60 -- echo "RabbitMQ port is open."

echo "Checking RabbitMQ management API..."
until curl -s -o /dev/null -w '%{http_code}' \
  "http://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:15672/api/vhosts" | grep -q 200; do
  echo "Waiting for RabbitMQ API..."
  sleep 2
done
echo "RabbitMQ API ready."

if [ "$RUN_MIGRATIONS" = "false" ]; then
  echo "RUN_MIGRATIONS=false, skipping migration step."
elif ! command -v sqlx >/dev/null 2>&1; then
  echo "sqlx binary not found, skipping migration step."
elif [ ! -d "./migrations" ]; then
  echo "No migrations directory, skipping migration step."
elif ! find ./migrations -maxdepth 1 -type f -name '*.sql' | grep -q .; then
  echo "No migration files found, skipping migration step."
else
  echo "Running SQLx migrations..."
  if [ "$STRICT_MIGRATIONS" = "true" ]; then
    migration_output="$(sqlx migrate run 2>&1)" || migration_status=$?
  else
    migration_output="$(sqlx migrate run --ignore-missing 2>&1)" || migration_status=$?
  fi
  migration_status=${migration_status:-0}

  if [ "$migration_status" -eq 0 ]; then
    [ -n "$migration_output" ] && echo "$migration_output"
    echo "Migrations complete."
  else
    if echo "$migration_output" | grep -q "was previously applied but is missing in the resolved migrations\|was previously applied but has been modified"; then
      if [ "$STRICT_MIGRATIONS" = "true" ]; then
        [ -n "$migration_output" ] && echo "$migration_output"
        echo "Migration drift detected in $ENVIRONMENT; aborting startup."
        exit 1
      fi
      echo "Shared database migration drift detected; skipping migration run in this environment."
    else
      [ -n "$migration_output" ] && echo "$migration_output"
      if [ "$STRICT_MIGRATIONS" = "true" ]; then
        echo "Migration step failed in $ENVIRONMENT; aborting startup."
        exit "$migration_status"
      fi
      echo "Migration step failed, continuing startup in non-strict mode."
    fi
  fi

  unset migration_status
  unset migration_output
fi

echo "Starting application..."
exec "$@"
