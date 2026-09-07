# Usaha UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Usaha merchant journey substantially simpler and more action-oriented while preserving durable HPP, inventory, finance, channel, settlement, authorization, and no-fake-data guarantees.

**Architecture:** Keep existing route URLs and backend contracts. Add a small pure decision layer that turns durable business state plus permissions into prioritized next actions, then compose existing feature workspaces behind progressive disclosure rather than rewriting them. Home becomes the merchant’s task queue; product, stock, money, and channel pages each expose one primary action first and advanced detail second.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, existing Usaha portal components and Marketplace business-control APIs

**Spec:** `docs/superpowers/specs/2026-09-07-platform-hardening-usaha-simplification-design.md`

## Global Constraints

- Preserve route URLs and backend request/response shapes.
- Never fabricate omzet, laba, stock, channel readiness, or settlement status.
- Costing, supplier, margin, and sensitive finance data remain permission-gated.
- Indonesian merchant copy leads with ordinary business language; technical/accounting detail is secondary.
- Mobile-first; one visually dominant primary action per page state.
- Existing advanced capability remains reachable through progressive disclosure.

---

### Task 1: Create a pure merchant-next-action engine with TDD

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/next-actions.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/next-actions.test.ts`

**Interfaces:**
- Produces:

```ts
export type MerchantNextActionKind =
  | 'add_product'
  | 'add_ingredient'
  | 'build_recipe'
  | 'set_channel_price'
  | 'record_money'
  | 'reconcile_settlement'
  | 'restock'
  | 'healthy';

export type MerchantNextAction = {
  kind: MerchantNextActionKind;
  title: string;
  description: string;
  href: string;
  priority: number;
};

export function buildMerchantNextActions(input: MerchantNextActionInput): MerchantNextAction[];
```

- [ ] Write RED tests proving: no product -> `add_product`; product but no costable ingredient -> `add_ingredient`; ingredients but no recipe -> `build_recipe`; low stock outranks non-urgent setup; settlement action appears only for enabled channels with unreconciled durable settlement data; costing-only actions disappear when permission is absent; no-data never becomes fake revenue/profit.
- [ ] Run `npx vitest run src/lib/business-control/next-actions.test.ts`; expected FAIL before implementation.
- [ ] Implement the smallest deterministic priority engine to satisfy the tests.
- [ ] Re-run the test; expected PASS.
- [ ] Commit engine + tests.

### Task 2: Turn Beranda into a prioritized action surface

**Files:**
- Modify the existing business home route/component identified from current route composition.
- Reuse: `frontend/apps/usaha/src/components/portal/ActionCard.tsx`
- Reuse: `frontend/apps/usaha/src/components/portal/EmptyState.tsx`
- Reuse: `frontend/apps/usaha/src/components/portal/StatCard.tsx`

**Interfaces:**
- Consumes: `buildMerchantNextActions(...)` plus durable business-control reads already available to the portal.
- Produces: one primary next action, at most a few secondary actions, and compact truthful status summaries.

- [ ] Write a component/route test proving the first action changes from setup to operations as durable data becomes available.
- [ ] Render the top-priority action as the only primary CTA.
- [ ] Show compact factual summaries only when source data exists; use explicit empty copy otherwise.
- [ ] Keep advanced reports and settlement detail as secondary navigation, not top-level dashboard clutter.
- [ ] Run focused test, TypeScript, and Usaha build.

### Task 3: Simplify Produk & HPP with progressive disclosure

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify as needed: `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx`
- Reuse: `frontend/apps/usaha/src/components/forms/ProductQuickForm.tsx`

**Interfaces:**
- Consumes: durable products, ingredients, recipes, and `viewCosting` permission.
- Produces: product-first experience; HPP/recipe detail opens only when relevant and allowed.

- [ ] Add RED tests for product-first empty state and permission-safe costing disclosure.
- [ ] Make “Tambah produk” the primary action when no product exists.
- [ ] For an existing product, show selling identity/status first; expose recipe/HPP editor through an explicit “Atur resep & HPP” action.
- [ ] Never render purchase cost/HPP fields to users without `viewCosting`.
- [ ] Run focused tests, lint/typecheck, build.

### Task 4: Simplify Stok & Belanja

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx`
- Modify as needed: `frontend/apps/usaha/src/components/business-control/IngredientWorkspace.tsx`

