# Lajukan Usaha Business OS UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Usaha application UI into a cohesive, responsive Business OS while preserving all existing routes, data contracts, permissions, forms, auth behavior and backend interactions.

**Architecture:** Keep server/data composition in existing route pages and move presentation into focused Usaha portal primitives. Replace the horizontal pill navigation + permanent right rail with a responsive shell: grouped desktop sidebar, compact top bar, mobile bottom navigation and contextual page content. Operational pages use consistent page headers, KPI cards, status badges, data panels and empty states.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, existing lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-23-usaha-business-os-ui-overhaul-design.md`

## Global Constraints
- Preserve route URLs and locale behavior.
- Preserve existing API request/response shapes and backend calls.
- Preserve current permission checks and actor authorization behavior.
- Add no runtime UI dependency.
- Use existing Tailwind + `lucide-react`.
- Keep Usaha-specific reusable UI under `frontend/apps/usaha/src/components/portal`.
- No business-data/source-of-truth migration in this PR.

---

### Task 1: Add UI architecture regression contract

**Files:**
- Modify: `scripts/config/test_usaha_business_os_contract.py`

**Interfaces:**
- Consumes existing Usaha source files.
- Produces static contract checks for sidebar/mobile navigation, removal of permanent right rail, and shared visual primitives.

- [ ] Add assertions requiring `SidebarNav`, `BusinessSwitcher`, `MobileNav`, `PageHeader`, `StatCard`, `StatusBadge`, `ActionCard`, `EmptyState`, and `DataPanel` in the Usaha portal component tree.
- [ ] Add assertions rejecting the old horizontal `sectionLinks.map` pill-strip inside `PortalShell` and the permanent `xl:grid-cols-[minmax(0,1fr)_340px]` right rail.
- [ ] Run the contract and verify it fails because the new shell/primitives do not yet exist.
- [ ] Commit the failing contract.

### Task 2: Rebuild design tokens and shared primitives

**Files:**
- Modify: `frontend/apps/usaha/src/app/globals.css`
- Modify: `frontend/apps/usaha/tailwind.config.ts`
- Create focused components under `frontend/apps/usaha/src/components/portal/` for navigation, headers, KPI/status/action/empty/data primitives.

**Interfaces:**
- Produces reusable visual vocabulary consumed by all portal pages.

- [ ] Implement neutral background/surface/border tokens and restrained green/sand semantic accents.
- [ ] Implement shared primitives with accessible focus/hover states and responsive behavior.
- [ ] Run Usaha typecheck after the primitives compile.
- [ ] Commit the design-system layer.

### Task 3: Replace PortalShell architecture

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`
- Reuse/create: `SidebarNav.tsx`, `BusinessSwitcher.tsx`, `MobileNav.tsx`.

**Interfaces:**
- Consumes `BusinessRecord`, `PortalSection`, `buildSectionHref` and existing logout behavior.
- Produces the responsive application frame for every authenticated route.

- [ ] Replace horizontal section pills with grouped desktop sidebar navigation.
- [ ] Remove permanent progress/role/team/portfolio right rail.
- [ ] Add compact desktop top bar and mobile navigation.
- [ ] Keep business switching and security/logout reachable.
- [ ] Run the architecture contract and Usaha typecheck.
- [ ] Commit shell overhaul.

### Task 4: Rebuild dashboard hierarchy

**Files:**
- Modify: `frontend/apps/usaha/src/app/page.tsx`
- Reuse shared `PageHeader`, `ActionCard`, `StatCard`, `DataPanel`, `EmptyState`.

**Interfaces:**
- Preserve `resolvePortalHomeState` and all existing attention/KPI values.

- [ ] Keep the no-business onboarding behavior but restyle it with the new primitives.
- [ ] Reorder business dashboard into page header, attention queue, KPI row, conditional setup/context panels.
- [ ] Keep all existing links and computed counts.
- [ ] Run typecheck.
- [ ] Commit dashboard overhaul.

### Task 5: Rebuild operational route presentation

**Files:**
- Modify route pages under `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/` for `products`, `orders`, `locations`, `operations`, `info`, `buyer-page`, and `team`.
- Modify `frontend/apps/usaha/src/app/(portal)/security` presentation where needed.

**Interfaces:**
- Preserve every existing resolver, mutation form, permission gate, value and href.

- [ ] Products: use KPI row + compact operational list, move quick-add to a secondary data panel.
- [ ] Orders: status-first operational list/empty state.
- [ ] Locations: emphasize primary branch and compact branch data.
- [ ] Operations: attention/exception-first sections.
- [ ] Info: settings-style grouping.
- [ ] Buyer page: public-preview treatment and clear WWW action.
- [ ] Team: member list first, role/access context second.
- [ ] Security: calm settings-center hierarchy.
- [ ] Run Usaha typecheck.
- [ ] Commit operational-page overhaul.

### Task 6: Align unauthenticated and edge states

**Files:**
- Modify: `frontend/apps/usaha/src/app/login/page.tsx`
- Modify: `frontend/apps/usaha/src/app/not-found.tsx`
- Modify create-business route presentation under `frontend/apps/usaha/src/app/(portal)/businesses/new`.

**Interfaces:**
- Preserve login/OAuth href behavior and create-business form behavior.

- [ ] Apply the same restrained Business OS visual language.
- [ ] Keep OAuth as full-document navigation.
- [ ] Keep forms/actions unchanged.
- [ ] Run typecheck.
- [ ] Commit edge-state overhaul.

### Task 7: Verification and PR

**Files:**
- No production behavior changes unless verification exposes a defect introduced by this branch.

**Interfaces:**
- Produces a reviewable GitHub PR against `main`.

- [ ] Run Usaha static contract.
- [ ] Run Usaha typecheck.
- [ ] Run Usaha production build.
- [ ] Check branch diff for accidental API/business-logic changes.
- [ ] Push all commits.
- [ ] Open PR against `main` with scope, screenshots-not-in-git note, verification evidence, and explicit statement that API/data behavior is unchanged.
