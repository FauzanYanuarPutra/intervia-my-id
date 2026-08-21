# AGENTS.md — Lajukan engineering contract

This file defines repository-wide rules for coding agents and contributors. It is intentionally stricter than style guidance because it protects data, API compatibility, deployment safety and maintainability.

## 1. Read before changing code

Before editing a subsystem:

1. Inspect the latest repository state.
2. Read the relevant service/app entrypoint, configuration, migrations and tests.
3. Search all references to files/functions/routes that will move or be deleted.
4. Preserve externally observable contracts unless the task explicitly changes them.
5. Prefer a small verified extraction over a large speculative rewrite.

Do not infer current behavior only from folder names or documentation.

## 2. Repository boundaries

Primary code locations:

```text
frontend/apps/              deployable user-facing/internal apps
frontend/packages/          shared frontend code
services/identity_service/  identity/authentication/authorization ownership
services/marketplace_service/ marketplace/commerce/transaction ownership
services/community_service/ community/social ownership
services/chat_service/      realtime chat ownership
services/ai_service/        AI orchestration ownership
services/ocr_service/       OCR inference ownership
services/liveness_service/  liveness inference ownership
infrastructure/             deployment infrastructure, not business schema
scripts/                    CI/dev/ops automation
docs/                       durable human documentation
```

Do not create another top-level source tree for the same responsibility.

## 3. Service architecture

For Rust services:

- `main.rs` is bootstrap/composition only.
- Route modules parse/authorize/map requests.
- Service modules own business orchestration.
- Repository modules own database access.
- Domain state transitions and financial invariants must be explicit and testable.
- Infrastructure adapters are kept at the edge of the domain.

Do not move code into `utils`, `helpers`, `misc`, `common`, or `shared` merely to reduce file size. A module must have a clear owner and responsibility.

For Phoenix/Elixir, preserve native Phoenix/OTP structure. Do not force Rust-style folders onto Chat.

For Python inference services, keep modules small and direct: API/schema/service/model/security rather than enterprise layering.

## 4. Data ownership

- Identity owns identity data.
- Marketplace owns marketplace, transaction, payment and wallet data.
- Community owns community data.
- Chat owns its Scylla data.

A service MUST NOT query another service's database directly.

Cross-service data flows through:

- documented APIs, or
- events + local projections.

Postgres is the transactional source of truth. Search indexes are projections and must be rebuildable.

## 5. Database migrations

Never modify an already-applied migration only to make history look cleaner.

Rules:

- schema evolution -> versioned migration
- stable reference data -> explicit deterministic seed/reference process
- development/test fixture -> development/test seed
- database backup/dump -> outside Git

Business DDL must not be added to application startup.

Before destructive schema work:

1. inventory live data,
2. back up,
3. use expand/backfill/switch/verify/contract where applicable,
4. validate row counts and invariants,
5. preserve rollback/recovery options.

SQL/CQL files use LF line endings to keep migration hashes stable across platforms.

## 6. Authentication and authorization

Authentication success does not imply authorization.

Every sensitive object operation must check the actor's right to the specific object. Never trust a user-supplied owner/user/store/order ID without server-side authorization.

Do not weaken issuer/audience/expiry verification to fix authentication errors.

Do not log:

- authorization headers
- cookies/session values
- JWTs
- passwords
- OTPs
- raw identity documents
- NIK or other unnecessarily sensitive identity fields

## 7. Payments and wallet

Financial code requires stronger guarantees than ordinary CRUD.

Required properties include:

- database transaction boundaries
- idempotency for retries/webhooks
- unique provider transaction identifiers
- valid state transitions only
- settle/refund/withdraw exactly according to invariants
- no negative balances unless explicitly modelled
- duplicate webhook processing must be harmless

Production payment and wallet flags remain fail-closed until their operational runbook passes.

## 8. RabbitMQ and eventing

When a database write and event publication belong to one business operation, prefer transactional outbox semantics.

Consumers must be idempotent. Inbox/event IDs should prevent duplicate side effects.

Do not add Kafka or another broker without a demonstrated requirement that RabbitMQ cannot satisfy.

## 9. Frontend

The Next.js route tree owns routing/layout/composition. Reusable business UI belongs in feature modules.

Shared frontend code becomes a package only when at least two apps need the same semantics, not merely similar-looking code.

Preserve:

- route URLs
- response/request shapes
- locale behavior
- user-visible interaction semantics

unless the task explicitly changes them.

Do not expose private backend credentials through `NEXT_PUBLIC_*` variables.

## 10. Environment and secrets

Real secrets never belong in Git.

Tracked files may contain only examples/placeholders such as `.env.production.example`.

Application config should fail early when a production-required secret is absent. Development may use documented local-only defaults.

Do not embed machine-specific paths such as `D:/...` in committed cross-platform configuration.

## 11. Git hygiene

Do not track:

- `.runtime/`
- `.cache/`
- `.backups/`
- database dumps
- generated screenshots
- generated audit output
- build artifacts
- dependency directories
- user uploads
- local infrastructure volumes

`.gitignore` does not remove already-tracked files. Use an explicit index cleanup when required.

Do not rewrite Git history without an explicit backup/classification plan.

## 12. Docker and deployment

Development ports bind to loopback by default.

Production should publish host ports only through the edge proxy unless a documented operational requirement says otherwise.

Deploy application images by immutable commit-derived tag/digest. Do not deploy `latest`.

Do not introduce Kubernetes, service mesh, Kafka or another orchestration layer by default. Docker Compose remains the deployment model until scale/availability evidence requires a change.

## 13. Observability

Application logs go to stdout/stderr. Do not make each app manage its own production log files.

Use structured logs where possible and propagate request/correlation IDs.

New critical flows should expose useful metrics/traces without including secrets or sensitive payloads.

## 14. Testing expectations

Before considering a refactor complete, run the relevant subset of:

### Rust

```bash
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

### Next.js / Node

```bash
npm run lint
npm run test --if-present
npm run build
```

### Elixir

```bash
mix format --check-formatted
MIX_ENV=test mix test --no-start
```

### Python

```bash
python -m compileall -q .
pytest -q
```

### Repository / deployment

```bash
python scripts/ci/check_repository_hygiene.py
docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

A file move is not complete while old path references still exist in tracked source/configuration.

## 15. Safe refactor sequence

For large modules such as Marketplace or Community:

1. identify one coherent responsibility,
2. add characterization/regression tests when needed,
3. move code without changing behavior,
4. compile/test,
5. remove old definitions,
6. search stale references,
7. only then continue to the next module.

Do not generate dozens of empty architecture folders in advance.

## 16. Deletion rules

A suspicious/legacy file is not automatically safe to delete.

Before deletion:

- search imports/references,
- compare behavior when it is an alternate implementation,
- prove required behavior exists elsewhere,
- preserve recoverability through Git history or an explicit external backup.

This rule especially applies to old service entrypoints, migrations, deployment scripts and recovery artifacts.

## 17. Definition of Done

A change is done when:

- implementation is complete,
- tests/checks for the affected scope pass,
- stale tracked references are removed,
- docs/config are updated when the contract changed,
- no secrets/runtime artifacts were introduced,
- rollback or recovery is understood for risky changes.
