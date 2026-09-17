# Lajukan Usaha VNext Beginner-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Lajukan Usaha into a beginner-first, task-oriented daily business tool that is fast on mobile, uses everyday Indonesian, prevents duplicate bookkeeping, and never blocks a real sale only because HPP/costing is incomplete.

**Architecture:** Preserve the current universal Business OS, permissions, routes, and backend domain boundaries. Simplify the user-facing information architecture by centralizing navigation/copy decisions, progressively disclose advanced controls, and make the existing sales domain authoritative for ordinary sale income. The only backend behavior change in the UX wave is transaction-integrity hardening: incomplete costing becomes a valid incomplete-cost sale, while manually created `sale_income` entries are rejected so a sale cannot be recorded twice.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3.4, Vitest 3; Rust/Axum, SQLx/PostgreSQL, rust_decimal.

**Spec:** `docs/superpowers/specs/2026-09-13-usaha-beginner-task-first-ux-vnext-design.md`

## Global Constraints

- [ ] Work in an isolated worktree created from `design/usaha-beginner-ux-vnext-20260913`; do not implement directly on `main`.
- [ ] Use test-driven development for every behavioral change: add a failing test, run it and confirm the expected RED failure, implement the minimum change, rerun GREEN, then commit.
- [ ] Preserve existing `PortalSection` IDs and route URLs unless this plan explicitly says otherwise. Simplifying navigation does not require destructive route deletion.
- [ ] Preserve permission checks. Hiding a destination from primary navigation must not weaken authorization.
- [ ] Do not add a global Beginner/Advanced switch. Use contextual progressive disclosure.
- [ ] Do not invent business data. Unknown HPP/COGS stays `null`/incomplete, never `0`.
- [ ] Do not call recorded operating result “laba bersih”. It means complete gross profit minus recorded operating expenses only.
- [ ] A real sale must be recordable without a recipe/HPP. Revenue/payment data remains authoritative; cost-dependent metrics become unavailable until cost is complete.
- [ ] A normal sale creates its financial `sale_income` automatically. Users and generic finance clients must not manually create another `sale_income`.
- [ ] Preserve idempotency for sales and the unique finance linkage `source_type='business_sale'` + `source_id=sale_id`.
- [ ] Preserve the current insufficient-ingredient policy for products that do have a complete recipe. This plan removes missing-cost blocking; it does not silently allow negative tracked ingredient stock.
- [ ] Preserve historical valid cost snapshots. Do not recalculate old complete sale cost from today's recipe or purchase price.
- [ ] No database migration is planned. Current Rust and frontend contracts already model sale/line COGS as nullable. The new persistence test must prove the schema accepts `NULL`. If the RED test fails because the deployed schema is non-nullable, stop that task and use `superpowers:systematic-debugging` before making any schema change.
- [ ] Use Indonesian everyday UI copy. Internal identifiers may remain English/technical if they are not rendered to users.
- [ ] Do not reduce density by shrinking critical controls. Preserve roughly 44 px minimum touch targets, focus-visible states, skip link behavior, and reduced-motion support.
- [ ] After every task, run the targeted tests plus type/compile checks relevant to changed files before committing.

---

## Wave 0 — Navigation and Language Foundation

### Task 1: Centralize beginner-first navigation configuration

**Files:**
- Create: `frontend/apps/usaha/src/lib/portal-navigation.ts`
- Create: `frontend/apps/usaha/src/lib/portal-navigation.test.ts`
- Modify: `frontend/apps/usaha/src/lib/portal-logic.ts`

