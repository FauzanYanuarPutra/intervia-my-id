# CMS Editorial Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CMS from one oversized dashboard into a queue-oriented editorial workspace for content, moderation, taxonomy, and banner placement.

**Architecture:** Preserve current APIs and auth context, but split `CmsDashboard.tsx` by domain responsibility. Keep state/data fetching close to the owning workspace and compose shared `lajukan-ui` primitives for headers, filters, tables, empty states, confirmation, and status.

**Tech Stack:** Next.js 16, React 19, TypeScript, lajukan-ui.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- Desktop-first, tablet/small-screen safe.
- Do not create CMS sections unsupported by real APIs.
- Preserve auth/permission boundaries and API contracts.
- Destructive operations require explicit confirmation.
- Queue processing must be keyboard-friendly.

---

### Task 1: Extract CMS domain model/presentation helpers

**Files:**
- Create: `frontend/apps/cms/src/components/cms/types.ts`
- Create: `frontend/apps/cms/src/components/cms/contentPresentation.ts`
- Test: `frontend/apps/cms/src/components/cms/contentPresentation.test.ts`
- Modify: `CmsDashboard.tsx` imports only after tests pass.

**Interfaces:**
```ts
export type CmsWorkspaceId = 'overview' | 'content' | 'sectors' | 'banners';
export function getContentStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info';
```

- [ ] Write status mapping tests.
- [ ] Verify RED.
- [ ] Move shared CMS types/helpers without behavior change.
- [ ] Run test/lint/typecheck.
- [ ] Commit `refactor: extract CMS workspace contracts`.

### Task 2: Build content workspace

**Files:**
- Create: `components/cms/ContentWorkspace.tsx`
- Create: `components/cms/ContentTable.tsx`
- Create: `components/cms/ContentEditor.tsx`
- Test filter/save/archive behavior.

**Interfaces:**
- `ContentWorkspace` owns filters, pagination, selected content, load/save state.
- `ContentTable` is presentation-only.
- `ContentEditor` receives model + callbacks and does not fetch lists.

- [ ] Write failing filter persistence test.
- [ ] Write failing save pending-state test.
- [ ] Implement using shared FilterBar/Table/PageHeader/ConfirmDialog.
- [ ] Preserve current `contentApi` request shapes.
- [ ] Run lint/typecheck/build.
- [ ] Commit `feat: add focused CMS content workspace`.

### Task 3: Build sector manager

**Files:**
- Create: `components/cms/SectorManager.tsx`
- Test active/inactive and save state.

- [ ] Write RED test that edit form opens only for chosen sector and save button is locally pending.
- [ ] Move sector state/actions from old dashboard.
- [ ] Use explicit empty/error/loading states.
- [ ] Run tests/build.
- [ ] Commit `feat: extract CMS sector manager`.

### Task 4: Build banner manager

**Files:**
- Create: `components/cms/BannerManager.tsx`
- Test scheduling/status and destructive confirmation.

- [ ] Write RED test for delete/archive confirmation.
- [ ] Move banner state/actions from old dashboard.
- [ ] Display schedule/status with semantic badges.
- [ ] Run tests/build.
- [ ] Commit `feat: extract CMS banner manager`.

### Task 5: Replace giant dashboard shell with queue-oriented overview

**Files:**
- Rewrite: `frontend/apps/cms/src/components/CmsDashboard.tsx`
- Create: `components/cms/CmsOverview.tsx`
- Test workspace navigation.

**Interfaces:**
- Dashboard shell handles auth, user menu/logout, workspace selection only.
- Overview displays only counts/queues derived from already loaded real data or supported summary endpoints.

- [ ] Write failing navigation test for Overview/Content/Sectors/Banners.
- [ ] Remove embedded forms/state now owned by workspaces.
- [ ] Ensure no unsupported Media/Moderation route is invented; only surface real domains.
- [ ] Run lint/typecheck/build.
- [ ] Commit `refactor: turn CMS dashboard into editorial workspace shell`.

### Task 6: CMS final gate

- [ ] Run CMS lint/typecheck/build.
- [ ] Verify current auth/login still works.
- [ ] Test keyboard tab order through filter -> table -> editor -> confirmation.
- [ ] Verify tablet width has no inaccessible horizontal controls.
- [ ] Open PR `feat/cms-editorial-workspace-20260907`; merge only when normal frontend gates are green and temporary workflows are absent.
