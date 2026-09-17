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

## What is measured

- host CPU, memory, filesystem and kernel metrics through node_exporter;
- per-container resource metrics through cAdvisor;
- each owned PostgreSQL service through a dedicated exporter;
- Redis through redis_exporter;
- application/data readiness through blackbox HTTP/TCP probes;
- Prometheus self-health and alert-rule evaluation.

Identity, Marketplace and Community expose a deliberately small internal
Prometheus surface: database pool total/idle connections, transactional outbox
backlog and metrics-query health. Marketplace also exposes active realtime
notification subscriber count. This is not a complete application metric
surface. Request latency/count/error metrics, queue lag and richer domain
metrics remain later slices and must be added from real code paths rather than
invented at the dashboard layer.

## Security

cAdvisor requires elevated host visibility. Keep the observability network and
UIs private. Never expose Prometheus, Alertmanager, cAdvisor, exporters, database
credentials or Docker host mounts directly to the public Internet.

Alertmanager currently uses a local null receiver so rules can evaluate without
committing notification credentials to Git. Configure a server-managed private
receiver before relying on alerts for paging.

## Operational checks

Prometheus should show these primary targets as healthy:

- node
- cadvisor
- postgres_identity
- postgres_marketplace
- postgres_community
- redis
- blackbox_http
- blackbox_tcp

A blackbox failure is different from an exporter failure: the former indicates
a serving/dependency readiness problem; the latter indicates lost visibility.
