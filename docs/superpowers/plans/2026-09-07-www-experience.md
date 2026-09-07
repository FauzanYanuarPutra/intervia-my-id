# WWW Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan WWW easier to understand, search, evaluate, and act on while preserving SEO, locale routing, and public performance.

**Architecture:** Keep public pages server-first where possible. Build discovery and detail presentation from small app-owned components that consume `lajukan-ui`; keep search/filter state explicit in URL/query state and do not move WWW domain logic into the shared package.

**Tech Stack:** Next.js 16, React 19, next-intl, Vitest, Playwright, lajukan-ui.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- Mobile-first at 360/390/430 px.
- Preserve metadata, sitemap, robots, canonical URLs, structured data, and locale behavior.
- Never invent counts, prices, distance, availability, trust, or seller status.
- Keep primary CTA singular per decision surface.
- Avoid unnecessary client components.

---

### Task 1: Homepage decision hierarchy

**Files:**
- Modify: `frontend/apps/www/src/components/home/HomeContentSimple.tsx`
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/home/layout.tsx`
- Test: `frontend/apps/www/src/components/home/HomeContentSimple.test.tsx`

**Interfaces:**
- Produces homepage order: value proposition -> search -> categories -> local/relevant discovery -> trust -> seller/merchant secondary path.

- [ ] Write a failing test asserting exactly one primary hero CTA and a visible search entry point.
- [ ] Run `npm test -- HomeContentSimple.test.tsx` and verify RED.
- [ ] Refactor homepage sections without changing data APIs.
- [ ] Run focused test, then `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`.
- [ ] Commit `feat: simplify WWW homepage discovery flow`.

### Task 2: Search and Explore state model

**Files:**
- Modify app-owned Explore/search components under `frontend/apps/www/src/app/[locale]/(shared)/explore` and `frontend/apps/www/src/components` discovered by current imports.
- Create: `frontend/apps/www/src/lib/search/searchState.ts`
- Test: `frontend/apps/www/src/lib/search/searchState.test.ts`

**Interfaces:**
```ts
export type SearchState = {
  q: string;
  category: string;
  sort: string;
  radiusKm: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};
export function parseSearchState(params: URLSearchParams): SearchState;
export function serializeSearchState(state: SearchState): URLSearchParams;
```

- [ ] Write round-trip tests including blank query, category, radius, and min/max price.
- [ ] Verify RED.
- [ ] Implement parse/serialize with no fake defaults for radius/price.
- [ ] Integrate URL state into Explore.
- [ ] Add mobile filter drawer using `lajukan-ui` Drawer.
- [ ] Run unit tests, lint, typecheck, build.
- [ ] Commit `feat: make WWW search state explicit and mobile friendly`.

### Task 3: Listing card consistency

**Files:**
- Identify current public listing/product/service/business cards and consolidate presentation into app-owned `frontend/apps/www/src/components/discovery/ListingCard.tsx`.
- Test: `frontend/apps/www/src/components/discovery/ListingCard.test.tsx`

**Interfaces:**
```ts
export type ListingCardModel = {
  id: string;
  title: string;
  href: string;
  imageUrl?: string | null;
  priceLabel?: string | null;
  locationLabel?: string | null;
  sellerLabel?: string | null;
  statusLabel?: string | null;
};
```

- [ ] Write failing tests for missing price/location without fallback text pretending values exist.
- [ ] Implement one consistent card hierarchy.
- [ ] Migrate relevant Explore/home listing surfaces.
- [ ] Run tests/build.
- [ ] Commit `feat: unify WWW discovery cards`.

### Task 4: Zero-result and loading behavior

**Files:**
- Modify Explore/search loading/empty components.
- Test: `frontend/apps/www/src/lib/search/searchPresentation.test.ts`

**Interfaces:**
```ts
export function getSearchEmptyState(input: { q: string; hasFilters: boolean }): {
  title: string;
  description: string;
  action: 'clear-filters' | 'change-query' | 'browse-categories';
};
```

- [ ] Write failing tests distinguishing true empty catalog from filtered-to-zero result.
- [ ] Implement one actionable empty state and layout-stable skeletons.
- [ ] Run tests/build.
- [ ] Commit `feat: improve WWW empty and loading states`.

### Task 5: Public detail decision area

**Files:**
- Modify public content/detail surfaces under `frontend/apps/www/src/app/[locale]/(shared)/content` and their imported components.
- Create: `frontend/apps/www/src/components/detail/PrimaryDecisionPanel.tsx`
- Test: `frontend/apps/www/src/components/detail/PrimaryDecisionPanel.test.tsx`

**Interfaces:**
- One primary CTA.
- Secondary CTA must not visually compete.
- Missing price/trust/location remains explicitly missing.

- [ ] Write failing CTA hierarchy tests.
- [ ] Implement decision panel using shared PageHeader/Card/StatusBadge where appropriate.
- [ ] Preserve existing JSON-LD/metadata code paths.
- [ ] Run relevant SEO tests, lint, typecheck, build.
- [ ] Commit `feat: clarify WWW public detail actions`.

### Task 6: WWW regression and responsive gate

**Files:**
- Modify/add Playwright specs under `frontend/apps/www/tests/e2e/`.

- [ ] Add checks for 360/390/430 widths: no horizontal scroll, search reachable, primary CTA reachable.
- [ ] Add homepage -> Explore -> detail critical-flow assertion.
- [ ] Run `npm run test:ux`, `npm run test:e2e:quality`, `npm run quality:foundation`, `npm run build`.
- [ ] Commit `test: lock WWW discovery experience`.
- [ ] Open PR `feat/www-experience-20260907`; merge only when Frontend Runtime Gate and normal frontend quality are green.
