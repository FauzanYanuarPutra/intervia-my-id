# Lajukan Economic Operating System

Status: accepted foundation architecture, 2026-08-22.

## Product boundary

Lajukan has two connected product surfaces:

- `www.lajukan.com` is the public economic network for discovery, needs, supply,
  community, learning, trust, negotiation, and transactions.
- `usaha.lajukan.com` is the private operating workspace for organizations,
  branches, catalog, inventory, procurement, sales, finance, and later
  accounting, people, and production.

They share identity and economic contracts. They do not duplicate databases or
create a separate account system.

## Architecture decision

The current repository already contains the right coarse service boundaries.
Do not add one microservice per ERP module.

| Owner | Canonical responsibility |
| --- | --- |
| Identity | users, sessions, organizations, memberships, roles, permissions |
| Marketplace | public stores/listings, needs, RFQ/quotes, orders, payments, wallet, transaction reputation |
| Business domain inside Marketplace initially | branch, catalog, inventory, procurement, sales, finance primitives scoped by `organization_id` |
| Community | groups, forum, reels, shared knowledge |
| Chat | negotiation and conversation history |
| AI | advisory orchestration; never the transactional source of truth |

Business capabilities start as coherent modules in the Marketplace modular
monolith. Extraction into another deployable service requires measured load,
team ownership, or availability needs that cannot be met inside the current
boundary. A new `business_service` must not be created merely to mirror the UI
sidebar.

## Tenant model

```text
Identity user
    |
    +-- organization membership -- Organization
                                      |
                                      +-- Branch / Store
                                      +-- Warehouse
                                      +-- Department / Team
                                      +-- Business records
```

Every private business aggregate carries an immutable `organization_id`.
Every request derives the actor from a verified access token and resolves the
actor's membership and permission server-side. A client-supplied owner, user,
organization, store, order, or warehouse identifier is never sufficient
authorization.

Shared database-per-service tenancy is appropriate for the current scale, but
tenant isolation is defense in depth:

1. route authorization checks actor + object;
2. repository queries include the tenant predicate;
3. sensitive tenant tables use PostgreSQL row-level security when the service
   reliably sets transaction-local actor/tenant context;
4. audit events record actor, tenant, object, action, result, and correlation
   ID without secrets or sensitive payloads.

PostgreSQL applies default deny when row security is enabled without an
applicable policy, but table owners normally bypass RLS. Therefore application
authorization remains mandatory and production database roles must be audited.

## First complete economic loop

The first target is a usable, measured vertical slice:

```text
Organization
  -> Store/branch
  -> Product and stock
  -> Need/RFQ
  -> Supplier quote
  -> Purchase order
  -> Goods receipt
  -> Stock movement
  -> Payable/payment evidence
  -> balanced journal posting
  -> reorder insight
```

Later modules extend this loop. They do not run ahead of it.

## State and event rules

- PostgreSQL remains the transactional source of truth.
- A business mutation and its domain event are written in one database
  transaction using the existing outbox.
- Consumers are idempotent and store event IDs before side effects.
- Cross-service references are UUID values plus local projections, never
  foreign keys or direct queries into another service database.
- Search, recommendation, and analytics data are rebuildable projections.
- Financial postings use immutable journal entries and explicit reversal;
  debit must equal credit for every posted entry.

Initial domain events include:

- `identity.organization.created`
- `identity.organization.member_added`
- `marketplace.store.created`
- `catalog.product.created`
- `inventory.stock_received`
- `procurement.rfq.created`
- `procurement.quote.accepted`
- `procurement.purchase_order.issued`
- `finance.vendor_bill.recorded`
- `accounting.journal.posted`

## Delivery phases

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 | runtime safety, verified backups, object authorization | startup and restore checks pass; mutating object routes fail closed |
| 1 | persistent Organization/Workspace and owner-scoped store/catalog | restart-safe business creation; cross-owner access tests pass |
| 2 | Need/RFQ/quote/PO transaction loop | one real procurement completes without duplicate input |
| 3 | inventory movements, reservations, receipts, reorder | stock invariants and concurrency tests pass |
| 4 | invoice, payable/receivable, cash/bank | idempotent payments and reconciliation pass |
| 5 | double-entry accounting and statements | journal balance and closing invariants pass |
| 6 | POS and CRM | sale-to-stock-to-ledger loop passes |
| 7 | employee, attendance, leave, payroll rules | effective-dated rules and payroll reconciliation pass |
| 8 | projects, assets, approvals, documents | tenant permissions and audit completeness pass |
| 9 | BOM, MRP, work order, QC | material and production reconciliation pass |
| 10 | tax workflow, AI copilot, benchmark, financing readiness | advice is explainable, consented, and tied to verified business data |

## Product metrics

The leading product measure is `Active Businesses Running on Lajukan`: an
organization with at least one meaningful sale, purchase, inventory movement,
invoice, POS transaction, or marketplace transaction in 30 days.

Guardrails include:

- monthly business retention;
- marketplace-to-Business-OS loop rate;
- RFQ-to-qualified-quote and quote-to-order conversion;
- median time to match;
- completed and repeat transaction rates;
- inventory and ledger reconciliation error rates;
- cross-tenant authorization failures;
- fraud, dispute, and concentration rates;
- measured economic value created for participating businesses.

## References

- PostgreSQL row-level security:
  https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- PostgreSQL `CREATE POLICY` and default deny:
  https://www.postgresql.org/docs/current/sql-createpolicy.html
- OWASP API1:2023 Broken Object Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- Transactional outbox:
  https://microservices.io/patterns/data/transactional-outbox.html
- Multi-tenant isolation considerations:
  https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models

