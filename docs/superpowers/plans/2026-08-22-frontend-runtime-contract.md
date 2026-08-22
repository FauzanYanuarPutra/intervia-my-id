# Frontend Runtime Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize `www`, `usaha`, `cms`, and `crm` on one production-grade Next.js Docker/runtime contract and make Compose/Caddy/CI/deploy prove all required web surfaces are healthy.

**Architecture:** Keep one Dockerfile per app, but make all Next apps use monorepo-aware standalone output, built shared packages, explicit public build args, lightweight `/api/health`, and direct standalone `server.js` startup. Keep `usaha` in the default development product stack; keep `cms`/`crm` optional under `backoffice`; route all four through Caddy when edge mode is enabled.

**Tech Stack:** Next.js 16, React 19, Node.js 20, Docker Compose, Caddy 2, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-22-frontend-runtime-contract-design.md`

## Global Constraints

- Node base image remains `node:20-bullseye-slim`.
- No UI or business-logic changes.
- No secrets in Docker build args.
- CMS/CRM remain `noindex`.
- Caddy remains the only published production edge.
- Health routes prove frontend process health only; they do not depend on downstream services.
- Flutter mobile is out of scope.

---

### Task 1: Standardize Next.js standalone configuration

**Files:**
- Modify: `frontend/apps/usaha/next.config.mjs`
- Modify: `frontend/apps/cms/next.config.mjs`
- Modify: `frontend/apps/crm/next.config.mjs`

**Interfaces:**
- Produces standalone output rooted at `frontend/` for each app.

- [ ] Add `outputFileTracingRoot: path.resolve(configDir, '../..')` to Usaha.
- [ ] Add `fileURLToPath`, `configDir`, `output: 'standalone'`, and monorepo tracing root to CMS/CRM.
- [ ] Preserve all existing CSP, headers, webpack aliases, and redirects.
- [ ] Verify each config is valid ESM and references existing imports.

### Task 2: Standardize Docker build/runtime contract

**Files:**
- Modify: `frontend/apps/usaha/Dockerfile`
- Modify: `frontend/apps/cms/Dockerfile`
- Modify: `frontend/apps/crm/Dockerfile`

**Interfaces:**
- Produces `node .next/standalone/apps/<app>/server.js` runtime images on ports 3003/3001/3002.

- [ ] Make each deps stage copy/build `/app/packages` before the app install/build.
- [ ] Preserve npm retry, optional dependency, and SWC fallback behavior.
- [ ] Add app-specific public `ARG` + `ENV` values used during `next build`.
- [ ] Keep `lint`/`typecheck` stages only where scripts exist.
- [ ] Build with the existing app memory budget (Usaha 4096 MB, CMS/CRM 2048 MB).
- [ ] Copy `.next/static` and `public` into the app standalone tree.
- [ ] Validate `middleware-manifest.json`, standalone `server.js`, static, and public directories.
- [ ] Run the standalone server directly with `HOSTNAME=0.0.0.0`.

### Task 3: Add health and typecheck contracts

**Files:**
- Create: `frontend/apps/www/src/app/api/health/route.ts`
- Create: `frontend/apps/cms/src/app/api/health/route.ts`
- Create: `frontend/apps/crm/src/app/api/health/route.ts`
- Modify: `frontend/apps/cms/package.json`
- Modify: `frontend/apps/crm/package.json`

**Interfaces:**
- `GET /api/health` returns HTTP 200 and `{ ok: true, service: '<app>' }`.
- CMS/CRM expose `npm run typecheck`.

- [ ] Add the three health routes matching the existing Usaha route shape.
- [ ] Add `typecheck: "tsc --noEmit -p tsconfig.json"` to CMS/CRM.
- [ ] Do not add fake test scripts.

### Task 4: Wire Docker Compose runtime contracts

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

**Interfaces:**
- All four frontend services have HTTP healthchecks.
- Usaha is default in development; CMS/CRM remain `backoffice`.
- Relevant `NEXT_PUBLIC_*` values reach Docker build args.

- [ ] Add build args to Usaha/CMS/CRM in base compose.
- [ ] Add healthchecks using Node built-in `fetch` to WWW/CMS/CRM/Usaha.
- [ ] Remove `profiles: [backoffice]` from development Usaha only.
- [ ] Keep CMS/CRM under `backoffice`.
- [ ] Preserve loopback-only development host ports.

### Task 5: Complete development Caddy routing

**Files:**
- Modify: `infrastructure/caddy/Caddyfile`

**Interfaces:**
- `cms.<APP_DOMAIN>` proxies `cms:3001`.
- `crm.<APP_DOMAIN>` proxies `crm:3002`.

- [ ] Add CMS and CRM HTTP site blocks.
- [ ] Apply security headers consistent with internal apps.
- [ ] Enable gzip/zstd.
- [ ] Do not modify production domains or routes.

### Task 6: Expand runtime smoke and deployment health gates

**Files:**
- Modify: `scripts/ci/smoke_compose.sh`
- Modify: `.github/workflows/quality.yml`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Core smoke proves default Usaha health.
- Full-surface smoke runs `backoffice` + `edge` and probes all Caddy app routes.
- Production deploy probes Usaha/CMS/CRM before writing the successful release marker.

- [ ] Add direct Usaha health probe to the default smoke.
- [ ] Add a `full` smoke phase using `--profile backoffice --profile edge` and probe WWW/Usaha/CMS/CRM direct endpoints plus all four Caddy host routes with Host headers.
- [ ] Add a Quality job/step that runs full-surface smoke and captures diagnostics on failure.
- [ ] Add production `curl --resolve` probes for Usaha/CMS/CRM `/api/health`.
- [ ] Keep existing WWW/API/chat probes.

### Task 7: Verification

**Files:**
- No new source files.

- [ ] Validate branch diff has no UI/business logic changes.
- [ ] Validate Docker Compose development config for default, `backoffice`, and `edge` profiles.
- [ ] Validate production Compose still publishes only Caddy ports.
- [ ] Confirm all Dockerfiles target existing standalone paths.
- [ ] Confirm all four apps expose `/api/health` in source.
- [ ] Review branch diff and report any checks that require CI execution because the GitHub connector cannot run local Docker builds.