- [ ] Add failing Vitest cases for the approved desktop order: `home`, `orders`, `products`, `inventory`, `finance`, `reports`, `channels`, `info`.
- [ ] Add failing cases for mobile primary order: `home`, `orders`, `inventory`, `finance`, then Menu.
- [ ] Add permission cases proving inaccessible sections disappear without changing the order of the remaining destinations.
- [ ] Add configuration for contextual Menu/settings links: `products`, `reports`, `channels`, `info`, `team`, `locations`, `buyerPage`; keep legacy `operations` available contextually but not first-class.
- [ ] Set rendered labels to `Beranda`, `Jualan`, `Produk`, `Stok`, `Uang`, `Laporan`, `Jual Online`, `Pengaturan Usaha`, `Tim & Akses`, `Tampilan Toko`.
- [ ] Reuse `buildSectionHref()` and existing `PortalSection` values; do not introduce duplicate route concepts.
- [ ] Run RED then GREEN:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/portal-navigation.test.ts
npm run typecheck
```

- [ ] Commit:

```bash
git add frontend/apps/usaha/src/lib/portal-navigation.ts frontend/apps/usaha/src/lib/portal-navigation.test.ts frontend/apps/usaha/src/lib/portal-logic.ts
git commit -m "feat(usaha): centralize beginner-first navigation"
```

**Acceptance:** one pure configuration defines user-facing navigation order/labels; permissions still control visibility; no production route is removed.

### Task 2: Wire Sidebar, mobile navigation, and shell copy

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/SidebarNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/MobileNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`

- [ ] Replace duplicated local nav arrays with `portal-navigation.ts` selectors.
- [ ] Desktop shows only the approved primary destinations plus a compact settings/account area; `Operasional` is no longer a top-level business module.
- [ ] Mobile uses five equal destinations: Beranda, Jualan, Stok, Uang, Menu.
- [ ] Raise mobile primary nav label size from `text-[10px]` to a readable ~11–12 px while retaining minimum touch height.
- [ ] Rename shell copy `Workspace bisnis` → `Usaha`, `Buat usaha baru`/workspace wording → `Tambah usaha`, and `/access` wording → `Tim & Akses` where rendered.
- [ ] Keep account-level `/security` reachable from account/settings rather than the primary business module list.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/portal-navigation.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit:

```bash
git add frontend/apps/usaha/src/components/portal/SidebarNav.tsx frontend/apps/usaha/src/components/portal/MobileNav.tsx frontend/apps/usaha/src/components/portal/PortalShell.tsx
git commit -m "feat(usaha): simplify portal navigation"
```

**Acceptance:** on owner permissions the bottom bar is exactly Beranda/Jualan/Stok/Uang/Menu; Uang is not buried under Menu; all old URLs still resolve.

---

## Wave 1 — Daily Home

### Task 3: Turn Beranda into a daily command center

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/home-dashboard.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/home-dashboard.test.ts`
- Modify: `frontend/apps/usaha/src/app/page.tsx`
- Modify if necessary: `frontend/apps/usaha/src/lib/portal-logic.ts`

- [ ] Add pure tests for selecting one highest-priority action, three compact daily metrics, setup visibility, and the healthy state.
- [ ] Make priority selection deterministic: blocking/attention condition first; otherwise `Usaha aman. Tidak ada yang mendesak.`
- [ ] Render business identity/open state, at most one priority panel, three quick actions (`Catat jualan`, `Catat pengeluaran`, `Cek stok`), three compact daily metrics, then recent activity.
- [ ] Remove the always-visible portfolio/`Usaha yang kamu kelola` surface from daily Home because `BusinessSwitcher` already handles business switching.
- [ ] Show setup/progress only when setup is incomplete.
- [ ] Do not fabricate missing metrics and do not turn missing HPP into zero profit.
- [ ] For open/closed configuration, link to the existing compatible operations/settings route until that control is moved in a later task; do not invent a new API in this wave.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/business-control/home-dashboard.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit:

```bash
git add frontend/apps/usaha/src/lib/business-control/home-dashboard.ts frontend/apps/usaha/src/lib/business-control/home-dashboard.test.ts frontend/apps/usaha/src/app/page.tsx frontend/apps/usaha/src/lib/portal-logic.ts
git commit -m "feat(usaha): make home task-first"
```

**Acceptance:** Home answers “apa yang perlu saya lakukan sekarang?” before exposing modules; duplicate business portfolio is gone.

---

## Wave 2 — P0 Sales Integrity and Fast Cashier

### Task 4: Specify incomplete-cost sales in backend persistence tests

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales_persistence_tests.rs`
- Modify only when needed for route assertion: `services/marketplace_service/src/businesses/sales_schema_tests.rs`

