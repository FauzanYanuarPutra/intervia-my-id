# WWW Interaction & Responsive System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WWW Reels, Community, Explore, and UMKM feel like one resilient, responsive interaction system with explicit active/busy/error states, safe mobile ergonomics, and strong desktop use of space.

**Architecture:** Keep the existing feature components and backend contracts. Add a focused source-level regression contract for interaction/responsive semantics, then make minimal component-level changes where the current UI is inconsistent. Prefer existing Tailwind tokens, existing optimistic mutation flows, and existing modal/sheet primitives; do not introduce a second design system or change business data semantics.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3.4, Vitest 3.2, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-www-interaction-responsive-system-design.md`

## Global Constraints

- Preserve existing APIs, routes, analytics events, and business-data semantics.
- Do not invent unsupported verification, ratings, opening-hours, stock, or pricing claims.
- Keep practical primary touch targets around 40–44px and preserve keyboard focus visibility.
- Expose active/pressed, loading/busy, disabled, error, empty, and retry states where relevant.
- Respect safe-area insets and visual viewport sizing on mobile overlays.
- Avoid horizontal overflow at approximately 320px while improving tablet and wide-desktop use of space.
- Preserve optimistic UI with rollback for existing mutations.
- Keep dark-mode and reduced-motion behavior compatible with the current app shell.
- Scope production changes to `frontend/apps/www` unless a repository-level test or documentation file is required.

---

### Task 1: Add a WWW interaction/responsive regression contract

**Files:**
- Create: `frontend/apps/www/src/lib/ux/wwwInteractionResponsiveContract.test.ts`

- [ ] Write a failing source contract for Reels, Community, Explore, and UMKM semantics.
- [ ] Verify the test fails on the current implementation for the intended missing behavior.
- [ ] Keep the test as the permanent regression gate.

### Task 2: Finish Reels interaction and responsive behavior

**Files:**
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/reels/ReelsClient.tsx`

- [ ] Add `aria-pressed`/`aria-busy` for like/save/follow controls while preserving optimistic rollback.
- [ ] Widen tablet/small-desktop feed geometry and keep the contextual third column for sufficiently wide desktop only.
- [ ] Preserve distinct buffering, paused, playback error/retry, empty, load-more, and end states.
- [ ] Run the targeted regression test.

### Task 3: Normalize Community state semantics and modal ergonomics

**Files:**
- Modify: `frontend/apps/www/src/components/community/CommunityFeedClient.tsx`

- [ ] Use visual viewport height, safe-area padding, overscroll containment, and dark-surface parity for modal shells.
- [ ] Add state semantics to search/feed tabs, group join controls, membership tabs, and poll options where backing state already exists.
- [ ] Raise primary action targets toward 40–44px.
- [ ] Preserve skeleton/error/empty/retry and optimistic rollback behavior.
- [ ] Run the targeted regression test.

### Task 4: Strengthen Explore intent, tabs, and wide-layout behavior

**Files:**
- Modify: `frontend/apps/www/src/components/explore/ExploreVisualSystem.tsx`
- Modify if needed: `frontend/apps/www/src/components/explore/ExploreHubPage.tsx`
- Modify if needed: `frontend/apps/www/src/components/explore/ExploreAllSearchClient.tsx`

- [ ] Set explicit boolean `aria-selected`, roving `tabIndex`, stable active data-state, and preserve focus-visible styling.
- [ ] Keep supply/demand intent visually dominant and preserve route/search semantics.
- [ ] Keep swipe/drag on mobile while improving desktop category density without overflow.
- [ ] Run the targeted regression test.

### Task 5: Improve UMKM map/discovery control ergonomics

**Files:**
- Modify: `frontend/apps/www/src/components/super-app/UmkmDiscoveryClient.tsx`
- Inspect/modify only if required: `frontend/apps/www/src/components/super-app/UmkmDiscoveryPanel.tsx`

- [ ] Raise back/search submit/category/city controls to practical touch targets and preserve focus rings.
- [ ] Keep explicit `aria-pressed`, `aria-expanded`, and city-clear behavior.
- [ ] Preserve registered-store vs public-reference distinction and avoid unsupported facts.
- [ ] Run the targeted regression test.

### Task 6: Verify, review, and merge the completed WWW branch

- [ ] Run focused regression test.
- [ ] Run all WWW unit tests.
- [ ] Run `quality:source` and TypeScript typecheck.
- [ ] Run lint and production build.
- [ ] Compare branch against current `main` and preserve newer Usaha fixes.
- [ ] Open PR, require green CI on exact final head, then squash merge into `main` and confirm resulting main commit contains the WWW changes.
