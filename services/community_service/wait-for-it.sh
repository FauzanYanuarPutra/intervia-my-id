#!/usr/bin/env bash
#   Use this script to test if a given TCP host/port are available

set -e

TIMEOUT=15
QUIET=0
HOST=""
PORT=""
WAITFORIT_cmdname=$(basename "$0")

usage() {
  cat << USAGE >&2
Usage:
  $WAITFORIT_cmdname host:port [-t timeout] [-- command args]
  -h HOST | --host=HOST       Host or IP under test
  -p PORT | --port=PORT       TCP port under test
  -t TIMEOUT | --timeout=TIMEOUT
                             Timeout in seconds, zero for no timeout
  -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
  exit 1
}

wait_for() {
  if [[ $TIMEOUT -gt 0 ]]; then
    echo "Waiting $TIMEOUT seconds for $HOST:$PORT"
  else
    echo "Waiting for $HOST:$PORT without a timeout"
  fi

  start_ts=$(date +%s)
  while :
  do
    if nc -z "$HOST" "$PORT" >/dev/null 2>&1; then
      echo "$HOST:$PORT is available"
      break
    fi
    sleep 1
    if [[ $TIMEOUT -gt 0 ]]; then
      now_ts=$(date +%s)
      if (( now_ts - start_ts >= TIMEOUT )); then
        echo "Timeout occurred after waiting $TIMEOUT seconds for $HOST:$PORT"
        return 1
      fi
    fi
  done
  return 0
}

wait_for_wrapper() {
  if [[ $# -lt 1 ]]; then
    usage
  fi

  if [[ "$1" == *:* ]]; then
    HOST="${1%:*}"
    PORT="${1#*:}"
    shift
  else
    usage
  fi

  while [[ $# -gt 0 ]]
  do
    case "$1" in
      -t|--timeout)
        TIMEOUT="$2"
        shift 2
        ;;
      --)
        shift
        break
        ;;
      *)
        usage
        ;;
    esac
  done

  wait_for

  if [[ $# -gt 0 ]]; then
    exec "$@"
  fi
}

wait_for_wrapper "$@"