- [ ] Add `sale_without_recipe_records_revenue_with_incomplete_cost` proving a valid product sale without an effective recipe succeeds with sale `cogs_amount = NULL`, `cost_complete = false`, and line `unit_cogs_amount/line_cogs_amount = NULL`.
- [ ] Assert the incomplete line cost snapshot is an explicit empty/incomplete object representation, not a fake zero-cost snapshot.
- [ ] Add `incomplete_cost_sale_creates_exactly_one_linked_sale_income` proving the finance row exists with the sale final amount, `source_type='business_sale'`, and the sale ID.
- [ ] Add/extend idempotency coverage proving replay does not create a second finance row.
- [ ] Preserve a complete-cost regression case proving existing recipe snapshot and non-null COGS still work.
- [ ] Preserve a regression proving a fully costed/tracked recipe with insufficient ingredient stock still follows the current stock safety policy.
- [ ] Run one new test and confirm RED because current `prepare_line()` returns incomplete-costing error:

```bash
cargo test --manifest-path services/marketplace_service/Cargo.toml sale_without_recipe_records_revenue_with_incomplete_cost -- --exact
```

- [ ] Do not change production code in this task.
- [ ] Commit only the tests after confirming they fail for the expected reason:

```bash
git add services/marketplace_service/src/businesses/sales_persistence_tests.rs services/marketplace_service/src/businesses/sales_schema_tests.rs
git commit -m "test(marketplace): specify incomplete-cost sales"
```

**Acceptance:** RED tests precisely describe null cost, one automatic finance effect, idempotency, and preservation of complete-cost behavior.

### Task 5: Allow real sales when costing is incomplete

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales.rs`
- Modify: `services/marketplace_service/src/businesses/sales_routes.rs`
- Modify tests from Task 4 as needed only to fix test setup, not weaken assertions.

- [ ] Change `PreparedSaleLine.unit_cogs_amount` and `line_cogs_amount` to `Option<i64>`.
- [ ] Make `prepare_line()` distinguish “cost unavailable” from an invalid sale. No recipe, empty/incomplete recipe, or unavailable cost snapshot returns a valid prepared line with null costs and no ingredient consumption.
- [ ] Keep product existence, quantity, price, discount, and request validation strict.
- [ ] Aggregate sale COGS only when **all** lines are cost-complete. If any line cost is missing, persist sale `cogs_amount = NULL` and `cost_complete = FALSE`; never sum a partial COGS and present it as complete.
- [ ] Insert nullable cost fields into `business_sale_lines` without coercion.
- [ ] Run ingredient consumption only for prepared consumption records. Complete recipes continue to consume ingredients and keep existing insufficient-stock safeguards.
- [ ] Keep the existing automatic `sale_income` insert unchanged in meaning and linkage.
- [ ] Remove `SaleRepositoryError::IncompleteCosting` and the `sale_costing_incomplete` route mapping if no production path still uses them after implementation.
- [ ] Do not add a migration. If the persistence RED test proves PostgreSQL rejects null COGS, stop and use systematic debugging before changing schema.
- [ ] Run:

```bash
cargo test --manifest-path services/marketplace_service/Cargo.toml sale_without_recipe_records_revenue_with_incomplete_cost
cargo test --manifest-path services/marketplace_service/Cargo.toml incomplete_cost_sale_creates_exactly_one_linked_sale_income
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::sales_persistence_tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::recipe_sales_versioning_tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::inventory_persistence_tests
cargo fmt --manifest-path services/marketplace_service/Cargo.toml -- --check
cargo check --manifest-path services/marketplace_service/Cargo.toml
```

- [ ] Commit:

```bash
git add services/marketplace_service/src/businesses/sales.rs services/marketplace_service/src/businesses/sales_routes.rs services/marketplace_service/src/businesses/sales_persistence_tests.rs services/marketplace_service/src/businesses/sales_schema_tests.rs
git commit -m "fix(marketplace): record sales with incomplete costing"
```

**Acceptance:** a real sale no longer fails because HPP is missing; revenue is persisted; cost is truthfully incomplete; complete historical costing behavior remains intact.

### Task 6: Redesign Quick Sale as a fast cashier workspace

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/quick-sale.ts`
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.test.ts`
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- Modify if copy/error mapping remains: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx`

