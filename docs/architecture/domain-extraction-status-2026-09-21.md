# Lajukan Domain Extraction Status — 2026-09-21

## Purpose

This document records the implemented runtime state of the 2026 domain-extraction program so the repository does not confuse scaffolding with a completed service cutover.

## Current state

The target extraction services are deployed as independent containers and target databases, but these domains still run in **compatibility mode**:

- Profile / Business → `profile_service`
- Media → `media_service`
- News / Editorial → `news_service`
- Orders / Fulfillment → `order_service`
- Payments / Wallet → `payment_service`
- Promotion → `promotion_service`
- CRM → `crm_service`
- Communication → `communication_service`
- Trust / Verification → `trust_service`
- Support → `support_service`
- Reviews / Ratings → `review_service`

Compatibility mode means the target service owns a target database/schema and exposes health/readiness/migration surfaces, while business traffic is still proxied to the legacy `marketplace_service` until native handlers are implemented and verified.

This is intentional strangler-migration scaffolding, not a completed extraction.

## Fail-closed runtime contract

The supported compatibility contract is:

`DOMAIN_RUNTIME_MODE=compatibility`

`LEGACY_PROXY_ENABLED=true`

`LEGACY_UPSTREAM_URL=http://marketplace_service:8081`

`DATABASE_URL=postgres://...@domain_db:5432/<target_db>`

`LEGACY_PROXY_TIMEOUT_MS` must remain within the bounded 250–30000 ms range.

The runtime contract validator rejects a target extraction service that attempts to enter native mode before the current scaffold has a verified native implementation. It also checks the target database, legacy upstream and proxy enablement before Compose startup.

Production Compose explicitly pins the compatibility values for the staged services.

## What counts as a completed cutover

A domain may change from compatibility to native only after all of the following exist:

1. Native handlers implement the documented public/internal API.
2. Target migrations are complete and repeatable.
3. Backfill has reconciled source and target records.
4. Monetary/identity/order invariants pass where applicable.
5. Reads are switched and verified against the target.
6. Writes are switched and verified against the target.
7. Event/outbox replay or dual-write reconciliation has no unexplained divergence.
8. Legacy access is removed only after an observed rollback window.
9. Production readiness, monitoring, backup, and restore procedures cover the target.
10. Targeted E2E tests prove the critical user journey through the new owner.

## Extraction order

The active sequence remains:

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

The sequence is a migration plan, not a claim that a service is ready to cut over.

## Product surfaces that must remain contract-compatible

While extraction continues, these user-facing capabilities are already meaningful product surfaces:

- public UMKM discovery and map;
- canonical public storefronts and product ordering;
- merchant operations and finance;
- community/forum/reels;
- chat and support;
- CMS and CRM operational workspaces;
- News editorial approval/versioning/source verification;
- KYC/OCR/liveness runtime contracts;
- SEO/indexing and route-level loading/skeleton coverage.

Backend extraction must preserve their existing request/response, locale, authorization, ordering and safety semantics unless a contract change is explicit and tested.

## Operational evidence still required

Containers building or passing healthchecks are not sufficient proof of production readiness.

Open evidence areas include:

- production payment/wallet/reconciliation readiness;
- complete order/payment cutover;
- production chat reconnect/read/block/report behavior at scale;
- Meilisearch synchronization lag and rebuild drills;
- p95/p99 latency and database pool saturation;
- off-host immutable backup and restore drills for every target domain;
- complete owner CRM workspace/permission scoping;
- seeded E2E coverage for authenticated create/contact/report/CRM flows.

## Verification rule

For every extraction change:

- inspect migrations;
- inspect API contract;
- inspect runtime mode;
- reconcile source and target row counts and monetary invariants where relevant;
- run targeted tests;
- only then move the service to native mode.

A `*_service` directory, container image, port, migration, or healthcheck alone is not evidence of native ownership.
