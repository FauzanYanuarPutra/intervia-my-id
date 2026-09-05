# Quality & Security Stabilization Wave 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known evidence-backed quality/security failures currently keeping the monorepo noisy while preserving product behavior.

**Architecture:** Treat each failing subsystem as an independent stabilization unit: formatter-only fixes first, then root-cause Clippy cleanup, then dependency/security remediation, followed by repository/runtime verification. Do not weaken gates or mix product feature work into this wave.

**Tech Stack:** Rust/Cargo/rustfmt/Clippy, Elixir/Mix, Node.js/npm/Next.js, GitHub Actions, Docker Compose, Python repository hygiene checks.

**Spec:** `docs/superpowers/specs/2026-09-05-quality-security-wave10-design.md`

## Global Constraints

- Do not intentionally change marketplace search ranking, public SEO/Explore UX, auth architecture, chat routing/realtime protocol, payments, DB schema, `/umkm`, KYC architecture, taxonomy, or listing semantics.
- Do not run blind `npm audit fix --force`.
- Do not lower security severity thresholds, add blanket warning suppressions, skip failing tests, or mask failures with `|| true`.
- Every production fix must map to an observed formatter/Clippy/test/build/audit failure.
- Completion requires fresh verification evidence.

---

### Task 1: Establish Wave 10 CI Baseline

**Files:**
- Read: `.github/workflows/quality.yml`
- Read: `.github/workflows/security.yml` or the actual Security workflow path discovered from `.github/workflows/`
- Read: `services/marketplace_service/Cargo.toml`
- Read: `services/community_service/Cargo.toml`
- Read: `services/chat_service/mix.exs`
- Read: `frontend/apps/*/package.json`

**Interfaces:**
- Consumes: current `main` merged through Wave 9.
- Produces: exact failing commands/jobs and logs used as evidence for Tasks 2–5.

- [ ] **Step 1: Trigger/observe the Wave 10 branch workflows without code changes beyond docs**

Use GitHub Actions runs for the branch/PR as the remote Linux baseline. Record exact failed job IDs.

- [ ] **Step 2: Fetch logs for each targeted failure**

Capture the exact rustfmt diff, Clippy diagnostics, Mix formatter output, and npm audit advisories before editing.

- [ ] **Step 3: Confirm scope against the spec**

If a failure requires product behavior changes or DB/API architecture changes, stop that item and move it out of Wave 10 rather than expanding scope.

---

### Task 2: Repair Formatter-Only Drift

**Files:**
- Modify: only `services/marketplace_service/**/*.rs` files identified by `cargo fmt --check`
- Modify: only `services/chat_service/**/*.{ex,exs}` files identified by `mix format --check-formatted`

**Interfaces:**
- Consumes: exact formatter output from Task 1.
- Produces: formatter-clean marketplace and chat source with no intentional semantic changes.

- [ ] **Step 1: Apply rustfmt-equivalent output only to reported marketplace files**

Do not hand-refactor surrounding code. The resulting content must match the repository's pinned formatter.

- [ ] **Step 2: Verify marketplace formatting**

Run in `services/marketplace_service`:

```bash
cargo fmt --check
```

Expected: exit 0.

- [ ] **Step 3: Apply Mix formatter-equivalent output only to reported chat files**

Do not change chat behavior in this step.

- [ ] **Step 4: Verify chat formatting and tests**

Run in `services/chat_service`:

```bash
mix format --check-formatted
MIX_ENV=test mix test
```

Expected: both exit 0. If tests fail independently, debug the actual failure before claiming Task 2 complete.

- [ ] **Step 5: Commit formatter stabilization**

```bash
git add services/marketplace_service services/chat_service
git commit -m "style: restore rust and elixir format gates"
```

---

### Task 3: Repair `community_service` Clippy Findings

**Files:**
- Modify: only `services/community_service/**/*.rs` files named by fresh Clippy diagnostics
- Test: existing `services/community_service` tests

**Interfaces:**
- Consumes: exact Clippy warnings from Task 1.
- Produces: community service that is format-, Clippy-, and test-clean under the pinned toolchain.

- [ ] **Step 1: Run the exact failing command**

```bash
cd services/community_service
cargo clippy --locked --all-targets -- -D warnings
```

Expected before fixes: reproduce the CI warning(s).

- [ ] **Step 2: Fix the first root cause narrowly**

Prefer idiomatic code changes suggested by Clippy when behavior is equivalent. Do not add crate-level `#![allow(...)]`.

- [ ] **Step 3: Re-run Clippy after each focused fix set**

```bash
cargo clippy --locked --all-targets -- -D warnings
```

Expected: no remaining warnings before moving on.

- [ ] **Step 4: Run format and tests**

```bash
cargo fmt --check
cargo test --locked
```

Expected: both exit 0.

- [ ] **Step 5: Commit community stabilization**

```bash
git add services/community_service
git commit -m "fix: clear community service clippy gate"
```

---

### Task 4: Audit Frontend Dependency Security