- [ ] Extend pure tests for empty cart, add product, increment/decrement quantity, remove-at-zero behavior, total calculation, and payment-method mapping.
- [ ] Keep request payload free of browser-computed HPP/COGS.
- [ ] Change default UI to product search/tap + compact cart rather than one large spreadsheet-style form.
- [ ] Use payment chips mapping `Tunai→cash`, `QRIS→ewallet`, `Bank→bank`, `Belum bayar→receivable`.
- [ ] Hide date, channel, discount, and uncommon fields under `Detail lainnya`/contextual controls; today is the default date.
- [ ] Remember only safe current-session/default choices; do not persist sensitive values in uncontrolled browser storage.
- [ ] Remove copy saying a product needs HPP before it can be sold. A product with a valid sell price can be sold even when cost is missing.
- [ ] After success, branch on response `sale.cost_complete`: complete → normal success; incomplete → `Jualan tersimpan. Laba belum dapat dihitung karena modal produk belum lengkap.`
- [ ] Remove obsolete user-facing handling for `sale_costing_incomplete` after Task 5.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/components/business-control/QuickSaleWorkspace.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit:

```bash
git add frontend/apps/usaha/src/components/business-control/quick-sale.ts frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.test.ts frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/orders/page.tsx
git commit -m "feat(usaha): make quick sale cashier-first"
```

**Acceptance:** a cashier can tap products, adjust quantities, choose payment, and save without understanding HPP, backend, or accounting terminology.

---

## Wave 3 — P0 Finance Double-Entry Guard

### Task 7: Reserve `sale_income` for the sales domain

**Files:**
- Modify: `services/marketplace_service/src/businesses/control.rs`

- [ ] In the inline `#[cfg(test)] mod tests`, add `finance_validation_rejects_manual_sale_income` and a control test proving `other_income` remains valid.
- [ ] Confirm RED: current `validate_finance()` accepts `sale_income`.
- [ ] Change `validate_finance()` so generic/manual finance creation returns `ControlRepositoryError::Validation("manual_sale_income_not_allowed")` for `sale_income`.
- [ ] Do not alter the automatic SQL insert in `sales.rs`; it bypasses generic finance creation intentionally and remains the single sale-income source.
- [ ] Run:

```bash
cargo test --manifest-path services/marketplace_service/Cargo.toml finance_validation_rejects_manual_sale_income
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::control::tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::sales_persistence_tests
cargo fmt --manifest-path services/marketplace_service/Cargo.toml -- --check
cargo check --manifest-path services/marketplace_service/Cargo.toml
```

- [ ] Commit:

```bash
git add services/marketplace_service/src/businesses/control.rs
git commit -m "fix(marketplace): prevent manual sale income duplicates"
```

**Acceptance:** external/generic finance entry creation cannot duplicate a normal sale; sales still create exactly one linked `sale_income`.

### Task 8: Simplify Uang and use configured selling channels

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/finance-options.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/finance-options.test.ts`
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx`

- [ ] Add tests proving normal income choices exclude `sale_income`, the default Uang Masuk category is `other_income`, expense choices preserve required business categories, and configured channels map to select options.
- [ ] Pass enabled `listControlChannels()` values into `FinanceLedger` instead of asking users to type channel strings.
- [ ] Replace free-text `Kanal jual` with a select/autocomplete containing configured channels plus no-channel option.
- [ ] Keep `sale_income` readable in transaction history and revenue summaries because existing sales generate it; only manual creation disappears.
- [ ] Rewrite technical copy: `backend`, `durable`, and `settlement` must not appear in normal content. Use `Transfer dari aplikasi`.
- [ ] If there are no enabled channels, do not render a “Settlement belum relevan” card. Hide the transfer-matching feature entirely.
- [ ] Keep a short contextual explanation that Jualan automatically appears in Uang so users know not to record it twice.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/business-control/finance-options.test.ts src/lib/business-control/ledger.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit:

```bash
git add frontend/apps/usaha/src/lib/business-control/finance-options.ts frontend/apps/usaha/src/lib/business-control/finance-options.test.ts frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/finance/page.tsx
git commit -m "feat(usaha): simplify money entry flow"
```

