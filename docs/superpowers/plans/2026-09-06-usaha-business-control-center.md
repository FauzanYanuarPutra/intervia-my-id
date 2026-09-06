# Usaha Business Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `usaha.lajukan.com` into a simple business control center with understandable profit/cash visibility, HPP/recipe calculations, stock guidance and merchant-channel copy tools.

**Architecture:** Keep `marketplace_service` as the canonical business boundary and keep frontend calculation/UI concerns inside focused `frontend/apps/usaha/src/lib/business-control/*` and portal pages. Delivery is split into independently mergeable waves. Wave A/B first establishes information architecture and deterministic costing utilities; later waves add durable persistence for ingredients, finance, channel configuration and settlements.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, Rust/Axum, SQLx/Postgres.

**Spec:** `docs/superpowers/specs/2026-09-06-usaha-business-control-center-design.md`

## Global Constraints

- Indonesian-first, plain merchant language.
- Input once, reuse across channels.
- No hard-coded platform commercial fees.
- Financial/costing calculations must be explainable.
- Sensitive profit/HPP views remain restricted by role.
- Mobile bottom navigation prioritizes Home, Sales, Product/HPP and Money.
- Existing `main` behavior must remain backward compatible while new sections are additive.

---

### Task 1: Deterministic costing engine

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/costing.ts`
- Test: `frontend/apps/usaha/src/lib/business-control/costing.test.ts`

**Interfaces:**
- Produces `calculateIngredientUnitCost`, `calculateRecipeCost`, `calculateChannelMargin`, `recommendChannelPrice`, `calculateProductionCapacity`.

- [ ] Write tests for unit conversion, yield, packaging, channel deductions, invalid margin denominator and production bottleneck.
- [ ] Implement pure functions without React/server dependencies.
- [ ] Run `npm test -- --run src/lib/business-control/costing.test.ts`.
- [ ] Run `npm run typecheck`.

### Task 2: Portal information architecture and permissions

**Files:**
- Modify: `frontend/apps/usaha/src/lib/portal-types.ts`
- Modify: `frontend/apps/usaha/src/lib/portal-access.ts`
- Modify: `frontend/apps/usaha/src/lib/portal-logic.ts`
- Modify: `frontend/apps/usaha/src/components/portal/SidebarNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/MobileNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`

**Interfaces:**
- Adds portal sections `inventory`, `finance`, `channels`, `reports`.
- Adds permissions `viewCosting`, `manageCosting`, `viewFinance`, `manageFinance`, `viewChannels`, `manageChannels`, `viewReports`.

- [ ] Add additive section/permission types.
- [ ] Keep cashier unable to view costing/profit/finance balances.
- [ ] Change navigation labels to merchant language and mobile high-frequency order.
- [ ] Update route builder and visibility map.
- [ ] Run portal logic tests/typecheck.

### Task 3: Product & HPP workspace

**Files:**
- Create: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/hpp/page.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/HppCalculator.tsx`

**Interfaces:**
- Consumes costing pure functions from Task 1.
- Allows user-entered ingredient purchase price, quantity, conversion, yield, recipe quantity and packaging rows.

- [ ] Create a plain-language HPP calculator with an avocado-juice starter example.
- [ ] Show HPP breakdown and warnings.
- [ ] Show production bottleneck/capacity.
- [ ] Add entry point from Products page.
- [ ] Run typecheck/build.

### Task 4: Channel pricing & merchant copy center

**Files:**
- Create: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/ChannelPriceCalculator.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/MerchantCopyPack.tsx`

**Interfaces:**
- Uses canonical `BusinessRecord` and product values.
- User controls fee/promo assumptions.

- [ ] Add channel cards for Offline/Lajukan/WhatsApp/GoFood/GrabFood/ShopeeFood.
- [ ] Add per-channel fee, fixed fee, target margin, current price and recommended price calculator.
- [ ] Add copy-per-field and copy-all merchant profile pack.
- [ ] Clearly label values as user assumptions and not official fee schedules.
- [ ] Run typecheck/build.

### Task 5: Money/profit explainer

**Files:**
- Create: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/ProfitExplainer.tsx`
- Create: `frontend/apps/usaha/src/lib/business-control/finance.ts`
- Test: `frontend/apps/usaha/src/lib/business-control/finance.test.ts`

**Interfaces:**
- Produces `summarizeBusinessDay` separating revenue, COGS, operating expenses, owner capital and owner drawings.

- [ ] Test that owner drawing changes cash but not operating profit.
- [ ] Build simple inputs for revenue/HPP/expenses/drawings.
- [ ] Explain `uang masuk bukan selalu untung` in plain Indonesian.
- [ ] Run tests/typecheck/build.

### Task 6: Home command center

**Files:**
- Modify: `frontend/apps/usaha/src/app/page.tsx`

**Interfaces:**
- Home remains compatible with existing backend `BusinessRecord` while linking to new workflows.

- [ ] Replace generic stat emphasis with `Hari ini` and action-first cards.
- [ ] Add shortcuts for HPP, money, channels and stock.
- [ ] Avoid fabricated financial amounts when durable data is not yet available; show onboarding actions instead.
- [ ] Run typecheck/build.

### Task 7: Durable ingredient/finance/channel persistence

**Files:**
- Create migration(s) under `services/marketplace_service/migrations/`.
- Create focused modules under `services/marketplace_service/src/businesses/`.
- Modify `services/marketplace_service/src/businesses/mod.rs`, `routes.rs`, `service.rs`.
- Add persistence tests.

**Interfaces:**
- REST endpoints scoped by business and organization.
- Cost/finance/channel records never live only in browser storage.

- [ ] Add normalized ingredient/recipe/finance/channel tables with organization ownership.
- [ ] Add validation and authenticated CRUD endpoints.
- [ ] Add cost snapshot storage for sales.
- [ ] Add persistence tests and Rust unit tests.
- [ ] Run `cargo test` and `cargo build --release --locked`.

### Task 8: Settlement reconciliation

**Files:**
- Create backend settlement module and migration.
- Create frontend settlement import/review page.

- [ ] Model expected/actual settlement and deductions.
- [ ] Implement safe CSV import adapter boundary.
- [ ] Never mutate ledger on partially invalid import.
- [ ] Surface mismatches and manual confirmation.

### Task 9: Verification and delivery

- [ ] Run `npm test`, `npm run typecheck`, `npm run build` in `frontend/apps/usaha`.
- [ ] Run Usaha contract scripts.
- [ ] Run relevant marketplace Rust tests/build once backend persistence changes land.
- [ ] Open PR against `main`.
- [ ] Require GitHub Usaha Business OS Gate before merge.
