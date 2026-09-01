# Lajukan Phase 1 Quality Loop Design

## Goal

Bring the Lajukan critical path to a verifiable production-grade 10/10 state through small, reviewable pull requests that continuously audit, improve, verify, merge, and re-audit the latest `main` HEAD.

## Scope

Phase 1 covers the critical path only:

- `frontend/apps/www`
- `frontend/apps/usaha`
- `services/identity_service`
- `services/marketplace_service`
- PostgreSQL persistence used by those services
- authentication and authorization
- business/public projection contracts
- CI/CD gates required to merge and deploy the critical path
- runtime observability, performance budgets, rollback and recovery evidence

Community, chat, AI, OCR/liveness, CMS, CRM, and other subsystems remain in the overall 10/10 target but are handled after Phase 1 has no unresolved P0/P1 issues.

## Working Model

All changes go through focused pull requests. Direct feature pushes to `main` are not part of the quality loop.

Each iteration is:

1. Audit current `main` HEAD.
2. Rank gaps by severity, user impact, and architectural risk.
3. Select one cohesive change set.
4. Create a focused branch.
5. Add failing tests first where behavior changes.
6. Implement the smallest coherent fix.
7. Run targeted tests, then the relevant repository gates.
8. Review the PR diff for architecture, security, regressions, and scope creep.
9. Merge only after required evidence is green.
10. Re-audit the new `main` HEAD and repeat.

Auto-merge may be enabled only when repository rules permit it and all required checks for that PR are green. If branch protection/rules cannot be read by the integration, the loop must not assume they exist; merge eligibility is determined from observable PR/check evidence.

## Definition of 10/10

A phase is not complete because the code looks clean. Phase 1 reaches 10/10 only when all of the following are true against the latest merged `main` HEAD:

- no unresolved P0 or P1 findings
- build is green
- lint/static analysis is green for changed critical-path code and no new debt is introduced
- unit tests are green
- integration tests are green
- critical E2E business flow is green
- security gates are green
- tenant isolation negative tests are green
- database migrations are verified
- idempotency and concurrency behavior are verified
- runtime smoke tests are green
- structured observability exists for the critical path
- measured performance budgets are satisfied or explicitly baselined with no critical regression
- rollback path is proven
- backup/restore or recovery procedure is exercised for critical state
- no duplicate source of truth remains for canonical business state
- no sensitive upstream/internal error data is exposed to the browser

## Architecture Principles

### Canonical business state

Marketplace Business is the canonical business aggregate for the critical path. Usaha consumes canonical business APIs through its server adapter. WWW consumes only public/published projections appropriate for buyers and discovery.

Legacy Store/public representations may remain only as explicit compatibility or projection surfaces. They must not silently become an independent writable source of business truth.

### Domain persistence

Operational data must move out of generic metadata once it carries transactional, authorization, concurrency, or query requirements.

Priority domainization order:

1. products and inventory
2. orders/leads
3. team/membership and invitations
4. operational settings/schedule
5. reservations or other later operational entities

Each new domain uses explicit database constraints, repository methods, service policy, API contracts, and tests.

### Authorization

Organization membership remains the tenant boundary, but write authorization evolves from a single `org_admin` gate to capability-oriented permissions.

Target permission vocabulary:

- `business.profile.write`
- `product.write`
- `inventory.adjust`
- `order.manage`
- `team.invite`
- `finance.read`
- `settings.security`

Actor A must never read or mutate Actor B's business unless membership and permission policy explicitly authorize it. Negative cross-tenant tests are mandatory.

### Concurrency and idempotency

Mutable aggregates use optimistic concurrency where lost updates are meaningful. Mutating endpoints that can be safely retried use idempotency keys with deterministic behavior and conflict detection.

Database writes crossing multiple records use a transaction boundary that prevents partial state.

### Dependency failure behavior

Identity and PostgreSQL failures must map to stable application error codes and safe client messages. The system must fail closed for authorization uncertainty. Retriable failures must be distinguishable from validation or policy failures.

## WWW and Usaha Product Contract

`www.lajukan.com` is the public discovery and demand/supply funnel.

Its critical loop is:

`need/search -> result/business -> trust -> contact/chat/action -> lead/order/match`

`usaha.lajukan.com` is the owner operating system.

Its critical loop is:

`create/reconcile business -> configure -> publish -> receive demand -> operate -> update state`

Phase 1 E2E must prove the bridge between both surfaces:

`login -> create business -> edit in Usaha -> publish/publicly visible in WWW -> buyer action -> lead/order recorded -> owner sees it in Usaha`

## Observability

Critical-path requests must produce structured logs containing safe identifiers and timing fields, including:

- request/correlation ID
- route/service
- response status
- stable error code
- safe actor ID or hashed equivalent where appropriate
- business ID where safe
- total latency
- database latency
- Identity dependency latency

Service metrics must support p50/p95/p99 analysis, error rate, dependency failures, and readiness. Logs must never contain secrets, bearer tokens, raw credentials, or sensitive upstream error payloads.

## Initial Performance Budgets

Budgets are guardrails and must be adjusted only from measured baselines, not preference:

- API read p95 target: under 300 ms in representative staging conditions
- API mutation p95 target: under 700 ms in representative staging conditions
- critical API error rate target: under 1% excluding intentional 4xx validation/policy responses
- WWW LCP target: under 2.5 s on representative mobile conditions
- WWW INP target: under 200 ms on representative mobile conditions

A missed budget blocks the 10/10 declaration until the cause is understood and either fixed or the budget is revised with evidence.

## CI and Merge Gates

The repository already separates quality, security, frontend runtime, Usaha Business OS, deployment, edge, KYC, and image workflows. Phase 1 does not replace those workflows for cosmetic consistency. It strengthens their role as merge evidence.

A PR touching the critical path must run the relevant subset of:

- formatting/lint/static analysis
- frontend unit/build checks
- Rust fmt/clippy/test checks
- database/migration checks
- integration tests
- critical E2E tests
- security scans
- runtime smoke/contract checks

A PR must not be merged when an applicable required check is failing, the PR head moved after review, or a P0/P1 issue remains in the change set.

## PR Design Rules

Each PR must be cohesive, independently reviewable, and reversible.

Preferred examples:

- `refactor(business): establish canonical inventory persistence`
- `security(authz): add granular business permissions`
- `test(business): cover cross-tenant mutation isolation`
- `perf(www): remove duplicate business fetches`

Avoid opaque commit/PR names and unrelated cleanup bundled into behavior changes.

Large files may be split only when the split directly improves the work being changed. Do not perform repository-wide aesthetic refactors.

## Phase 1 Work Order

### Wave A — canonical data and contracts

- identify all remaining writable legacy business/store paths
- remove duplicate write paths
- make business/public projection boundaries explicit
- domainize products/inventory first
- establish transaction and migration rules

### Wave B — authorization and consistency

- capability-based authorization
- actor A/B tenant isolation tests
- optimistic locking on mutable aggregates
- idempotency/retry semantics
- fail-closed dependency behavior

### Wave C — end-to-end product correctness

- Usaha canonical adapters only
- WWW public projection consumption only
- buyer-to-owner lead/order bridge
- critical E2E flow
- safe error UX and recovery states

### Wave D — runtime quality

- structured logs and metrics
- performance measurement and query tuning
- health/readiness semantics
- security hardening
- migration, rollback, backup/restore drill

### Wave E — final audit

Audit the merged `main` HEAD from zero assumptions. Re-open any failed category as a new focused PR. Phase 1 closes only after the 10/10 definition is satisfied with evidence.

## Non-Goals

Phase 1 does not introduce Kubernetes, Kafka, service mesh, new databases, or new microservices unless a measured requirement makes them necessary.

It does not rewrite SQLx to an ORM, replace the same-origin Next.js BFF pattern, or move AI-provider logic into frontend services.

It does not expand marketplace category breadth merely to increase feature count.

## Verification Strategy

Every behavior change follows test-first development where practical:

- domain rule -> unit test
- repository behavior -> database integration test
- authorization rule -> positive and negative actor tests
- API contract -> route/service test
- cross-service behavior -> integration test
- critical user journey -> E2E test

Before completion claims, verification output must be checked rather than inferred from code inspection.

## Completion Output

At the end of each PR iteration, record:

- PR number and merged SHA
- problem solved
- tests/checks executed
- remaining findings by severity
- scorecard changes backed by evidence
- next highest-priority gap

The final Phase 1 report must distinguish verified evidence from assumptions and must score only the latest merged `main` state.