**Acceptance:** users cannot choose Penjualan in normal Uang entry; generated sales still appear in history/omzet; channel data is consistent.

---

## Wave 4 — Products, Stock, Online Selling, Reports

### Task 9: Make Produk scan-first and progressively disclose administration

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify relevant product form/components already imported by that page.
- Modify/add pure tests under `frontend/apps/usaha/src/lib/business-control/` for any extracted display-state helper.

- [ ] Default list row/card shows product image when useful, product name, selling price, stock/status, and one compact detail/edit action.
- [ ] Do not render a full management form inside each list row.
- [ ] Put HPP, recipe, online pricing, source/supplier, consignment, and advanced identifiers behind detail/expandable UI.
- [ ] Rename rendered `Produk & HPP` to `Produk`; introduce `Modal produk (HPP)` only where cost is relevant and explain HPP once.
- [ ] Keep permission-based costing secrecy.
- [ ] Run targeted tests, then `npm run typecheck` and `npm run lint`.
- [ ] Commit `feat(usaha): simplify product management`.

**Acceptance:** scanning 20 products is fast and does not expose every advanced field at once.

### Task 10: Make Stok action-first

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx`
- Modify: `frontend/apps/usaha/src/lib/business-control/progressive-disclosure.ts`
- Modify its existing test file or create `progressive-disclosure.test.ts` if absent.

- [ ] Test attention ordering: habis → tipis → perlu cocokkan → aman.
- [ ] Present clear internal sections/tabs `Produk` and `Bahan & Kemasan` for F&B; use existing template/business context to avoid F&B-only wording when inappropriate.
- [ ] Put items requiring attention before healthy stock.
- [ ] Rename user copy `Stok & Belanja` → `Stok`, `restock` → `Isi stok`/`Tambah stok`, `qty` → `Jumlah`.
- [ ] Keep purchasing/costing detail behind expansion rather than deleting capability.
- [ ] Run tests/typecheck/lint and commit `feat(usaha): make stock action-first`.

**Acceptance:** owner sees what is running out first; advanced purchasing does not crowd the default stock view.

### Task 11: Reframe Channels as Jual Online outcomes

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx`
- Modify channel simulator/config components imported by that page.
- Modify: `frontend/apps/usaha/src/lib/business-control/progressive-disclosure.ts` and tests when readiness labels change.

- [ ] Render title `Jual Online` and outcome fields: `Potongan aplikasi`, `Promo yang ditanggung toko`, `Harga offline`, `Modal produk`, `Harga online`, `Uang yang diterima`, `Untung perkiraan`.
- [ ] Remove user-facing `merchant`, `fee`, `hard-code`, `canonical`, and technical assumption language.
- [ ] Present a clear safety result such as `Masih aman` only when the calculation is backed by price and complete cost; otherwise explicitly say what is missing.
- [ ] Add contextual link/card to existing `/buyer-page` labeled `Tampilan Toko`; do not make it a separate primary nav item.
- [ ] Keep actual channel fee/config data unchanged; this task changes framing and hierarchy, not financial math.
- [ ] Run tests/typecheck/lint and commit `feat(usaha): reframe online selling`.

**Acceptance:** a beginner can answer “harga GoFood harus berapa supaya tidak rugi?” without learning platform/accounting jargon.

### Task 12: Make Laporan honest and decision-oriented

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/report-metrics.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/report-metrics.test.ts`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`

- [ ] Add pure tests for: no sales; complete cost; one incomplete-cost sale; operating expenses; and permissions hiding cost/finance.
- [ ] Expose primary KPIs: `Omzet`, `Laba kotor`, `Pengeluaran`, `Hasil usaha`.
- [ ] Define `Hasil usaha = laba kotor lengkap - biaya operasional tercatat`. If cost is incomplete or finance is inaccessible, return/render `Belum lengkap`/permission-safe state, not a guessed number.
- [ ] Keep `HPP terjual` available as secondary/detail information, not the primary mental model.
- [ ] Replace `canonical`, `snapshot`, `Phase 1`, `hard-code`, and `drawing` in ordinary UI copy. Put any necessary calculation explanation under `Cara angka ini dihitung`.
- [ ] Only add Hari ini/7 hari/Bulan ini controls if the loaded dataset and helper calculations genuinely cover those periods; do not add decorative filters that reuse today's data.
- [ ] Keep the explicit statement that `Hasil usaha` is not net profit when shown in explanatory detail.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/business-control/report-metrics.test.ts src/lib/business-control/sales.test.ts src/lib/business-control/ledger.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit `feat(usaha): simplify business reports`.