**Files:**
- Read/Modify as evidence requires: `frontend/apps/www/package.json`
- Read/Modify as evidence requires: `frontend/apps/www/package-lock.json`
- Read/Modify as evidence requires: `frontend/apps/usaha/package.json`
- Read/Modify as evidence requires: `frontend/apps/usaha/package-lock.json`
- Read/Modify as evidence requires: `frontend/apps/cms/package.json`
- Read/Modify as evidence requires: `frontend/apps/cms/package-lock.json`
- Read/Modify as evidence requires: `frontend/apps/crm/package.json`
- Read/Modify as evidence requires: `frontend/apps/crm/package-lock.json`

**Interfaces:**
- Consumes: fresh Security workflow/npm audit evidence.
- Produces: minimal compatible dependency/lockfile updates resolving the highest actionable advisories without broad framework churn.

- [ ] **Step 1: Collect fresh audit JSON/text per workspace**

For each existing app directory:

```bash
npm audit --omit=dev
```

Record package, severity, dependency path, patched range, and whether the vulnerable package is direct or transitive.

- [ ] **Step 2: Group advisories by owning direct dependency**

For example, an advisory inside Next.js should be resolved by a compatible patched Next.js release rather than manually pinning an unrelated nested package unless npm's dependency graph requires it.

- [ ] **Step 3: Upgrade only the minimum compatible owning dependencies**

Do not use `npm audit fix --force`. Preserve the current major version unless the advisory has no patched release in that major and a major upgrade has been separately assessed as compatible.

- [ ] **Step 4: Regenerate each touched workspace lockfile with npm**

Use the workspace's normal npm install flow so package.json and package-lock.json stay consistent.

- [ ] **Step 5: Verify every touched workspace**

```bash
npm ci --legacy-peer-deps --no-audit --no-fund
npm run lint --if-present
npm run test:unit --if-present
npm run test --if-present
npm run build --if-present
npm audit --omit=dev
```

Expected: tests/build remain green and targeted high-severity advisories are removed or explicitly documented if no compatible patched version exists.

- [ ] **Step 6: Commit dependency remediation**

```bash
git add frontend/apps/*/package.json frontend/apps/*/package-lock.json
git commit -m "fix: remediate actionable frontend dependency advisories"
```

---

### Task 5: Make Linux Native Dependency Installation Reproducible

**Files:**
- Modify if needed: `.github/workflows/quality.yml`
- Modify if needed: affected frontend `package-lock.json`

**Interfaces:**
- Consumes: Wave 9 Parcel/SWC CI workaround and dependency tree after Task 4.
- Produces: reproducible Linux frontend install/build without an ever-growing list of guessed native packages.

- [ ] **Step 1: Inspect lockfile/dependency tree for Parcel and SWC native optionals**

Confirm whether the regenerated lockfile now includes the Linux packages required by `@parcel/watcher` and nested `@swc/core`.

- [ ] **Step 2: Prefer lockfile-native reproducibility**

If normal `npm ci` on Linux now installs required native optionals, remove redundant `npm install --no-save` guards from Quality Gates.

If the Windows lockfile behavior still omits them, retain the smallest exact-version guard and document the npm/lockfile reason in workflow comments.

- [ ] **Step 3: Verify www install/tests/build on Linux CI**

Expected: no missing Parcel or SWC native binding; `npm run build` exits 0.

- [ ] **Step 4: Commit CI reproducibility changes if any**

```bash
git add .github/workflows/quality.yml frontend/apps/www/package-lock.json
git commit -m "ci: stabilize cross-platform frontend native dependencies"
```

---

### Task 6: Repository-Level Verification and PR

**Files:**
- Modify only if verification exposes an in-scope root cause.
- Update: Wave 10 PR body with exact evidence and any remaining accepted debt.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: reviewable Wave 10 PR with evidence-backed status.

- [ ] **Step 1: Run repository hygiene**

```bash
python scripts/ci/check_repository_hygiene.py
```

Expected: exit 0.

- [ ] **Step 2: Observe fresh GitHub Actions**

Required evidence:
- Quality Gates;
- Security;
- Frontend Runtime Gate;
- KYC Runtime Contract;
- Usaha Business OS Gate.

- [ ] **Step 3: Investigate any remaining failure**

Use the exact job logs. Fix only if the root cause is within Wave 10 scope; otherwise document it explicitly.

- [ ] **Step 4: Review the PR diff for accidental product changes**

Confirm no search-ranking, public UX, auth, payments, schema, `/umkm`, KYC, taxonomy, or listing-semantics changes slipped in.

- [ ] **Step 5: Mark ready and merge only with fresh evidence**

Do not claim all gates green unless GitHub Actions actually reports success. If repository rules permit merge while an unrelated documented gate remains red, state that explicitly before merging.

- [ ] **Step 6: Post-merge user command**

User stays on `main` and runs only:

```powershell
cd D:\LAJUKAN\intervia-my-id
git checkout main
git pull origin main
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```
