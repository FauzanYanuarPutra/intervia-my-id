# Runtime Configuration Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WWW auth, Redis rate limiting, Google OAuth, Caddy, and optional Cloudflare Tunnel configuration explicit, secure, testable, and reliable through the canonical launchers.

**Architecture:** Keep environment files as operator-owned inputs and pass a least-privilege runtime allowlist through Compose. Add a cross-platform preflight validator for conditional configuration, separate development and production edge behavior, and gate optional tunnel startup on an observed registered connection.

**Tech Stack:** Docker Compose, PowerShell, POSIX shell, Python 3 standard library, Next.js, Redis, Caddy, Cloudflare Tunnel

**Spec:** `docs/architecture/runtime-configuration-integration.md`

## Global Constraints

- Preserve existing URLs and auth response contracts.
- Rate limiting remains fail-closed.
- Never print or commit real credentials.
- `.env.v1.development` is recovery/reference input only and is never loaded.
- Existing database volumes and application data are not modified by this work.

---

### Task 1: Executable runtime configuration contract

**Files:**
- Create: `scripts/config/runtime_contract.py`
- Create: `scripts/ci/tests/test_runtime_contract.py`
- Modify: `up.ps1`
- Modify: `up.sh`

**Interfaces:**
- Consumes: canonical env path, environment name, requested profiles, merged Compose JSON
- Produces: exit code `0` for a valid contract and a redacted actionable error for an invalid contract

- [ ] **Step 1: Write failing tests for partial Google configuration, missing WWW Redis, unsafe Redis localhost, and tunnel-without-token.**
- [ ] **Step 2: Run `python -m unittest scripts.ci.tests.test_runtime_contract -v` and confirm failures identify missing validation.**
- [ ] **Step 3: Implement the standard-library validator without logging values.**
- [ ] **Step 4: Run the unit tests and confirm they pass.**
- [ ] **Step 5: Invoke the validator from both launchers before `docker compose up`.**

### Task 2: WWW auth and Redis wiring

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `.env.development.example`
- Modify: `.env.staging.example`
- Modify: `.env.production.example`
- Test: `scripts/ci/tests/test_runtime_contract.py`

**Interfaces:**
- Consumes: `REDIS_PASS`, Google OAuth tuple, auth toggles and rate limits
- Produces: server-only WWW runtime env and Redis health dependency

- [ ] **Step 1: Add an integration test that renders the development Compose model and expects authenticated WWW Redis wiring plus the Google env keys.**
- [ ] **Step 2: Run the test and confirm it fails against the current model.**
- [ ] **Step 3: Add the minimal explicit WWW environment allowlist and Redis health dependency.**
- [ ] **Step 4: Keep Google optional but provide environment-specific redirect defaults and sanitized examples.**
- [ ] **Step 5: Re-run unit and Compose contract tests.**
- [ ] **Step 6: Recreate WWW and verify login no longer returns the rate-limit-service 503.**

### Task 3: Caddy profile and protocol boundaries

**Files:**
- Modify: `docker-compose.dev.yml`
- Modify: `infrastructure/caddy/Caddyfile`
- Modify: `infrastructure/caddy/Caddyfile.prod`
- Test: `scripts/ci/tests/test_runtime_contract.py`

**Interfaces:**
- Consumes: `APP_DOMAIN`, core WWW service, optional backoffice services in deployment overlays
- Produces: independently resolvable development `edge` profile and HTTPS production edge

- [ ] **Step 1: Add a test that executes `docker compose --profile edge config` and expects success without `backoffice`.**
- [ ] **Step 2: Run it and confirm the current undefined-profile dependency failure.**
- [ ] **Step 3: Override development Caddy dependencies to core services only and remove HSTS from HTTP development sites.**
- [ ] **Step 4: Validate both Caddyfiles with the pinned Caddy container.**
- [ ] **Step 5: Start the edge profile and probe the WWW route through Caddy.**

### Task 4: Optional Cloudflare Tunnel integration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `.env.development.example`
- Modify: `.env.staging.example`
- Modify: `.env.production.example`
- Modify: `up.ps1`
- Modify: `up.sh`
- Test: `scripts/ci/tests/test_runtime_contract.py`

**Interfaces:**
- Consumes: newly issued `CLOUDFLARE_TUNNEL_TOKEN` only when profile `tunnel` is requested
- Produces: `cloudflared` process connected to Caddy and launcher readiness evidence

- [ ] **Step 1: Add tests proving default Compose excludes tunnel and the tunnel profile requires a token.**
- [ ] **Step 2: Run tests and confirm failure before the service exists.**
- [ ] **Step 3: Add a pinned configurable cloudflared image under the `tunnel` profile with Caddy dependency.**
- [ ] **Step 4: Add bounded launcher readiness checks for `Registered tunnel connection`.**
- [ ] **Step 5: Validate default and tunnel Compose models without exposing the token.**

### Task 5: Full verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/runtime-configuration-integration.md`

**Interfaces:**
- Consumes: completed runtime contract
- Produces: operator commands for direct local, local edge, and optional tunnel modes

- [ ] **Step 1: Document canonical env ownership, Google redirect registration, edge commands, tunnel commands, and secret rotation requirement.**
- [ ] **Step 2: Run Python tests, frontend auth tests, Compose validation for development/staging/production, repository hygiene, and Caddy validation.**
- [ ] **Step 3: Run `./up` without destructive flags and inspect container health/restart state.**
- [ ] **Step 4: Probe WWW, identity, marketplace, community, chat, login rate limiting, MailHog, and optional edge endpoints.**
- [ ] **Step 5: Review `git diff` for secret leakage and unrelated changes.**
