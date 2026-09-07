# Cross-App Frontend QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove WWW, Usaha, CMS, and CRM behave as one coherent Lajukan product family after the redesign without regressing accessibility, performance, permissions, or production builds.

**Architecture:** Add cross-app contract checks only after the app waves have merged. Use existing app-native test stacks for behavior and production builds; add lightweight repository-level source contracts only where they catch regressions that app tests cannot.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- All validation runs against current `main` after each preceding redesign wave is merged.
- No temporary helper workflow remains at completion.
- Do not weaken existing Security, Quality, Runtime, KYC, or Business OS gates.
- Cross-app tests must check behavior/contracts, not brittle pixel-perfect snapshots.

---

### Task 1: Shared semantic consistency contract

**Files:**
- Create repository script: `scripts/check-frontend-experience-contract.mjs`
- Add test fixtures only if required.
- Wire into an existing quality workflow rather than creating a permanent redundant workflow.

**Checks:**
- all four apps depend on `lajukan-ui`;
- shared `tokens.css` is reachable/consumed according to each app's established import strategy;
- no temporary workflow filenames from redesign branches exist;
- known forbidden fake fallbacks such as channel sample price patterns do not reappear in production source.

- [ ] Write the script to exit nonzero on a seeded forbidden fixture or mocked file list.
- [ ] Verify RED against seeded fixture.
- [ ] Remove fixture and verify repository passes.
- [ ] Commit `test: add cross-app frontend experience contract`.

### Task 2: Responsive acceptance for WWW and Usaha

**Files:**
- Extend existing Playwright specs in WWW.
- Add/extend Usaha browser smoke test if existing e2e harness exists; otherwise use production build plus source/layout contract, not a brand-new browser stack solely for this task.

**Acceptance widths:** 360, 390, 430, tablet, common desktop.

- [ ] Assert no horizontal document overflow on primary routes.
- [ ] Assert primary action remains reachable.
- [ ] Assert mobile filter/navigation drawers can open/close by keyboard.
- [ ] Run browser tests and production builds.
- [ ] Commit `test: lock mobile frontend acceptance`.

### Task 3: CMS and CRM operator-density acceptance

**Files:**
- Add focused interaction tests in each app's current test harness.

- [ ] Test keyboard path from nav -> filter -> first queue item -> action -> confirmation.
- [ ] Test tablet width does not hide critical action controls.
- [ ] Test large lists keep paging/filter controls reachable.
- [ ] Commit `test: lock internal workspace usability`.

### Task 4: State matrix regression

**Matrix:**
- loading;
- true empty;
- filtered-to-zero;
- partial data;
- API failure;
- unauthorized/read-only;
- mutation pending;
- destructive confirmation.

- [ ] Add focused tests so each app covers the states relevant to its primary workflows.
- [ ] Verify fake fallback data is never used to turn missing/failed state into a ready state.
- [ ] Commit `test: cover cross-app UI state matrix`.

### Task 5: Accessibility pass

- [ ] Verify visible focus on interactive primitives.
- [ ] Verify icon-only buttons have accessible names.
- [ ] Verify modal/drawer focus lifecycle.
- [ ] Verify headings follow meaningful order on primary surfaces.
- [ ] Verify form errors are programmatically associated and not color-only.
- [ ] Verify reduced-motion token/behavior does not block use.
- [ ] Fix only issues found by these checks and commit `fix: close cross-app accessibility gaps`.

### Task 6: WWW performance and SEO regression

- [ ] Run existing metadata/JSON-LD/SEO tests.
- [ ] Run WWW production build.
- [ ] Check redesign did not convert server-first public surfaces into unnecessary client bundles.
- [ ] Check responsive images use explicit sizing where current components support it.
- [ ] Run existing site quality/critical flow tests.
- [ ] Commit only if fixes are needed.

### Task 7: Final four-app verification

Run:
```bash
cd frontend/packages && npm ci && npm test && npm run build
cd ../apps/www && npm ci --legacy-peer-deps && npm run lint && npm test && npx tsc --noEmit --pretty false && npm run build
cd ../usaha && npm ci --legacy-peer-deps && npm run lint && npm run test && npm run typecheck && npm run build
cd ../cms && npm ci --legacy-peer-deps && npm run lint && npm run typecheck && npm run build
cd ../crm && npm ci --legacy-peer-deps && npm run lint && npm run typecheck && npm run build
```

- [ ] Run relevant repository Security/Quality/Frontend Runtime/KYC/Usaha normal gates via the PR.
- [ ] Inspect job-level results; no skipped relevant failure may be treated as green.
- [ ] Open PR `chore/frontend-cross-app-qa-20260907`.
- [ ] Merge only after fresh normal CI success.

### Task 8: Cleanup and completion verification

- [ ] Confirm all redesign PRs are merged.
- [ ] Close superseded redesign PRs if any.
- [ ] Delete merged/superseded redesign branches and temporary helper branches.
- [ ] Preserve active Dependabot branches.
- [ ] Fetch final `main` SHA.
- [ ] Re-check no helper workflow is present on `main`.
- [ ] Only then mark the cross-app redesign complete.
