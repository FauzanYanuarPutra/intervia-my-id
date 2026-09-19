# Lajukan Domain-Service Boundary Architecture — 2026-09

Status: active target architecture, based on the repository HEAD and architecture review on 2026-09-20.

## Decision

Lajukan uses a domain-oriented architecture with explicit data ownership:

- one business/domain capability owns its source-of-truth data;
- services never query another service's database directly;
- cross-domain reads use APIs or rebuildable local projections;
- cross-domain business facts use versioned events;
- database physical separation is allowed to evolve independently from logical ownership.

This is intentionally not "one container per feature" and not a mandate to add Kubernetes, Kafka, a service mesh, or dozens of microservices before measured need.

## Current repository reality

The repository already has independent Identity, Marketplace, Community, Chat, AI, OCR and Liveness deployables. The main modularity debt is that `marketplace_service` still owns several unrelated business domains.

Current Marketplace responsibilities include listings/content, orders, transactions, wallet, UMKM commerce, CRM, notifications, support, CMS, News editorial, and AI/recommendation data.

The Marketplace service entrypoint is currently very large; the extraction program therefore uses behavior-preserving slices instead of a rewrite. Existing target services run in explicit compatibility mode until backfill/reconciliation and native handlers are ready.

## Target domains

| Domain | Target service | Target source-of-truth | Current state |
| --- | --- | --- | --- |
| Identity | identity_service | identity_db | implemented |
| Profile / Business | profile_service | profile_db | extract from Identity/Marketplace where applicable |
| Media | media_service | media_db + object storage | extract from upload surfaces |
| News / Editorial | news_service | news_db | extract from Marketplace |
| Marketplace / Discovery | marketplace_service | marketplace_db | keep focused |
| Orders / Fulfillment | order_service | order_db | extract from Marketplace |
| Payments / Wallet | payment_service | payment_db | extract from Marketplace |
| Promotion | promotion_service | promotion_db | extract from Marketplace/CMS |
| CRM | crm_service | crm_db | extract after workspace/permission foundation |
| Community | community_service | community_db | implemented |
| Chat / Realtime | chat_service | Scylla keyspace | implemented |
| Communication | communication_service | communication_db | extract notification/delivery workloads |
| Trust / Verification | trust_service | trust_db | extract verification policy/status |
| Support | support_service | support_db | extract support tickets/replies |
| Reviews / Ratings | review_service | review_db | extract reviews; rating summaries become projections |
| Search | search_service | rebuildable index | projection, not transactional source |
| Audit | audit_service / audit store | audit_db | cross-domain immutable audit sink |
| AI orchestration | ai_service | no business source-of-truth | implemented runtime |
| OCR | ocr_service | no business source-of-truth | implemented runtime |
| Liveness | liveness_service | no business source-of-truth | implemented runtime |

## Database rule

"Database per service" means database ownership and access isolation, not mandatory physical servers.

Phase 1 may use one PostgreSQL cluster with separate databases:

```text
postgres cluster
├── identity_db
├── profile_db
├── media_db
├── news_db
├── marketplace_db
├── order_db
├── payment_db
├── promotion_db
├── crm_db
├── community_db
├── communication_db
├── trust_db
├── support_db
├── review_db
└── audit_db
```

Each service gets least-privilege credentials for its own database. A later move to separate managed instances/clusters is an infrastructure change, not a domain redesign.

## Hard boundaries

### Forbidden

- direct SQL/query access from service A into service B's database;
- cross-database foreign keys;
- shared business tables with two source-of-truth owners;
- frontend code that chooses an internal service directly;
- "temporary" foreign database access hidden in ORM/repository helpers;
- payment state changed by Order/Marketplace SQL;
- News editorial state changed by CMS SQL;
- Profile state changed by Marketplace SQL.

### Allowed

- synchronous API calls for request/response reads or commands;
- asynchronous versioned events for integration;
- local read models/projections;
- replicated display fields that are explicitly marked as projections;
- shared infrastructure libraries (logging, tracing, validation, storage client, contracts).

## Cross-domain integration

The default transport remains RabbitMQ because the repository already has outbox/inbox foundations. Kafka is not introduced unless throughput, replay, retention, or ordering requirements demonstrate that RabbitMQ is insufficient.

Event envelope:

```json
{
  "event_id": "uuid",
  "event_type": "payment.succeeded",
  "version": 1,
  "occurred_at": "RFC3339",
  "producer": "payment_service",
  "aggregate_type": "payment",
  "aggregate_id": "uuid",
  "correlation_id": "uuid",
  "causation_id": "uuid|null",
  "payload": {}
}
```

Rules:

1. domain write + outbox insert are one database transaction;
2. consumers are idempotent;
3. event handlers never assume delivery order unless the contract says so;
4. event payloads contain references and business facts, not secrets;
5. events are immutable once published;
6. event schema changes are versioned.

## Critical workflows

### Listing

```text
Marketplace → media_id → Media
Marketplace → seller_id → Profile/Identity reference
Marketplace → verification status projection → Trust
```

### News submission

```text
WWW → News → news_db
             ↓
        editorial review
             ↓
         NewsPublished
             ↓
        Search projection
             ↓
       Notification (async)
```

### Order and payment