**Interfaces:**
- Consumes: operational stock for all authorized operational roles; cost/supplier fields only for costing permissions.
- Produces: low-stock-first operational list and one quick add/restock action.

- [ ] Add RED tests proving cashier/viewer-visible stock does not include supplier cost fields.
- [ ] Put low/minimum stock items first.
- [ ] Make “Tambah bahan/kemasan” or “Catat belanja/restock” the primary CTA according to state.
- [ ] Move conversion/yield/supplier/cost detail into expandable management sections.
- [ ] Run focused tests, typecheck, build.

### Task 5: Simplify Uang and settlement entry points

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx`
- Modify as needed: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`
- Reuse: `frontend/apps/usaha/src/components/business-control/SettlementWorkspace.tsx`

**Interfaces:**
- Consumes: durable finance entries and settlements.
- Produces: simple day-to-day money entry first; settlement as a conditional secondary workspace.

- [ ] Add RED tests for income/expense-first flow and no double-count settlement behavior.
- [ ] Present primary choices as “Uang masuk” and “Uang keluar”; keep accounting entry types behind those choices.
- [ ] Show “Cocokkan transfer platform” only when a delivery channel is enabled/relevant.
- [ ] Keep expected-vs-actual settlement calculation separate from revenue totals.
- [ ] Run settlement tests, finance tests, typecheck, build.

### Task 6: Simplify Kanal Jual and recommended pricing

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx`
- Modify as needed: `frontend/apps/usaha/src/components/business-control/ChannelSettingsWorkspace.tsx`
- Reuse: `frontend/apps/usaha/src/components/business-control/ChannelPriceCalculator.tsx`

**Interfaces:**
- Consumes: durable channel settings plus product HPP only when costing permission exists.
- Produces: readiness + actionable price recommendation before fee/margin detail.

- [ ] Add RED tests proving missing HPP yields an explicit setup action rather than invented recommended price.
- [ ] Show channel enabled/disabled/readiness first.
- [ ] Show “Harga minimum aman” only from real HPP + stored fee/promo assumptions.
- [ ] Put detailed fee, merchant promo, and target margin fields in expandable advanced settings.
- [ ] Run focused tests, typecheck, build.

### Task 7: Tighten navigation and mobile comprehension

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/SidebarNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/MobileNav.tsx`
- Modify only if needed: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`

**Interfaces:**
- Consumes: current `PortalSection` route mapping.
- Produces: same URLs with merchant-oriented labels and reduced first-level choice load.

- [ ] Add navigation tests that preserve current route targets.
- [ ] Keep the primary first-level set centered on Beranda, Jualan, Produk & HPP, Stok & Belanja, Uang, Kanal Jual, Laporan.
- [ ] Move Profil usaha, Lokasi, Operasional, Tim, Halaman pembeli, and Keamanan into a secondary “Pengaturan usaha” grouping without changing URLs.
- [ ] Verify keyboard focus, skip link, and mobile nav remain usable.
- [ ] Run portal tests, lint/typecheck, build.

### Task 8: Full Usaha verification and regression gate

**Files:**
- Test/config only unless a real regression is discovered.

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: mergeable UX wave with permission/security invariants intact.

- [ ] Run all Usaha tests.
- [ ] Run TypeScript check.
- [ ] Run Next production build.
- [ ] Run Usaha Business OS Gate.
- [ ] Run Frontend Runtime Gate.
- [ ] Verify roles without costing permission cannot receive sensitive costing fields through the frontend data path.
- [ ] Verify no empty-state metric renders fabricated omzet/laba values.
- [ ] Commit only after the affected scope is green.

## Self-review

- Spec coverage: merchant journey, mobile/action-first design, progressive disclosure, truthful empty states, and permission boundaries are covered.
- Placeholder scan: no TBD/TODO placeholders remain; each behavior has an explicit test target.
- Type consistency: all screens consume the same `MerchantNextAction` engine and existing durable backend contracts; no second source of truth is introduced.