# Usaha Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Usaha into a simple action-first merchant operating system that prioritizes daily work, durable data, and permission-aware progressive disclosure.

**Architecture:** Preserve the existing portal routes and backend contracts. Keep next-action ranking as pure/testable logic, move secondary merchant administration out of primary navigation, and migrate surfaces to the shared UI foundation without reintroducing fake fallback business values.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, lajukan-ui.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- Mobile-first at 360/390/430 px.
- Exactly one highest-priority action on Beranda.
- No fabricated revenue, margin, price, readiness, settlement, or channel status.
- Do not load costing/supplier data for roles lacking costing permission.
- Preserve durable backend APIs and existing role contracts.

---

### Task 1: Finish and lock next-action engine

**Files:**
- Modify current next-action engine/test files on the active Usaha simplification branch, then rebase/sync to the implementation branch after current work merges.

**Interfaces:**
```ts
export type MerchantNextAction = {
  id: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  kind: 'stock' | 'product' | 'costing' | 'money' | 'settlement' | 'channel' | 'setup';
};
export function getMerchantNextActions(input: MerchantActionInput): MerchantNextAction[];
```

- [ ] Add failing tests for stock-out > low-stock > missing product/costing > settlement > channel/setup ordering.
- [ ] Add permission tests proving unauthorized costing/money/channel actions are absent.
- [ ] Verify RED, implement minimal ranking, verify GREEN.
- [ ] Commit `feat: lock Usaha merchant next-action priorities`.

### Task 2: Beranda one-primary-action composition

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/page.tsx` or current Beranda route/component after branch sync.
- Create app-owned `components/beranda/PrimaryNextAction.tsx` and `SecondaryNextActions.tsx` if not already present.
- Test corresponding presentation logic.

- [ ] Write failing test asserting one dominant action and at most a short secondary list.
- [ ] Render only durable indicators returned by existing APIs.
- [ ] Replace dashboard-like equal-weight cards with shared PageHeader/Card/Alert primitives.
- [ ] Run focused test, lint, typecheck, build.
- [ ] Commit `feat: simplify Usaha Beranda around next action`.

### Task 3: Produk & HPP progressive disclosure

**Files:**
- Modify existing Produk/HPP route/components.
- Create `components/products/ProductWorkspace.tsx` and `CostingDetails.tsx` only if current file boundaries are too large.
- Test permission and disclosure state.

- [ ] Write failing test: product list is visible before costing controls.
- [ ] Write failing test: role without costing permission neither sees actionable HPP controls nor triggers costing data load.
- [ ] Implement product-first composition and expandable/secondary costing detail.
- [ ] Run tests/typecheck/build.
- [ ] Commit `feat: make Usaha products product first`.

### Task 4: Stok urgent-first workflow

**Files:**
- Modify Stok & Belanja route/components.
- Create/test pure stock ordering helper if current ordering is inline.

**Interfaces:**
```ts
export function sortStockAttention<T extends { quantity: number; lowStockThreshold?: number | null }>(items: T[]): T[];
```

- [ ] Test out-of-stock first, low-stock second, healthy last, stable ordering inside equal buckets.
- [ ] Implement main action as replenish/correct stock.
- [ ] Keep supplier/analytics secondary.
- [ ] Run tests/build.
- [ ] Commit `feat: prioritize urgent Usaha stock work`.

### Task 5: Uang daily-entry first and settlement conditional

**Files:**
- Modify Uang route/components.
- Test settlement visibility helper.

**Interfaces:**
```ts
export function shouldShowSettlement(input: { hasActiveChannel: boolean; hasSettlementData: boolean; canViewSettlement: boolean }): boolean;
```

- [ ] Write RED tests for all three required conditions.
- [ ] Make daily money entry the main action.
- [ ] Hide settlement when data/channel/permission conditions are absent.
- [ ] Keep advanced reporting secondary.
- [ ] Run tests/build.
- [ ] Commit `feat: simplify Usaha money workflow`.

### Task 6: Kanal Jual honest readiness and pricing

**Files:**
- Modify Kanal Jual route/components and current pricing helpers.
- Test: no recommendation without both durable product price and HPP.

**Interfaces:**
```ts
export function getChannelPricingReadiness(input: { productPrice: number | null; hpp: number | null }):
  | { ready: false; reason: 'missing-price' | 'missing-hpp' }
  | { ready: true; productPrice: number; hpp: number };
```

- [ ] Add failing tests for null price and null HPP.
- [ ] Ensure no `0` or sample Rp15.000 fallback returns.
- [ ] Render actionable setup guidance instead.
- [ ] Run tests/build.
- [ ] Commit `fix: keep Usaha channel pricing data honest`.

### Task 7: Navigation and responsive polish

**Files:**
- Modify portal shell/navigation components.
- Add shared primitive adoption where useful.

- [ ] Test/navigation contract includes primary: Beranda, Jualan, Produk & HPP, Stok & Belanja, Uang, Kanal Jual, Laporan.
- [ ] Group Profil/Lokasi/Operasional/Tim/Halaman pembeli/Keamanan under Pengaturan usaha.
- [ ] Verify mobile navigation keeps core jobs reachable.
- [ ] Run Business OS tests, lint, typecheck, build.
- [ ] Commit `feat: simplify Usaha navigation`.

### Task 8: Usaha final gate

- [ ] Run all Usaha unit tests.
- [ ] Run repository Usaha Business OS Gate contract locally where script exists.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run build`.
- [ ] Verify no temporary workflows remain.
- [ ] Open PR `feat/usaha-experience-20260907` and merge only on fresh green normal gates.
