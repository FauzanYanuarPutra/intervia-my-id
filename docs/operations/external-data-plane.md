# External / replicated data plane

Lajukan's default Compose topology remains useful for development, staging
rehearsal, and small single-host production. It is not a multi-host HA data
plane.

`docker-compose.external-data.yml` provides an explicit transition boundary
for deployments where the durable/cache/broker/search/object-storage systems
are operated outside the application host.

## What external mode changes

When `DATA_PLANE_MODE=external` is enabled:

- local single-node Identity, Marketplace, and Community PostgreSQL containers
  are moved behind the `local-data-plane` profile;
- local Redis, RabbitMQ, Meilisearch, and MinIO are also moved behind that
  profile;
- application services require explicit external endpoints;
- local Docker `depends_on` coupling to those data services is removed;
- release-owned migrations still run once, but against the configured external
  PostgreSQL URLs.

External mode is fail-closed. Run:

```bash
scripts/ops/external_data_plane_preflight.sh .env.production
```

before composing or deploying it.

## This does not automatically make the system HA

The external providers themselves must prove replication and failover. An
endpoint named `*-ha.internal` is not evidence of HA.

For PostgreSQL, verify replica/failover behavior, backups, WAL archiving and a
timestamp restore. For Redis/RabbitMQ/object storage, verify their provider-
specific replication/quorum/failover contracts.

## Community media blocker

Community uploads currently use the filesystem path
`/app/uploads/forum`. Therefore multi-host external mode requires
`COMMUNITY_UPLOADS_SHARED=true` and a pre-created
`COMMUNITY_UPLOADS_VOLUME` backed by genuinely shared/replicated storage
(NFS/Ceph/etc.).

A host-local Docker volume must never be labelled shared just to satisfy the
preflight. Until Community media moves to object storage, this filesystem
contract remains the explicit multi-host caveat.

## Observability

The repository's default PostgreSQL/Redis infrastructure exporters target the
local Compose data services. External mode therefore refuses the built-in
`observability` profile. Use provider metrics or add an explicit external-data
observability overlay before enabling that profile.

Application `/metrics` endpoints remain available independently.

## Activation

The normal deployment remains `DATA_PLANE_MODE=local`.

To activate external mode, populate the external endpoint variables in the
server-managed environment file, provide shared Community media storage, set:

```text
DATA_PLANE_MODE=external
COMMUNITY_UPLOADS_SHARED=true
```

and deploy normally. The deployment workflow adds
`docker-compose.external-data.yml` automatically after the preflight passes.

Rollback to local mode is only safe when the local data stores contain the
authoritative current state. Never use a mode switch as a database rollback.
