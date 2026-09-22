# High-Availability Data Plane

This is an **opt-in** production topology. The normal `docker-compose.prod.yml`
path remains supported for single-host deployments.

Use the HA overlay only after the external services below are provisioned and
their own failover/backup procedures are tested.

## Goals

Application containers should be disposable. A single application host may
fail without taking canonical business data with it.

The HA overlay externalizes:

- Identity PostgreSQL;
- Marketplace PostgreSQL;
- Community PostgreSQL;
- Redis;
- RabbitMQ;
- Meilisearch;
- WWW object storage.

Community uploads are currently filesystem-backed in the Community service.
Until that code path is moved to object storage, every Community application
host must mount the same replicated/shared filesystem at the path supplied by
`HA_COMMUNITY_MEDIA_MOUNT`.

Chat already uses the production `SCYLLA_NODES` contract from
`docker-compose.prod.yml`.

## Required topology

### PostgreSQL

Each owned database stays an independent source of truth. Use provider-native
multi-AZ/replication/failover or an equivalently tested PostgreSQL cluster.

Application URLs are supplied independently:

- `HA_IDENTITY_DATABASE_URL`
- `HA_MARKETPLACE_DATABASE_URL`
- `HA_COMMUNITY_DATABASE_URL`

Do not point several service owners at one shared schema merely to simplify
operations.

Release-owned SQLx migrations still run once per release before application
replacement. The migration runner therefore needs a writer endpoint.

### Redis

`HA_REDIS_URL` must point at a managed/replicated Redis endpoint. Chat's
current Hammer backend also needs `HA_REDIS_HOST` and
`HA_REDIS_PASSWORD`.

Redis is not a canonical business record. Failover may lose cache/rate-limit
state, but must not lose orders, money, stock, identities, or messages.

### RabbitMQ

`HA_RABBITMQ_URL` must point at a RabbitMQ cluster or managed AMQP service.
Durable business delivery still starts from PostgreSQL outbox rows. Consumers
must remain idempotent.

### Object storage

WWW media uses the S3-compatible values:

- `HA_OBJECT_STORAGE_ENDPOINT`
- `HA_OBJECT_STORAGE_ACCESS_KEY`
- `HA_OBJECT_STORAGE_SECRET_KEY`
- `HA_OBJECT_STORAGE_BUCKET`
- `HA_OBJECT_STORAGE_PUBLIC_URL`

The bucket must have replication/versioning appropriate to the production
recovery policy. Object storage credentials must not share application DB or
GitHub deployment credentials.

### Community media

`HA_COMMUNITY_MEDIA_MOUNT` must be an absolute path backed by shared,
replicated storage such as NFS/EFS/CephFS. A local directory with the same path
on two hosts is **not** shared storage.

Native object-storage migration for Community media remains the preferred
long-term replacement for this mount.

## Preflight

Load production secrets plus the HA settings and run:

```bash
ENV_FILE=.env.production scripts/ops/ha_data_plane_preflight.sh
```

The preflight:

1. requires every HA endpoint;
2. rejects obvious localhost/base-Compose endpoints;
3. requires an absolute Community shared-media path;
4. validates the merged Compose configuration.

It does not prove provider failover. Provider failover must be exercised
separately.

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

The overlay externalizes state but does not itself create multiple machines.
Run at least two application hosts/replicas behind the edge/load balancer only
after:

- release-owned migrations are enabled;
- request-serving readiness is green;
- Community shared media is mounted identically;
- external Redis/RabbitMQ/PostgreSQL failover has been tested;
- the scale rehearsal passes with one replica terminated.

The repository's application services are designed so broker/search
degradation does not unnecessarily prevent request-serving startup, while
owned PostgreSQL schema/readiness remains mandatory.

## Cutover sequence

1. Provision external data services.
2. Restore/copy production data to isolated external targets.
3. Run application invariants and reconciliation.
4. Freeze or quiesce writes for final delta/cutover if the provider migration
   method requires it.
5. Run HA preflight.
6. Run release migrations against writer endpoints.
7. Start one application replica using the HA overlay.
8. Run health, readiness, smoke, and reconciliation checks.
9. Add the second replica.
10. Test termination of either replica.
11. Move edge traffic.
12. Keep the prior topology intact until rollback criteria expire.

Never restore an old database directly over a live source of truth.

## Failover evidence

HA is not considered complete merely because an endpoint is managed. Record
evidence for:

- PostgreSQL writer failover and application reconnect time;
- Redis failover and rate-limit/cache recovery;
- RabbitMQ node loss plus outbox drain after recovery;
- object-storage replica/site failure;
- Community shared-filesystem failover;
- application-host termination while traffic continues.

Record actual RTO/RPO measurements in the disaster-recovery evidence rather
than inferring them from provider marketing claims.