**Acceptance:** incomplete HPP can never display a fake gross profit or operating result.

---

## Wave 5 — Settings, Onboarding, Density, Accessibility

### Task 13: Consolidate Pengaturan Usaha without deleting compatibility routes

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/info/page.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/locations/page.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/team/page.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/operations/page.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx`

- [ ] Make `/info` the landing surface labeled `Pengaturan Usaha` with understandable links/sections for Info, Lokasi, Jam Operasional, and Tim & Akses.
- [ ] Keep legacy routes functional for deep links and permission boundaries.
- [ ] Move raw latitude/longitude out of the ordinary owner flow; show only under advanced/location detail when needed.
- [ ] Keep `Tampilan Toko` discoverable primarily from Jual Online and secondarily from settings if context calls for it.
- [ ] Make account security clearly account-level, not a business feature.
- [ ] Remove duplicated descriptions across settings pages.
- [ ] Run typecheck/lint and commit `feat(usaha): consolidate business settings`.

**Acceptance:** an owner looking for address, hours, or staff knows to open Pengaturan Usaha; no data-management capability is lost.

### Task 14: Convert business creation into a three-step wizard

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-templates.ts`
- Create: `frontend/apps/usaha/src/lib/business-onboarding.ts`
- Create: `frontend/apps/usaha/src/lib/business-onboarding.test.ts`
- Modify: `frontend/apps/usaha/src/components/forms/NewBusinessQuickForm.tsx`
- Modify if needed: `frontend/apps/usaha/src/app/(portal)/businesses/new/page.tsx`

- [ ] Add tests for template-to-beginner-label mapping, default category, step validation, and final payload preservation of existing internal `templateKey`/capability mapping.
- [ ] Replace rendered template labels with `Makanan & Minuman`, `Laundry`, `Servis & Jasa Lapangan`, `Toko & Retail`, `Usaha Lainnya`.
- [ ] Rewrite descriptions without `flow`, `tracking`, `dispatch`, `work order`, `settlement`, or `capability` terminology.
- [ ] Step 1: type of business. Step 2: name/category/phone. Step 3: address/map/city inputs supported by the current location component.
- [ ] Do not invent an address-to-city API that does not exist. Preserve current explicit city field when automatic derivation is unavailable.
- [ ] Use `Lanjut`, `Kembali`, final `Buat Usaha`; remove `Setup inti`, `Quick Start`, and `Membuat workspace...` from rendered copy.
- [ ] Preserve one final POST with idempotency key and the existing backend payload contract.
- [ ] On successful redirect/setup, ensure the first recommended action is `Tambah produk`/template-appropriate first catalog action rather than architecture explanation.
- [ ] Run:

