# Capacity Testing

Lajukan treats capacity as measured evidence, not an architectural claim. The default
read-path scenario is intentionally read-only and refuses known production hosts unless
an explicit production load window is approved.

## Profiles

| Profile | Start RPS | Peak RPS | Purpose |
| --- | ---: | ---: | --- |
| smoke | 5 | 50 | deployment/runtime sanity |
| baseline | 25 | 250 | repeatable staging baseline |
| stress | 100 | 1,000 | identify saturation and queueing |
| extreme | 250 | 5,000 | controlled ceiling exploration only |

`stress` and `extreme` require `I_UNDERSTAND_HIGH_LOAD`. Any target using a known
Lajukan production hostname additionally requires both the production boolean and
`I_UNDERSTAND_PRODUCTION_LOAD`.

The workflow is manual by design. Do not make the high-load profiles run automatically
on pull requests or production deployments.

## Run

Use **Actions → Capacity Baseline → Run workflow** and point it to staging. Keep
`allow_production` disabled for normal testing.

For local/operator execution:

```bash
BASE_URL=https://staging.example.test \
PATHS="/,/id/news" \
PROFILE=baseline \
bash scripts/load/run-capacity-baseline.sh
```

Each run writes immutable evidence for that invocation:

- run timestamp and Git SHA;
- target URL and read-only path set;
- requested start/peak RPS and VU budgets;
- k6 summary JSON with achieved request rate, error rate, and latency percentiles.

GitHub Actions uploads the evidence as a 30-day artifact.

## Interpret with service metrics

A k6 result alone is not a capacity conclusion. During the same window correlate it with
Grafana/Prometheus:

- HTTP p50/p95/p99 and 5xx rate;
- in-flight requests and overload rejections;
- PostgreSQL active/max pool usage and lock waits;
- canonical outbox backlog, oldest age, retry count, and terminal failures;
- RabbitMQ queue depth and consumer count;
- Redis/Meilisearch dependency health;
- container CPU, memory, restart count, and host pressure.

The useful capacity number is the highest sustained load that still satisfies the SLO
without unbounded queues or resource saturation. If a downstream queue keeps growing,
the system is already beyond sustainable throughput even when HTTP remains superficially
fast.

## Promotion rule

Do not introduce Kubernetes, a service mesh, Kafka, or arbitrary service splits merely
because a synthetic peak sounds large. First identify the measured bottleneck, improve
or scale that constrained resource, and rerun the same profile so the result is
comparable.
