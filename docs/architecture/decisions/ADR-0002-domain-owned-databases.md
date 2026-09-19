# ADR-0002 — Domain-Owned Databases for Lajukan

Status: Accepted  
Date: 2026-09-20

## Context

Lajukan already has service boundaries, but Marketplace currently owns several unrelated domains. This makes data ownership ambiguous and causes the Marketplace service to become the dependency hub for News, Orders, Payments, CRM, notifications and other capabilities.

## Decision

Adopt domain-owned source-of-truth data.

Each target business domain gets:

- one owning service;
- one source-of-truth database (or explicitly documented non-SQL store);
- versioned migrations;
- API/event contracts;
- least-privilege credentials;
- observable read/write paths.

A database may share a physical PostgreSQL cluster with another service during the early migration phase. Logical database isolation is mandatory.

## Consequences

Positive:

- smaller services and clearer ownership;
- safer schema evolution;
- smaller blast radius;
- independent scaling for payment/order/news workloads;
- easier authorization audits;
- ability to move sensitive workloads to dedicated infrastructure later.

Costs:

- eventual consistency for some cross-domain reads;
- additional API/event contracts;
- migration/backfill complexity;
- projection maintenance;
- more operational surfaces.

## Alternatives rejected

### Keep everything in Marketplace

Rejected because it preserves the current coupling and makes unrelated domain changes compete inside one service/database.

### Create a microservice for every feature

Rejected because it would create service sprawl and increase operational/network dependency without evidence of need.

### Split Git repositories immediately

Rejected. The repository remains a monorepo while domain boundaries stabilize.

### Put every database on a separate server immediately

Rejected. Physical separation should follow security, capacity, availability or compliance evidence. Logical ownership comes first.

## Guardrails

- no direct cross-service SQL;
- no cross-database foreign keys;
- outbox/inbox for domain events;
- idempotent consumers;
- expand/backfill/switch/verify/contract migration sequence;
- CI ownership check;
- service-specific DB credentials.

## Rollback

The architecture decision itself is reversible, but each data extraction must have its own rollback plan. No domain extraction is considered complete until the old source-of-truth can be safely retired after a measured rollback window.

## References

- https://www.uber.com/us/en/blog/microservice-architecture/
- https://learn.microsoft.com/azure/architecture/microservices/design/data-considerations
- https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
