# Frontend Runtime CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pull requests prove that WWW, Usaha, CMS, and CRM can build from their real Dockerfiles before merge, while fixing the current `lajukan-ui` package-resolution failure.

**Architecture:** Keep lint/quality debt separate from deployability. A fast contract check validates local package/i18n invariants, then a Docker Buildx matrix builds each frontend independently using the same `frontend` context and Dockerfiles used by Compose. A final stable `Frontend runtime gate` job aggregates the matrix for branch-protection/ruleset use.

**Tech Stack:** GitHub Actions, Docker Buildx, Next.js 16, Node.js 20, TypeScript, local `file:` package `lajukan-ui`.

**Spec:** Runtime behavior observed in `Pasted text(20260822-154906).txt` and the current repository contracts on `main`.

## Global Constraints

- Base all changes on the latest `main` before writing.
- Do not weaken Next.js TypeScript build errors.
- Do not make runtime CI depend on the existing WWW lint backlog.
- `lajukan-ui` consumers must resolve the package through its declared `exports`/`dist`, not source `.ts` under `node_modules`.
- Build all four web frontends independently with `fail-fast: false`.
- Do not push production images from pull-request validation.

---

### Task 1: Repair shared UI package resolution

**Files:**
- Modify: `frontend/apps/cms/tsconfig.json`
- Modify: `frontend/apps/crm/tsconfig.json`

**Interfaces:**
- Consumes: `lajukan-ui` package metadata (`main`, `types`, `exports`) and Docker-built `/app/packages/dist`.
- Produces: standard Node/bundler resolution of `lajukan-ui` to `dist/index.js` and `dist/index.d.ts`.

- [ ] **Step 1:** Remove the `paths.lajukan-ui = node_modules/lajukan-ui/index.ts` overrides from CMS and CRM.
- [ ] **Step 2:** Preserve the remaining app aliases and strict TypeScript settings unchanged.
- [ ] **Step 3:** Verify the branch diff no longer directs `lajukan-ui` to a `.ts` source entry.

### Task 2: Add a fast frontend runtime contract check

**Files:**
- Create: `scripts/ci/check_frontend_runtime_contract.py`

**Interfaces:**
- Consumes: frontend package manifests, tsconfigs, Next configs, and i18n request files.
- Produces: exit code 0 only when runtime invariants are satisfied.

- [ ] **Step 1:** Check `www`, `usaha`, `cms`, and `crm` package manifests exist.
- [ ] **Step 2:** For apps using `next-intl/plugin`, require `src/i18n/request.ts`.
- [ ] **Step 3:** Reject any TypeScript path mapping that resolves `lajukan-ui` to `.ts`/`.tsx` source under `node_modules`.
- [ ] **Step 4:** Require `frontend/packages/package.json` to export `.` to `./dist/index.js` and types to `./dist/index.d.ts`.
- [ ] **Step 5:** Run the script in CI before expensive Docker builds.

### Task 3: Add pull-request Docker build gate

**Files:**
- Create: `.github/workflows/frontend-runtime-gate.yml`

**Interfaces:**
- Consumes: the exact Dockerfiles under `frontend/apps/{www,usaha,cms,crm}/Dockerfile` with context `frontend`.
- Produces: per-app Docker build checks plus one stable aggregate `Frontend runtime gate` status.

- [ ] **Step 1:** Trigger for PRs to `main`, pushes to `main`, and manual dispatch when frontend/runtime files change.
- [ ] **Step 2:** Run the fast contract check.
- [ ] **Step 3:** Build a matrix of `www`, `usaha`, `cms`, and `crm` with Docker Buildx, `push: false`, GHA cache, and `fail-fast: false`.
- [ ] **Step 4:** Aggregate matrix results into a stable `Frontend runtime gate` job that fails unless contract and all Docker builds pass.
- [ ] **Step 5:** Keep this gate independent from existing Quality Gates so WWW lint debt cannot prevent runtime-build evidence.

### Task 4: Verify through GitHub Actions

**Files:**
- No additional production files unless a concrete CI failure identifies another root cause.

**Interfaces:**
- Consumes: pull-request workflow runs and job logs.
- Produces: evidence for each frontend Docker build and the aggregate gate.

- [ ] **Step 1:** Open a pull request from `fix/frontend-ci-runtime-gate-20260822` to `main`.
- [ ] **Step 2:** Inspect every frontend runtime workflow job.
- [ ] **Step 3:** If any Docker build fails, debug that exact failure before changing code.
- [ ] **Step 4:** Do not merge or claim completion until the new runtime gate reports success.
