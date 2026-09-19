# High-Availability Data Plane

This is an **opt-in** production topology. The normal `docker-compose.prod.yml`
path remains supported for single-host deployments.

## Goal

Application containers should be disposable. A single application host may fail
without taking canonical business data with it.

The HA overlay externalizes Identity, Marketplace and Community PostgreSQL,
Redis, RabbitMQ, Meilisearch, and WWW object storage. Chat continues to use the
production Scylla cluster contract. Community media remains filesystem-backed,
so all Community replicas must mount the same replicated/shared filesystem until
that path is moved to object storage.

## Data ownership

Each service keeps its owned database as an independent source of truth.
Externalizing databases does **not** mean collapsing service ownership into one
shared schema.

Release-owned SQLx migrations still run exactly once per release against writer
endpoints before application replacement.

## Required settings

Use `.env.ha.example` as a names-only template and source real credentials from
operator-managed secrets. Required groups include:

- `HA_IDENTITY_DATABASE_URL`, `HA_MARKETPLACE_DATABASE_URL`, `HA_COMMUNITY_DATABASE_URL`
- `HA_REDIS_URL` plus Chat's host/password fields
- `HA_RABBITMQ_URL`
- `HA_MEILI_URL` and `HA_MEILI_MASTER_KEY`
- S3-compatible object-storage endpoint, credentials, bucket and public URL
- `HA_COMMUNITY_MEDIA_MOUNT`

## Preflight

Run:

```bash
ENV_FILE=.env.production scripts/ops/ha_data_plane_preflight.sh
```

The preflight requires every HA endpoint, rejects obvious local/single-host
Compose endpoints, requires an absolute Community shared-media mount, and
validates the merged Compose configuration.

It does not prove provider failover.

## Start

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.ha.yml \
  up -d --remove-orphans --wait
```

Do not enable the `local-data` profile in HA mode.

## Application replicas

Run at least two application hosts/replicas behind the edge only after:

- release migrations are green;
- readiness is green;
- Community shared media is mounted identically;
- external PostgreSQL/Redis/RabbitMQ failover has been tested;
- scale rehearsal succeeds with one replica terminated.

## Cutover

1. Provision external data services.
2. Restore/copy data to isolated external targets.
3. Run reconciliation/invariants.
4. Quiesce writes for final delta if required.
5. Run HA preflight.
6. Run release migrations.
7. Start one application replica.
8. Run readiness/smoke/reconciliation.
9. Add a second replica.
10. Terminate either replica and verify traffic continues.
11. Move edge traffic.
12. Keep the previous topology available until rollback criteria expire.

Never restore an old database over a live source of truth.

## Failover evidence

HA is not complete because an endpoint is merely called "managed". Record actual
evidence for PostgreSQL writer failover, Redis recovery, RabbitMQ node loss plus
outbox drain, object-storage failure, Community shared-filesystem failover, and
application-host termination. Record measured RTO/RPO rather than inferring them
from provider marketing claims.
