# Architecture Modernization Decisions

Status: active plan, based on repository audit and primary-source review on 2026-08-22.

## Decisions already applied

1. Keep the current service ownership boundaries. Do not add Kafka, Kubernetes, a service mesh, or more microservices without measured need.
2. Keep Next.js as a same-origin BFF and keep all AI provider selection inside `ai_service`.
3. Make the AI orchestrator core while keeping local Ollama and KYC runtimes optional profiles.
4. Use explicit readiness checks and immutable-release rollback gates.
5. Keep financial and KYC features fail-closed.
6. Keep SQLx; do not perform a blanket ORM rewrite.

## SQL and ORM decision

SQLx is intentionally retained. It maps rows to Rust types, uses prepared statements, supports explicit transactions, and offers compile-time checked `query!` and `query_as!` macros. A broad ORM migration would add query-generation behavior and migration risk without evidence that it improves latency or safety.

The target data-access structure is:

```text
route -> application service -> domain policy/state transition -> repository -> SQLx/Postgres
```

Rules for incremental conversion:

- Move SQL out of route/bootstrap modules one coherent domain at a time.
- Prefer `query!`, `query_as!`, and checked offline metadata for stable queries.
- Keep `QueryBuilder` only where filters are genuinely dynamic, with values bound as parameters.
- Keep financial state transitions and outbox writes in the same explicit transaction.
- Add indexes only from observed query shapes and validate them with representative `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- Never hide cross-service database access behind an ORM relation.

## Ordered refactor slices

| Order | Slice | Completion evidence |
| --- | --- | --- |
| 1 | Release contracts: AI/KYC env, dependency imports, health/readiness, TLS, rollback | Compose contract, Rust/Python checks, deployment probes |
| 2 | Remove startup business DDL after proving every statement exists in versioned migrations | clean boot against a migrated database; no DDL in service startup |
| 3 | Marketplace: extract content/discovery repository and service | route characterization tests + Rust checks |
| 4 | Marketplace: extract orders/wallet/payment invariants | transaction/idempotency/state-transition tests |
| 5 | Community: extract forum, groups, reels repositories/services | authorization and moderation tests |
| 6 | WWW: split largest client components into feature islands and server-fed sections | unit/E2E tests plus bundle and Web Vitals comparison |
| 7 | Tighten CSP using a nonce design only after measuring the dynamic-rendering cost | CSP report-only evidence and production-compatible E2E |

Do not combine these into a single rewrite. Each slice must compile, preserve public contracts, remove stale references, and have a reversible commit.

## Known validation debt

- The isolated `www_test` Docker target passes all 514 unit/integration tests. The separate `www_lint` target still reports 50 existing errors plus warnings, concentrated in oversized legacy UI modules and stricter React/TypeScript rules. These must be fixed by feature slice rather than hidden with global rule suppression.
- Liveness remains deliberately unavailable until reviewed model assets are supplied through the read-only `LIVENESS_MODELS_PATH` mount; `/ready` returns 503 without them.
- Test-only copies of the former startup DDL remain as migration characterization material. Delete each copy only after its service has a clean migrated-database boot test proving equivalent schema coverage.

## Performance method

- Establish p50/p95/p99 API latency, error rate, database time, slow-query samples, bundle size, LCP, INP, and CLS before optimization.
- Use PostgreSQL query plans rather than guessing that an index or ORM is faster.
- Bound database pools and outbound concurrency from measured capacity.
- Cache only data with explicit freshness and invalidation semantics.
- Keep search as a rebuildable projection and avoid dual-write assumptions.

## Security method

- Treat object-level authorization as a testable policy in every sensitive object route.
- Add negative tests proving actor A cannot read or mutate actor B's objects.
- Validate request body size, media type, decoded image size, URL origin, timeouts, and concurrency at inference boundaries.
- Prefer database constraints, unique idempotency keys, and transaction isolation over application-only checks.
- Add PostgreSQL row-level security only where role/session design can be made explicit and tested; table owners and `BYPASSRLS` roles otherwise bypass it.

## Primary references

- [SQLx crate and compile-time query macros](https://docs.rs/sqlx/latest/sqlx/)
- [SQLx transaction behavior](https://docs.rs/sqlx/latest/sqlx/struct.Transaction.html)
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Docker Compose dependency readiness](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker Compose profiles](https://docs.docker.com/compose/how-tos/profiles/)
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [OWASP API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
