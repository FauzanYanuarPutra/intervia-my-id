# Async UX System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize Lajukan async UX so loading, refresh, empty, error, stale, mutation, upload, and hydration states are truthful and stable across apps.

**Architecture:** Introduce shared async-state primitives and focused guard utilities, then migrate high-impact surfaces by domain. Domain components keep their own topology skeletons while shared primitives own accessibility, tokens, and motion behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-13-async-ux-system-design.md`

## Global Constraints

- Preserve externally observable routes, request shapes, locale behavior, and user-visible workflow semantics unless explicitly changed.
- Do not expose private backend credentials through `NEXT_PUBLIC_*`.
- Skeletons are decorative and must use `aria-hidden="true"`.
- Async regions should use `aria-busy` only at meaningful region boundaries.
- Empty state requires a settled successful request.
- Existing content remains visible during refresh when still valid.
- Unknown numeric values must not be rendered as real zero.

---

### Task 1: Shared Async State Utilities

**Files:**
- Create: `frontend/apps/www/src/lib/async/asyncState.ts`
- Test: `frontend/apps/www/src/lib/async/asyncState.test.ts`

**Interfaces:**
- Produces: `type AsyncListStatus = 'idle' | 'initial-loading' | 'refreshing' | 'success' | 'empty' | 'error' | 'stale-error'`
- Produces: `deriveAsyncListStatus(args: { itemCount: number; loading: boolean; settled: boolean; error: boolean; hasStaleData?: boolean }): AsyncListStatus`
- Produces: `formatKnownNumber(value: number | null | undefined, formatter: (value: number) => string, unknownLabel: string, unavailableLabel: string): string`

- [ ] **Step 1: Write failing async-state tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveAsyncListStatus, formatKnownNumber } from './asyncState';

describe('deriveAsyncListStatus', () => {
  it('treats an empty unsettled loading list as initial loading, not empty', () => {
    expect(deriveAsyncListStatus({ itemCount: 0, loading: true, settled: false, error: false })).toBe('initial-loading');
  });

  it('keeps stale data visible while refreshing', () => {
    expect(deriveAsyncListStatus({ itemCount: 4, loading: true, settled: true, error: false })).toBe('refreshing');
  });

  it('returns stale-error when refresh fails but usable data remains', () => {
    expect(deriveAsyncListStatus({ itemCount: 4, loading: false, settled: true, error: true, hasStaleData: true })).toBe('stale-error');
  });

  it('returns empty only after a successful settled empty response', () => {
    expect(deriveAsyncListStatus({ itemCount: 0, loading: false, settled: true, error: false })).toBe('empty');
  });
});

describe('formatKnownNumber', () => {
  it('does not render unknown or unavailable values as zero', () => {
    const format = (value: number) => `${value}`;
    expect(formatKnownNumber(undefined, format, '...', 'N/A')).toBe('...');
    expect(formatKnownNumber(null, format, '...', 'N/A')).toBe('N/A');
    expect(formatKnownNumber(0, format, '...', 'N/A')).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/apps/www; npm run test -- src/lib/async/asyncState.test.ts`

- [ ] **Step 3: Implement the utility**

```ts
export type AsyncListStatus =
  | 'idle'
  | 'initial-loading'
  | 'refreshing'
  | 'success'
  | 'empty'
  | 'error'
  | 'stale-error';

type AsyncListStatusInput = {
  itemCount: number;
  loading: boolean;
  settled: boolean;
  error: boolean;
  hasStaleData?: boolean;
};

export function deriveAsyncListStatus({
  itemCount,
  loading,
  settled,
  error,
  hasStaleData,
}: AsyncListStatusInput): AsyncListStatus {
  const hasItems = itemCount > 0 || Boolean(hasStaleData);
  if (loading && !settled && !hasItems) return 'initial-loading';
  if (loading && hasItems) return 'refreshing';
  if (error && hasItems) return 'stale-error';
  if (error) return 'error';
  if (!settled) return 'idle';
  if (itemCount === 0) return 'empty';
  return 'success';
}

export function formatKnownNumber(
  value: number | null | undefined,
  formatter: (value: number) => string,
  unknownLabel: string,
  unavailableLabel: string,
): string {
  if (value === undefined) return unknownLabel;
  if (value === null) return unavailableLabel;
  return formatter(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/apps/www; npm run test -- src/lib/async/asyncState.test.ts`

### Task 2: Home Hydration and Unknown Counts

**Files:**
- Modify: `frontend/apps/www/src/components/home/HomeResponsiveMarketplace.tsx`
- Test: `frontend/apps/www/src/components/home/HomeResponsiveMarketplace.async-state.test.tsx`

**Interfaces:**
- Consumes: `formatKnownNumber` from Task 1.
- Produces: Home renders marketplace shell while auth is hydrating.

- [ ] **Step 1: Write failing tests**

Use component tests to assert that auth hydration does not render only `HomeLoadingState`, and summary counts are placeholders while summary is `null`.

- [ ] **Step 2: Run the tests and verify failure**

