# Scale and Reliability Architecture V1

Status: active engineering direction as of 2026-09-18.

This document defines how Lajukan evolves from the current single-host Docker
Compose deployment into a highly available platform without prematurely
introducing infrastructure whose operational cost is larger than the measured
need.

The goal is not a vanity request-per-second number. The goal is bounded blast
radius, predictable latency, safe degradation, measurable capacity, recoverable
state, and a migration path that does not require a rewrite.

## Current verified topology

The repository currently has strong application-level boundaries:

- Identity, Marketplace, Community, Chat, AI, OCR and Liveness are separate deployables.
- Identity, Marketplace and Community own separate PostgreSQL databases.
- Chat uses ScyllaDB.
- Redis is cache/coordination, RabbitMQ is messaging, Meilisearch is a rebuildable search projection and MinIO owns object storage.
- Transactional outbox/inbox patterns exist in multiple services.
- Production deploys immutable application image tags and rolls back the application release when the deployment health gate fails.

The production deployment is still one operational failure domain. The deploy
workflow SSHes to one DEPLOY_HOST and applies one Docker Compose stack. A
container restart protects against a process exit; it does not protect against
host, disk, Docker daemon, network, edge proxy or site failure.

That distinction is the primary scale/reliability gap.

## Reliability invariants

These rules apply before any scale phase:

1. PostgreSQL remains the transactional source of truth for its owned domains.
2. Redis, RabbitMQ and Meilisearch must not become the only durable copy of a business fact.
3. Search and cache must be rebuildable.
4. Database write plus external event publication uses outbox semantics where the operation is one business fact.
5. Consumers are idempotent and duplicate delivery must be harmless.
6. Critical request paths depend on as few synchronous services as possible.
7. Optional systems fail open only when doing so is safe. Security, identity, authorization, financial integrity and KYC fail closed.
8. Retries are bounded, jittered and performed only for operations known to be retry-safe. Financial writes require explicit idempotency keys.
9. Timeouts are layered from client to edge to service to dependency so an inner dependency cannot consume the entire request budget.
10. Capacity is measured by workload class, not by a single global QPS number.

## Failure behavior

Expected degraded behavior is part of the product contract.

| Dependency impaired | Required behavior |
| --- | --- |
| Redis | Cache miss or reduced convenience; durable business data remains available where safe. |
| Meilisearch | Search may degrade to a bounded fallback or explicit unavailable state; transactional writes continue. |
| RabbitMQ | Durable outbox accumulates pending events; committed business facts are not lost. |
| AI provider | AI features become unavailable/degraded; marketplace, auth and business operations continue. |
| Recommendation system | Fall back to deterministic/popular/recent ordering. |
| Notification delivery | Commit the transaction first and deliver notifications asynchronously when possible. |
| Payment provider | Preserve local state machine, use idempotency, reconcile later; never guess payment success. |
| One stateless replica | Load balancer removes it; remaining replicas serve within measured spare capacity. |
| One availability zone | Healthy zones keep enough pre-provisioned capacity for the agreed SLO. |

## Evolution phases

### Phase 0 — make the single-host system measurable

Keep Docker Compose. Finish SLOs, request IDs, structured logs, metrics,
dashboards, alert ownership, load tests, dependency timeout budgets, backup
verification and restore drills.

Exit criteria:

- production p50/p95/p99 and error-rate baselines exist for critical journeys;
- database pool saturation and slow queries are visible;
- queue depth/consumer lag and cache hit ratio are visible;
- restore tests produce evidence rather than only a written procedure;
- capacity tests identify the first bottleneck.

### Phase 1 — remove avoidable single-process failure

Run at least two stateless replicas for public frontends and core stateless
services behind a health-aware load balancer. Keep stateful systems external or
single-primary only until their HA design is verified.

Do not scale a service horizontally until session state, local filesystem
state, migrations, background workers and idempotency have been checked for
multi-instance safety.

### Phase 2 — remove the single-host failure domain

Move public compute to at least two independent nodes. The edge/load balancer
must be able to stop routing to an unhealthy node.

Stateful target:

- PostgreSQL: primary plus standby, tested promotion, PITR and connection pooling; add read replicas only for measured read pressure.
- Redis: HA topology only for availability. It remains non-canonical.
- RabbitMQ: a quorum-capable multi-node topology before business availability depends on broker uptime.
- ScyllaDB: multiple nodes across failure domains with replication appropriate to the consistency/availability requirement.
- Object storage: managed object storage or distributed/replicated MinIO with versioning and independently tested recovery.
- Search: a topology that matches measured indexing/query load; remain rebuildable from canonical sources.

### Phase 3 — multi-zone production

Spread compute and state replicas across independent availability zones.
Design for static stability: surviving zones have enough reserved capacity to
serve the expected failover load without waiting for emergency scale-up.

Deployments use rolling/canary replacement with health gates and automatic
rollback. Destructive schema changes remain expand/backfill/switch/verify/
contract so the previous application version can run during rollback.

### Phase 4 — cells and regional isolation

Introduce cells only when tenant/user count, write volume, operational blast
radius or database limits justify it.

A cell owns a bounded partition of users/businesses and its serving stack. A
routing directory maps a stable tenant/user key to a cell. A cell failure
therefore affects a bounded population instead of the entire platform.

Cross-cell global features use explicit asynchronous aggregation. They must not
turn every request into synchronous fan-out across all cells.

### Phase 5 — multi-region

Multi-region is justified by latency, disaster-recovery, regulatory or
availability requirements, not prestige.

Default direction:

- active/active for cacheable public reads where conflict risk is low;
- region ownership or carefully designed conflict semantics for writes;
- regional isolation for chat/realtime and high-volume event ingestion;
- globally replicated static/media assets;
- explicit failover and failback runbooks with regular drills.

## What does not trigger a rewrite

Do not introduce Kubernetes, Kafka, a service mesh, database sharding or a new
programming language merely because traffic grew.

A new infrastructure layer requires evidence such as:

- repeated host-level incidents that the current deployment model cannot isolate;
- replica count/placement that is operationally unsafe to manage with Compose;
- broker throughput/retention/replay requirements RabbitMQ cannot satisfy;
- database size/write rate/lock pressure that cannot be solved by query/index, pooling, partitioning or vertical/replica improvements;
- measured cross-region latency or recovery objectives that require regional placement.

## Capacity model

Track separate workload classes:

- cacheable public reads;
- authenticated reads;
- transactional writes;
- search queries;
- media upload/download;
- WebSocket connections/messages;
- event publication/consumption;
- AI inference.

For each class record sustained throughput, burst throughput, p50/p95/p99,
error rate, concurrency, CPU, memory, DB time, pool utilization and downstream
saturation.

One cheap cached GET and one order/payment workflow are not equivalent units of
capacity.

## Required next implementation slices

1. Make the reliability CI contract mandatory in repository governance.
2. Activate production-grade metrics/logs/traces and alert delivery.
3. Establish representative read/write/WebSocket load tests in staging.
4. Measure and tune connection pools, timeouts and queue worker concurrency.
5. Extract Marketplace and Community responsibilities incrementally so hot domains can later scale independently without changing public contracts.
6. Build a two-node stateless production rehearsal before changing the data plane.
7. Rehearse PostgreSQL failover/PITR and object-storage recovery before calling the platform highly available.

This document is a migration contract, not a claim that every target is already
implemented.
