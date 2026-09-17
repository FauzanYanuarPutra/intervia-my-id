# Lajukan Load Testing

This directory contains non-production load-test harnesses.

The default scenario is intentionally read-only and points to loopback. Never
aim it at production without an explicit incident-safe test plan, traffic
approval and observability in place.

## Requirements

Install k6 locally or in a dedicated staging runner.

## Baseline read test

```bash
k6 run scripts/load/k6-read-paths.js
```

Defaults:

- base URL: `http://127.0.0.1:3000`
- paths: `/`
- start rate: 5 iterations/second
- staged arrival rate with bounded virtual users
- thresholds: under 1% HTTP failure, p95 under 1000 ms, p99 under 2000 ms

These are test defaults, not production SLO claims.

Override for staging:

```bash
BASE_URL=https://staging.example.com \
PATHS="/,/id/explore" \
START_RPS=10 PEAK_RPS=100 \
k6 run scripts/load/k6-read-paths.js
```

Use only GET-safe paths. Create separate explicitly reviewed scenarios for
authenticated writes, orders, payments, uploads or destructive actions.

## Test progression

Run in this order:

1. smoke test at tiny rate;
2. normal-load test near expected peak;
3. stress test until the first resource saturates;
4. spike test for sudden bursts;
5. soak test long enough to expose leaks, connection exhaustion and queue growth;
6. dependency-degradation test with an intentionally impaired non-canonical dependency.

Capture p50/p95/p99, error rate, CPU/memory, database pool wait, database query
time, queue depth, cache hit ratio and dependency latency for every run.

A test without server-side telemetry identifies symptoms but not the bottleneck.