Run: `cd frontend/apps/www; npm run test -- src/components/home/HomeResponsiveMarketplace.async-state.test.tsx`

- [ ] **Step 3: Update Home**

Remove the early `if (authLoading) return <HomeLoadingState />`. Keep the shell mounted and pass local loading state into auth-dependent components. Change summary count formatting so `summary === null` renders placeholder text rather than `'0'`.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend/apps/www; npm run test -- src/components/home/HomeResponsiveMarketplace.async-state.test.tsx`

### Task 3: Community Feed State Correctness

**Files:**
- Modify: `frontend/apps/www/src/components/community/CommunityFeedClient.tsx`
- Test: `frontend/apps/www/src/components/community/CommunityFeedClient.async-state.test.tsx`

**Interfaces:**
- Consumes: `deriveAsyncListStatus`.
- Produces: Feed/search skeletons only for initial empty load; stale items stay visible during refresh.

- [ ] **Step 1: Write failing tests**

Test that a refresh with existing items renders the posts and a refresh indicator, not `CommunityFeedSkeleton`. Test that empty state appears only after settled success.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend/apps/www; npm run test -- src/components/community/CommunityFeedClient.async-state.test.tsx`

- [ ] **Step 3: Update feed state**

Track `feedSettled` and `searchSettled`. Derive render status from item count, loading, settled, and error. Render skeleton on `initial-loading`, empty on `empty`, stale error on `stale-error`, and subtle refresh status on `refreshing`.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend/apps/www; npm run test -- src/components/community/CommunityFeedClient.async-state.test.tsx`

### Task 4: Explore Entity Skeletons

**Files:**
- Modify: `frontend/apps/www/src/components/explore/ExploreSearchResults.tsx`
- Test: `frontend/apps/www/src/components/explore/ExploreSearchResults.test.tsx`

**Interfaces:**
- Produces: `SearchSkeleton` with per-entity media/card topology.

- [ ] **Step 1: Add tests**

Assert initial loading renders skeleton sections with product, service, and business markers, and refresh with visible results keeps stale cards visible.

- [ ] **Step 2: Verify tests fail for topology markers**

Run: `cd frontend/apps/www; npm run test -- src/components/explore/ExploreSearchResults.test.tsx`

- [ ] **Step 3: Implement entity skeleton topology**

Replace generic six rectangles with section skeletons for product/service/business cards.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend/apps/www; npm run test -- src/components/explore/ExploreSearchResults.test.tsx`

### Task 5: Business OS Number and Table Semantics

**Files:**
- Create: `frontend/apps/usaha/src/lib/async-values.ts`
- Test: `frontend/apps/usaha/src/lib/async-values.test.ts`
- Modify high-risk finance/order/inventory components after utility adoption.

**Interfaces:**
- Produces: `formatKnownCurrency(value: number | null | undefined): string`
- Produces: `isInitialTableLoading(args: { rowCount: number; loading: boolean; settled: boolean }): boolean`

- [ ] **Step 1: Write failing tests**

Assert `undefined` does not format as `Rp0`, `null` returns unavailable copy, and zero formats as actual IDR zero.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend/apps/usaha; npm run test -- src/lib/async-values.test.ts`

- [ ] **Step 3: Implement utility and adopt in the first finance surface**

Use the utility in finance/KPI surfaces before broad migration.

- [ ] **Step 4: Run usaha tests**

Run: `cd frontend/apps/usaha; npm run test -- src/lib/async-values.test.ts`

### Task 6: Static Guards

**Files:**
- Create: `frontend/apps/www/src/lib/async/asyncAntiPatterns.test.ts`

**Interfaces:**
- Produces guard coverage for touched high-risk files.

- [ ] **Step 1: Write guard tests**

Scan touched files for new raw full-page auth loading gates, direct empty-state rendering during loading, and raw `animate-pulse` in migrated components.

- [ ] **Step 2: Verify guard catches an intentionally listed existing anti-pattern**

Run: `cd frontend/apps/www; npm run test -- src/lib/async/asyncAntiPatterns.test.ts`

- [ ] **Step 3: Fix or whitelist with explanation**

Keep guards narrow to migrated files and document legitimate exceptions inline.

- [ ] **Step 4: Run guard tests**

Run: `cd frontend/apps/www; npm run test -- src/lib/async/asyncAntiPatterns.test.ts`

### Task 7: Verification

**Files:**
- No production files.

- [ ] **Step 1: Run focused tests**

Run: `cd frontend/apps/www; npm run test -- src/lib/async/asyncState.test.ts src/components/explore/ExploreSearchResults.test.tsx`

- [ ] **Step 2: Run lint/type checks for touched apps**

Run: `cd frontend/apps/www; npm run lint`

Run: `cd frontend/apps/usaha; npm run test -- src/lib/async-values.test.ts`

- [ ] **Step 3: Review diff**

Run: `git diff --stat`

Run: `git diff -- docs/superpowers frontend/apps/www/src/lib/async frontend/apps/www/src/components/explore frontend/apps/usaha/src/lib`