```bash
cd frontend/apps/usaha
npm run test -- src/lib/business-onboarding.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit `feat(usaha): simplify business onboarding`.

**Acceptance:** a first-time owner can create an usaha by answering three understandable groups of questions without seeing software architecture terms.

### Task 15: Reduce card soup and finish responsive/accessibility polish

**Files:**
- Modify: `frontend/apps/usaha/src/app/globals.css`
- Modify: `frontend/apps/usaha/src/components/portal/DataPanel.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PageHeader.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/SectionCard.tsx`
- Modify page/components touched in Waves 0–5 where nested panel structure remains redundant.

- [ ] Preserve existing focus-visible styles, reduced-motion media query, skip link, and minimum interactive height.
- [ ] Make PageHeader default to title + optional short description + one action; eyebrow is optional rather than required repetition.
- [ ] Allow DataPanel/SectionCard to render divider-led sections without forcing every nested level into a bordered rounded card.
- [ ] Remove decorative nested borders where the hierarchy is already clear from spacing/dividers.
- [ ] Do not use primary navigation text below ~11 px; do not shrink form labels to create artificial density.
- [ ] Keep mobile primary action reachable on long workflows, using sticky action treatment only where it improves completion without covering content.
- [ ] Manually inspect at 320, 360, 390, 768, 1280, and 1440 CSS pixels.
- [ ] Keyboard-test sidebar/menu, mobile Menu, cashier controls, finance form, onboarding, and disclosures.
- [ ] Run full frontend checks:

```bash
cd frontend/apps/usaha
npm run test
npm run typecheck
npm run lint
npm run build
```

- [ ] Commit `refactor(usaha): reduce visual density and polish responsive ux`.

**Acceptance:** the UI is space-efficient because it shows less irrelevant structure, not because text/buttons became tiny.

---

## Wave 6 — Full Verification and Release Gate

### Task 16: Verify data integrity, wording, responsiveness, and branch scope

**Automated verification:**

- [ ] Frontend:

```bash
cd frontend/apps/usaha
npm run test
npm run typecheck
npm run lint
npm run build
```

- [ ] Marketplace backend:

```bash
cd ../../..
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::sales_persistence_tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::recipe_sales_versioning_tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::inventory_persistence_tests
cargo test --manifest-path services/marketplace_service/Cargo.toml businesses::control::tests
cargo fmt --manifest-path services/marketplace_service/Cargo.toml -- --check
cargo check --manifest-path services/marketplace_service/Cargo.toml
```

- [ ] Search user-facing frontend source for forbidden jargon and inspect every hit rather than blindly replacing internal identifiers:

```bash
rg -n -i "workspace|capability|canonical|durable|backend|hard-code|merchant|settlement|costing|quick start|setup inti" frontend/apps/usaha/src
```

Allowed hits are internal code identifiers, API fields, comments/tests, or contextual technical help that the approved spec explicitly permits. Normal visible copy must use beginner language.

**Manual acceptance scenarios:**

- [ ] Create a new F&B business through exactly three understandable onboarding steps.
- [ ] Add a sellable product with price but without HPP/recipe.
- [ ] Record the sale from Jualan; confirm it succeeds and says laba cannot yet be calculated.
- [ ] Confirm the sale appears once in Uang/history as generated sale income.
- [ ] Attempt generic/manual API creation of `sale_income`; confirm it is rejected with the stable validation error.
- [ ] Confirm ordinary Uang UI does not offer `Penjualan` as a manual category.
- [ ] Add valid recipe/HPP, make a second sale, and confirm COGS/laba are complete for that sale.
- [ ] Confirm the older incomplete-cost sale remains incomplete; it is not silently rewritten with today's HPP.
- [ ] For a fully tracked recipe with insufficient ingredient stock, confirm the existing stock safety policy still blocks/handles it as before.
- [ ] Configure GoFood/GrabFood-style channels and confirm Finance uses the configured select; disable all channels and confirm transfer-from-app UI disappears rather than showing an irrelevant card.
- [ ] Confirm Report never displays gross profit or Hasil usaha when any required cost is incomplete.
- [ ] Confirm mobile bottom navigation is Beranda/Jualan/Stok/Uang/Menu at owner permissions.
- [ ] Confirm restricted roles do not gain hidden data by the new navigation/settings layout.
- [ ] Confirm every primary screen passes the 3-second, one-action, warung, one-hand-mobile, field-operation, space, and truth tests from the design spec.

**Branch/review gate:**

- [ ] Run `git diff --stat main...HEAD` and `git diff --name-status main...HEAD`; confirm every production change belongs to this approved UX/integrity scope.
- [ ] Run `git status --short`; require a clean worktree.
- [ ] Use `superpowers:verification-before-completion` before claiming the implementation is complete.
- [ ] Request code review using `superpowers:requesting-code-review` before merge.
- [ ] Do not merge until all P0 sale/finance integrity tests and frontend build checks are green.

**Final acceptance:** Lajukan Usaha is beginner-first and materially faster to operate, while the underlying Business OS remains universal, permission-safe, auditable, and truthful about incomplete financial data.
