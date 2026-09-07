# Security Hardening Waves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove current high/critical dependency findings across frontend and Rust ecosystems without weakening verification or forcing unsafe upgrades.

**Architecture:** Split remediation by ecosystem and advisory root cause. Capture the failing audit output first, update only the dependency family responsible, run the ecosystem’s functional gates, then require the Security workflow to go green before merging each wave.

**Tech Stack:** npm/Node 20, Rust 1.97.1/Cargo, Trivy, cargo-audit, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-07-platform-hardening-usaha-simplification-design.md`

## Global Constraints

- Do not use `npm audit fix --force`.
- Do not add audit ignore/suppress rules merely to turn CI green.
- Preserve JWT issuer, audience, expiry, and signature verification.
- Preserve Phoenix/OTP structure; Chat dependency work is isolated from Rust/frontend changes.
- Every dependency change must include its lockfile and fresh functional verification.

---

### Task 1: Capture exact current security failures

**Files:**
- Read: `.github/workflows/security.yml`
- Read: affected `package.json`/`package-lock.json`, `Cargo.toml`/`Cargo.lock`, and `mix.exs`/`mix.lock` only after a failing audit identifies them.

**Interfaces:**
- Consumes: Security workflow failures.
- Produces: exact advisory package, installed version, patched version/range, and owning direct dependency for each failure.

- [ ] Re-run/fetch `npm production dependency audit`, `Cargo audit / identity_service`, `Cargo audit / marketplace_service`, and `Trivy repository scan` logs.
- [ ] Record each advisory ID and the dependency path that introduced it.
- [ ] Classify each finding as frontend, Rust, Chat/Elixir, Python, or repository/container finding.

### Task 2: Frontend production dependency remediation

**Files:**
- Modify only the affected app/package `package.json` and `package-lock.json` discovered in Task 1.

**Interfaces:**
- Consumes: exact npm advisory paths.
- Produces: compatible patched dependency graph with unchanged application contracts.

- [ ] On an isolated branch from current `main`, run `npm audit --omit=dev --audit-level=high` in each affected frontend directory and preserve the RED output.
- [ ] Apply the smallest non-forced direct dependency bump or lockfile refresh that resolves the advisory.
- [ ] Run `npm ci`, `npm run lint`, `npm run test --if-present`, and `npm run build` for each changed app.
- [ ] Run `npm audit --omit=dev --audit-level=high` again; expected PASS.
- [ ] Commit package manifest and lockfile together.

### Task 3: Rust/JWT dependency remediation

**Files:**
- Modify only affected `services/*/Cargo.toml` and `services/*/Cargo.lock` discovered in Task 1.

**Interfaces:**
- Consumes: exact Cargo advisory dependency chains.
- Produces: patched locked dependency graph while retaining strict JWT verification semantics.

- [ ] Preserve RED with `cargo audit` in each affected service.
- [ ] Update the owning direct dependency or compatible transitive lock entry; retain the repository’s intended crypto backend features.
- [ ] Run `cargo fmt --check`.
- [ ] Run `cargo clippy --locked --all-targets -- -D warnings`.
- [ ] Run `cargo test --locked`.
- [ ] Run `cargo audit`; expected PASS for the addressed advisory family.
- [ ] Commit manifest and lockfile together.

### Task 4: Chat/Elixir advisory remediation when present in Trivy/Hex evidence

**Files:**
- Modify: `services/chat_service/mix.exs`
- Modify: `services/chat_service/mix.lock`

**Interfaces:**
- Consumes: exact vulnerable Hex packages discovered by audit evidence.
- Produces: compatible patched Phoenix/Guardian/Cowboy/Plug dependency graph.

- [ ] Run `mix hex.audit` and preserve RED when advisories are present.
- [ ] Update only direct dependency constraints required to reach patched releases and run `mix deps.update <package...>`.
- [ ] Run `mix format --check-formatted`.
- [ ] Run `MIX_ENV=test mix test --no-start`.
- [ ] Run `mix hex.audit`; expected PASS for addressed advisories.
- [ ] Commit `mix.exs` and `mix.lock` together.

### Task 5: Repository/Trivy closure

**Files:**
- Depends on exact Trivy finding paths from Task 1.

**Interfaces:**
- Consumes: ecosystem-specific fixes.
- Produces: no remaining HIGH/CRITICAL fixed vulnerabilities in the tracked repository tree.

- [ ] Re-run the Security workflow.
- [ ] Require Secret scan PASS.
- [ ] Require npm production dependency audit PASS.
- [ ] Require all Cargo audit matrix jobs PASS.
- [ ] Require Python audit matrix jobs PASS.
- [ ] Require Trivy repository scan PASS or, if it still fails, trace the exact remaining package/file and open the next isolated remediation branch rather than suppressing it.

## Self-review

- Spec coverage: frontend, Rust/JWT, Chat/Elixir, and Trivy closure are separated and evidence-driven.
- Placeholder scan: all decisions are driven by exact audit evidence; no unspecified forced upgrade is permitted.
- Type consistency: dependency changes remain ecosystem-local and lockfiles move with manifests.