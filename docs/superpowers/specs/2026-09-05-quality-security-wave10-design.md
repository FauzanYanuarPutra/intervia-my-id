# Quality & Security Stabilization Wave 10 Design

## Goal
Turn the repository's currently known red quality/security signals into a controlled stabilization wave without mixing in new product features.

Wave 10 focuses on four concrete classes of debt already exposed by GitHub Actions:
1. `marketplace_service` formatting failure;
2. `community_service` Clippy failure;
3. `chat_service` Elixir formatting failure;
4. frontend dependency/security advisories and Linux optional-native dependency instability.

The objective is not to make arbitrary broad rewrites. The objective is to reduce known CI noise, remove verified security debt safely, and leave a clearer quality baseline for later Search Intelligence work.

## Product / Repository Principle
A fast-moving monorepo becomes harder to improve when known unrelated failures are allowed to remain permanently red. Wave 10 therefore separates product delivery from maintenance debt by fixing only evidence-backed failures and validating each subsystem independently.

No dependency upgrade, formatter rewrite, or warning cleanup is justified merely because it is available. Every production change must correspond to an observed failure, a verified advisory, or a reproducible runtime/build issue.

## Scope

### 1. Rust: `marketplace_service` Formatting
Use the current repository toolchain and `cargo fmt --check` output as the source of truth.

Required behavior:
- run formatting only on files reported by rustfmt;
- avoid semantic changes while fixing format drift;
- rerun `cargo fmt --check` afterward;
- if formatting reveals a separate compile/clippy/test failure, classify that separately rather than silently expanding the change.

### 2. Rust: `community_service` Clippy
Investigate the exact `cargo clippy --locked --all-targets -- -D warnings` failures before editing.

Required behavior:
- fix root causes, not suppress warnings globally;
- avoid adding crate-level blanket `allow` attributes unless the specific warning is proven intentional and narrowly scoped;
- preserve API and data behavior unless a correctness bug is discovered;
- rerun format, Clippy, and tests for `community_service` after each focused fix set.

### 3. Elixir: `chat_service` Formatting
Use `mix format --check-formatted` to identify drift.

Required behavior:
- apply formatter-compatible changes only for formatting debt;
- avoid chat behavior changes in the formatting-only portion;
- rerun `mix format --check-formatted` and `mix test` afterward;
- any real chat test failure becomes a separate root-cause debugging task.

### 4. Frontend Security Advisories
The Security workflow previously reported multiple dependency advisories across frontend workspaces, including high-severity advisories in packages such as Next.js, postcss, nanoid, tar, brace-expansion/braces, serialize-javascript, and others.

Required process:
- collect fresh `npm audit` evidence per affected workspace before changing versions;
- map each advisory to direct vs transitive dependency ownership;
- prefer the smallest compatible upgrade that resolves the advisory;
- do not run blind `npm audit fix --force`;
- do not introduce major-version upgrades unless required by a high-severity advisory and compatibility is verified;
- regenerate lockfiles through npm on the owning workspace only;
- rerun unit tests, lint, and build after dependency changes;
- keep runtime behavior unchanged unless the upstream security fix necessarily changes API behavior.

### 5. Frontend Linux Native Optional Dependencies
Wave 9 revealed Linux CI instability when Windows-generated npm lock state omitted optional native packages required by `@parcel/watcher` and nested `@swc/core`.

Wave 10 should determine whether the current CI workaround should remain, be simplified, or be replaced by a lockfile/package-manager-level solution.

Required behavior:
- inspect current lockfile entries and the actual dependency tree;
- prefer a reproducible package-manager solution over accumulating CI-only `npm install --no-save` workarounds;
- preserve Docker/runtime builds already proven green;
- if a durable lockfile fix cannot be produced safely in this wave, retain the minimal CI guard and document why.

### 6. Security Workflow Hygiene
Do not weaken security gates simply to make CI green.

Wave 10 must not:
- lower audit severity thresholds merely to pass;
- disable Clippy warnings globally;
- skip tests for failing services;
- remove lockfile integrity checks;
- mask failures with `|| true` except existing diagnostic-only steps;
- suppress known advisories without a documented accepted-risk decision.

## Investigation Order
To minimize unrelated churn, execute in this order:

1. establish fresh baseline from current `main`/Wave 10 branch;
2. fix formatter-only failures (`marketplace_service`, `chat_service`);
3. fix `community_service` Clippy findings one root cause at a time;
4. inspect frontend audit results and dependency graph;
5. resolve high-severity advisories with compatible upgrades;
6. validate Linux optional-native dependency behavior;
7. rerun focused service/frontend gates;
8. rerun repository-level GitHub workflows;
9. document anything remaining as explicit debt rather than hidden red noise.

## Testing Strategy

### Marketplace
- `cargo fmt --check`
- if touched semantically for an unexpected reason: `cargo clippy --locked --all-targets -- -D warnings` and `cargo test --locked`

### Community
- `cargo fmt --check`
- `cargo clippy --locked --all-targets -- -D warnings`
- `cargo test --locked`

### Chat
- `mix format --check-formatted`
- `MIX_ENV=test mix test`

### Frontend workspaces touched by dependency changes
- `npm ci --legacy-peer-deps --no-audit --no-fund`
- `npm run lint --if-present`
- `npm run test:unit --if-present`
- `npm run test --if-present`
- `npm run build --if-present`
- fresh `npm audit` evidence for the affected workspace

### Repository / runtime
- `python scripts/ci/check_repository_hygiene.py`
- existing GitHub Quality Gates
- Security workflow
- Frontend Runtime Gate
- KYC Runtime Contract
- Usaha Business OS Gate

No completion claim is valid without fresh evidence from the relevant commands/workflows.

## Change Boundaries
Wave 10 must not intentionally change:
- marketplace search ranking or Search Intelligence algorithms;
- public SEO copy or Explore UX;
- authentication architecture;
- chat routing or realtime protocol;
- payments, escrow, orders, or transaction flows;
- database schema;
- `/umkm` routing/behavior;
- KYC model/runtime architecture;
- product taxonomy or listing semantics.

If a quality/security fix requires one of these changes, stop and elevate it into a separate design rather than hiding it inside Wave 10.

## Expected Outcome
After Wave 10, repository-level failures should be materially reduced and the remaining red signals, if any, should be specific and explainable rather than permanent background noise.

The desired end state is:
- formatter checks clean for the targeted Rust/Elixir services;
- `community_service` Clippy clean;
- high-severity frontend advisories reduced or resolved where compatible fixes exist;
- frontend Linux CI dependency installation reproducible;
- runtime gates remain green;
- no security or quality gate is weakened to manufacture success.

This establishes the maintenance baseline needed before Wave 11 returns to backend Search Intelligence and relevance work.