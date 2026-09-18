# Observability Runtime

The observability stack is opt-in and Linux-host oriented because node_exporter
and cAdvisor inspect host/container state.

Start it together with the normal stack:

```bash
docker compose \
  --profile observability \
  --env-file .env.development \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.observability.yml \
  up -d
```

Production uses the same observability overlay with `docker-compose.prod.yml`.
No Prometheus or Alertmanager port is published publicly. Inspect them through
an SSH tunnel, a private administration network, or a separately authenticated
internal gateway.

## Operator cockpit

Grafana is provisioned from Git and binds only to loopback on
`127.0.0.1:${GRAFANA_PORT:-3005}`. Reach it through an SSH tunnel or another
private administration path. The default dashboard shows request rate, 5xx
ratio, p95 latency, in-flight requests, readiness probes, PostgreSQL health,
host memory, host CPU, and RabbitMQ backlog.

The Prometheus rules also calculate 99.9%-SLO error-budget burn signals using
short and long windows. These are internal engineering signals, not an external
availability claim.

## What is measured

- host CPU, memory, filesystem and kernel metrics through node_exporter;
- per-container resource metrics through cAdvisor;
- each owned PostgreSQL service through a dedicated exporter;
- Redis through redis_exporter;
- RabbitMQ queue/broker metrics through the built-in rabbitmq_prometheus plugin on the internal network;
- application/data readiness through blackbox HTTP/TCP probes;
- Prometheus self-health and alert-rule evaluation.

Identity, Marketplace and Community expose internal Prometheus metrics for
database pool total/idle connections, transactional outbox backlog, oldest
unpublished outbox-event age, metrics-query health, HTTP request/response
counts, in-flight requests and request-duration histograms. Marketplace also
exposes active realtime notification subscriber count.

The request metrics deliberately keep labels low-cardinality: service and status
class are exported, but raw request paths and object IDs are not metric labels.
Request IDs remain in structured logs/responses for correlation.

RabbitMQ queue lag, provider-specific latency and richer domain metrics should
continue to be added from real code paths rather than invented at the dashboard
layer.

## Security

cAdvisor requires elevated host visibility. Keep the observability network and
UIs private. Never expose Prometheus, Alertmanager, cAdvisor, exporters, database
credentials or Docker host mounts directly to the public Internet.

Alertmanager uses the repository's local null receiver only as a safe
development/staging default so rules can evaluate without committing paging
credentials to Git.

If production enables the `observability` Compose profile, deployment now
fails closed unless `ALERTMANAGER_CONFIG_PATH` points to an existing
server-managed config outside the repository default. The deploy gate also
rejects configs that still contain the `local-null` receiver. Keep receiver
credentials and webhook URLs in server-managed configuration or a secret store,
not in Git.

## Operational checks

Prometheus should show these primary targets as healthy:

- node
- cadvisor
- postgres_identity
- postgres_marketplace
- postgres_community
- redis
- rabbitmq
- blackbox_http
- blackbox_tcp

A blackbox failure is different from an exporter failure: the former indicates
a serving/dependency readiness problem; the latter indicates lost visibility.