```text
Marketplace
    ↓
Order Service
    ↓
Payment Service
    ↓
provider
    ↓
payment.succeeded / payment.failed
    ↓
Order projection/state transition
```

Payment owns payment state, provider references, webhook idempotency and ledger invariants. Order owns order state. Neither service writes the other's database.

### Profile / Business

```text
Identity owns user/account identity
Profile owns public/business profile
Media owns uploaded media
Trust owns verification state
```

Profile displays can use read models rather than cross-database joins.

## Search

Search is a rebuildable projection. Canonical domains publish events and Search indexes them.

Search must not become the only durable copy of:

- listings;
- news;
- profiles;
- orders;
- payment state;
- verification state.

A full search rebuild must be possible from canonical domain databases and event/replay sources.

## Read models

When a page needs data from multiple domains, prefer:

```text
Source domains
   ↓ events
local projection/read model
   ↓
request
```

over synchronous fan-out or cross-database joins on latency-sensitive routes.

Projected fields must have:

- source owner;
- last-updated timestamp;
- projection version;
- rebuild procedure.

## Migration method

Every extraction follows:

```text
1. Characterize current behavior
2. Create target DB/schema
3. Build target service/API
4. Backfill data
5. Add compatibility/dual-read if needed
6. Switch reads
7. Switch writes
8. Replay/verify events
9. Observe rollback window
10. Contract and remove legacy tables
```

No destructive "copy then drop" migration. Compatibility mode is the rollback bridge; native mode is intentionally fail-closed until verification passes.

For financial and identity data, additionally require:

- invariant checks;
- row counts and monetary totals;
- idempotency verification;
- reconciliation evidence;
- backup/restore verification.

## Extraction order

1. Media
2. News
3. Profile / Business
4. Order
5. Payment / Wallet
6. CRM
7. Communication
8. Trust
9. Support
10. Reviews / Ratings
11. Promotion
12. Search projection consolidation
13. Marketplace slimming
14. Legacy table removal

The order is intentional: Payment follows Order; CRM follows workspace/authorization foundations; Search stays projection-only.

## Repository structure target

The repository remains a monorepo:

```text
services/
  identity_service/
  profile_service/
  media_service/
  news_service/
  marketplace_service/
  order_service/
  payment_service/
  promotion_service/
  crm_service/
  community_service/
  chat_service/
  communication_service/
  trust_service/
  support_service/
  review_service/
  search_service/
  ai_service/
  ocr_service/
  liveness_service/
```

Do not create empty placeholder services merely to make the tree look complete. A service directory is created when the first production responsibility is extracted with tests and a migration plan.

## Service dependency rules

Prefer:

```text
Browser → BFF → domain service
domain write → local DB + outbox
outbox → RabbitMQ
consumer → local projection / domain command
```

Avoid request chains such as:

```text
A → B → C → D → E
```

for ordinary CRUD/read paths.

Every synchronous dependency needs a timeout and bounded retry policy. Financial calls require explicit idempotency.

## Deployment

Lajukan keeps immutable commit-derived application images and the existing staging/prod promotion model.

Domain extraction must preserve:

- backwards-compatible database changes during rollback windows;
- readiness checks;
- health probes;
- service-specific secrets;
- least-privilege DB credentials;
- observability;
- restore/rollback procedures.

Physical scaling evolves later from measured capacity. Do not introduce Kubernetes or a service mesh solely because the number of services increases.

## Observability

Each request/event crossing a service boundary carries:

- trace_id;
- correlation_id;
- event_id where applicable;
- producer/service name.

Minimum signals:

- request rate;
- error rate;
- p50/p95/p99 latency;
- DB pool usage;
- queue depth/consumer lag;
- outbox age/backlog;
- projection lag;
- external provider latency/errors;
- payment reconciliation mismatches.

## Security

Every object route checks object-level authorization server-side. Authentication alone is not authorization.

Sensitive values must never be logged:

- bearer tokens;
- cookies;
- passwords;
- OTPs;
- raw identity documents;
- provider secrets;
- full payment credentials.

Payment/KYC remain fail-closed when their critical dependency/configuration is unavailable.

## External reference patterns

The architecture intentionally draws on the following established patterns:

- Uber DOMA: domain/gateway organization to avoid microservice sprawl.
- Azure Microservices data ownership: private data ownership, API/event integration, and no direct cross-service database access.
- AWS Transactional Outbox: atomic domain write + event publication intent.
- AWS Saga guidance: use multi-service sagas selectively because coordination complexity grows with participants.
- Stripe API/webhook practices: idempotency, signature verification, and duplicate/out-of-order webhook tolerance.
- OpenTelemetry: distributed trace and context propagation across services.

Primary references:
- https://www.uber.com/us/en/blog/microservice-architecture/
- https://learn.microsoft.com/azure/architecture/microservices/design/data-considerations
- https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/saga-pattern.html
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/webhooks
- https://opentelemetry.io/docs/concepts/observability-primer/

## Cutover guardrail state

The extracted domain services are deployment-ready in compatibility mode. Native cutover is intentionally blocked until the target database is backfilled, row/schema invariants are verified, reconciliation is clean, and the relevant route is switched deliberately. This keeps the extraction reversible and avoids silently creating two sources of truth.
