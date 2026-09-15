# Lajukan Usaha Merchant OS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rombak seluruh `frontend/apps/usaha` menjadi Merchant OS action-first yang familiar untuk operator UMKM Indonesia, dengan shell, navigasi, kasir, produk, stok, uang, laporan, dan settings yang konsisten serta jauh lebih sederhana.

**Architecture:** Pertahankan route, permission, API, dan server contract yang sudah ada. Redesign dilakukan melalui shared Merchant OS primitives di `components/portal`, lalu page-level composition di route existing. Komponen business-control lama dipertahankan jika logic-nya benar, tetapi visual hierarchy dan progressive disclosure disederhanakan.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, lucide-react, Vitest, existing business-control helpers.

**Spec:** `docs/superpowers/specs/2026-09-15-usaha-merchant-os-redesign-design.md`

## Global Constraints

- Preserve current routes, permissions, auth, API request/response contracts, canonical data flows, dan business-control server behavior.
- Gunakan Tailwind + existing `lucide-react`; jangan tambah dependency runtime baru.
- Bahasa UI utama harus memakai istilah merchant sehari-hari seperti `Jual`, `Bayar`, `Uang masuk`, `Uang keluar`, `Stok tipis`, `Habis`, `Tambah stok`.
- Product dan POS harus photo-first.
- Detail teknis memakai progressive disclosure dan tidak mendominasi pekerjaan harian.
- Mobile-first; desktop memakai space ekstra untuk split view dan data density.
- Jangan menebak laba, HPP, saldo, atau stok ketika data tidak lengkap.
- Setiap wave wajib lolos `npm test`, `npm run typecheck`, dan `npm run build` di `frontend/apps/usaha` sebelum dianggap selesai.

---

## File map

### Shared foundation
- Modify `frontend/apps/usaha/src/app/globals.css` — Merchant OS tokens/primitives.
- Modify `frontend/apps/usaha/src/lib/portal-navigation.ts` — primary vs manage navigation.
- Modify `frontend/apps/usaha/src/components/portal/PortalShell.tsx` — lighter merchant shell.
- Modify `frontend/apps/usaha/src/components/portal/SidebarNav.tsx` — 5 primary jobs + manage group.
- Modify `frontend/apps/usaha/src/components/portal/MobileNav.tsx` — Beranda/Jual/Produk/Stok/Menu.
- Modify `frontend/apps/usaha/src/components/portal/PageHeader.tsx` — compact workspace heading.
- Modify `frontend/apps/usaha/src/components/portal/DataPanel.tsx` — flatter section container.
- Create `frontend/apps/usaha/src/components/portal/MetricStrip.tsx` — compact metrics.
- Create `frontend/apps/usaha/src/components/portal/WorkspaceTabs.tsx` — reusable route-mode tabs.
- Create `frontend/apps/usaha/src/components/portal/ProductThumb.tsx` — consistent image/fallback.
- Create `frontend/apps/usaha/src/components/portal/merchant-ui.contract.test.ts` — static UI contract.

### Daily work surfaces
- Modify `frontend/apps/usaha/src/app/page.tsx` — merchant home.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx` — Kasir/Transaksi/Pesanan modes.
- Modify `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx` — image-first POS hierarchy.
- Modify `frontend/apps/usaha/src/components/business-control/CashShiftWorkspace.tsx` — compact shift control.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx` — visual catalog.
- Modify `frontend/apps/usaha/src/components/forms/ProductQuickFormSimple.tsx` — photo-first quick form.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx` — attention/all/materials hierarchy.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx` — activity/planning/transfer hierarchy.

### Management surfaces
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx` — performance reading hierarchy.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx` — channel readiness hierarchy.
- Modify settings-family pages only where current page-level containers conflict with the new shell; shared primitives should carry most of the visual redesign.

---

### Task 1: Merchant OS foundation

**Files:** shared foundation files listed above.

**Interfaces:**
- Produces `MetricStrip({ items })`, `WorkspaceTabs({ items, activeId })`, dan `ProductThumb({ name, imageUrl, size? })`.
- Produces navigation order: desktop primary `home, orders, products, inventory, finance`; mobile primary `home, orders, products, inventory`; `Menu` is rendered by `MobileNav`.

- [ ] **Step 1: Write the failing UI contract test**

Create assertions for:
```ts
expect(source('portal-navigation.ts')).toContain("['home', 'orders', 'products', 'inventory', 'finance']");
expect(source('MobileNav.tsx')).toContain('Jual');
expect(source('MobileNav.tsx')).toContain('Produk');
expect(source('PortalShell.tsx')).toContain('lg:pl-[224px]');
expect(source('globals.css')).toContain('.merchant-surface');
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run from `frontend/apps/usaha`:
```bash
npm test -- merchant-ui.contract.test.ts
```
Expected: FAIL because Merchant OS markers/primitives are not present yet.

- [ ] **Step 3: Implement foundation**

Navigation:
```ts
const desktopPrimaryOrder: PortalSection[] = ['home', 'orders', 'products', 'inventory', 'finance'];
const mobilePrimaryOrder: PortalSection[] = ['home', 'orders', 'products', 'inventory'];
```

Add flatter component classes in `globals.css`:
```css
.merchant-surface { @apply rounded-[18px] bg-white; }
.merchant-section { @apply border-b border-portal-line/70 py-4 last:border-b-0; }
.merchant-chip { @apply inline-flex min-h-9 items-center rounded-full border border-portal-line bg-white px-3 text-xs font-bold; }
.merchant-chip-active { @apply border-portal-forest bg-portal-mist text-portal-forest; }
```

`MetricStrip` renders one continuous surface with divided items rather than separate statistic cards.

`WorkspaceTabs` renders compact horizontally-scrollable tabs with `aria-current`/selected semantics and links.

`ProductThumb` renders a square image using `backgroundImage` when available; otherwise deterministic initials/icon fallback.

- [ ] **Step 4: Run foundation tests**

```bash
npm test -- merchant-ui.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/usaha/src/app/globals.css frontend/apps/usaha/src/lib/portal-navigation.ts frontend/apps/usaha/src/components/portal

git commit -m "feat(usaha): establish merchant OS shell"
```

### Task 2: Beranda action-first

**Files:**
- Modify `frontend/apps/usaha/src/app/page.tsx`
- Test `frontend/apps/usaha/src/components/portal/merchant-ui.contract.test.ts`

**Interfaces:** Consumes `MetricStrip`; existing `buildHomeDashboard`, permission helpers, and existing finance/inventory server reads remain unchanged.

- [ ] **Step 1: Extend failing contract**

```ts
expect(source('../../app/page.tsx')).toContain('Hari ini');
expect(source('../../app/page.tsx')).toContain('Jual');
expect(source('../../app/page.tsx')).toContain('Catat pengeluaran');
expect(source('../../app/page.tsx')).toContain('Tambah stok');
expect(source('../../app/page.tsx')).toContain('<MetricStrip');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- merchant-ui.contract.test.ts
```
Expected: FAIL on home markers.

- [ ] **Step 3: Implement**

Replace equal-weight KPI cards with one `MetricStrip`. Keep one `Perlu dilakukan` action banner and recent activity list. Quick actions become one strong `Jual` CTA and two secondary buttons. Setup progress only renders when incomplete.

- [ ] **Step 4: Verify**

```bash
npm test -- merchant-ui.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/usaha/src/app/page.tsx frontend/apps/usaha/src/components/portal/merchant-ui.contract.test.ts
git commit -m "feat(usaha): make merchant home action first"
```

### Task 3: Jualan / POS workspace

**Files:**
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx`
- Modify `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- Modify `frontend/apps/usaha/src/components/business-control/CashShiftWorkspace.tsx`
- Modify existing quick-sale tests when necessary.

**Interfaces:** Existing sale creation helpers and API remain unchanged. Page modes are server-rendered anchors using query parameter `view=kasir|transaksi|pesanan` so no new client router state is required.

- [ ] **Step 1: Add failing route/UI assertions**

```ts
expect(source('orders/page.tsx')).toContain('Kasir');
expect(source('orders/page.tsx')).toContain('Transaksi');
expect(source('orders/page.tsx')).toContain('Pesanan');
expect(source('QuickSaleWorkspace.tsx')).toContain('Cari produk');
expect(source('QuickSaleWorkspace.tsx')).toContain('Bayar');
```

- [ ] **Step 2: Run relevant tests and confirm red**

```bash
npm test -- QuickSaleWorkspace.test.ts quick-sale-pos-ui.test.ts merchant-ui.contract.test.ts
```

- [ ] **Step 3: Implement page modes**

Read `searchParams.view`; default to `kasir` for users with `createSales`, otherwise first permitted view. Render `WorkspaceTabs` and only the active operational surface. Do not stack Kasir, transaction history, order queue, and stats vertically anymore.

- [ ] **Step 4: Simplify POS hierarchy**

Desktop: visual product area left, sticky cart right. Mobile: product grid + persistent total/Pay bar. Keep existing sale API and payment logic. Cash shift becomes compact status/action row.

- [ ] **Step 5: Verify**

```bash
npm test -- QuickSaleWorkspace.test.ts quick-sale-pos-ui.test.ts merchant-ui.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/orders/page.tsx frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx frontend/apps/usaha/src/components/business-control/CashShiftWorkspace.tsx
git commit -m "feat(usaha): turn jualan into merchant POS workspace"
```

### Task 4: Produk + Stok photo/attention first

**Files:** product page, quick form, inventory page, ProductThumb.

**Interfaces:** Product create/update endpoints unchanged. Inventory data sources and ingredient permissions unchanged.

- [ ] **Step 1: Add failing assertions**

```ts
expect(source('products/page.tsx')).toContain('Cari produk');
expect(source('products/page.tsx')).toContain('+ Produk');
expect(source('inventory/page.tsx')).toContain('Perlu tindakan');
expect(source('inventory/page.tsx')).toContain('Semua stok');
expect(source('inventory/page.tsx')).toContain('Bahan');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- ProductQuickForm.test.ts merchant-ui.contract.test.ts
```

- [ ] **Step 3: Implement product catalog**

Use visual catalog rows/cards with `ProductThumb`, search/filter controls, price and stock/status at a glance. `+ Produk` remains primary. HPP/channel settings are links under detail/management actions, not inline in normal catalog scanning.

- [ ] **Step 4: Implement inventory hierarchy**

Render actionable stock first, then all stock, then costing/materials in separate modes/disclosures. Preserve purchase/yield and IngredientWorkspace capabilities but prevent them from dominating standard stock checking.

- [ ] **Step 5: Verify**

```bash
npm test -- ProductQuickForm.test.ts IngredientWorkspace.test.ts merchant-ui.contract.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/products frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/inventory frontend/apps/usaha/src/components/forms/ProductQuickFormSimple.tsx frontend/apps/usaha/src/components/portal/ProductThumb.tsx
git commit -m "feat(usaha): make products and stock visual first"
```

### Task 5: Uang + Laporan + Jual Online

**Files:** finance, reports, channels routes and existing business-control components.

**Interfaces:** finance ledger/planning, settlements, channel pricing calculations, permissions, and server fetches unchanged.

- [ ] **Step 1: Add failing assertions**

```ts
expect(source('finance/page.tsx')).toContain('Aktivitas');
expect(source('finance/page.tsx')).toContain('Rencana');
expect(source('reports/page.tsx')).toContain('Kinerja usaha');
expect(source('channels/page.tsx')).toContain('Harga online');
```

- [ ] **Step 2: Run red**

```bash
npm test -- merchant-ui.contract.test.ts
```

- [ ] **Step 3: Implement finance hierarchy**

Compact summary first, one `Catat uang` CTA, then Aktivitas/Rencana/Transfer aplikasi modes. Keep explanatory finance copy under contextual help.

- [ ] **Step 4: Implement reports/channels hierarchy**

Reports becomes reading-first with time/results/top items; channels becomes channel readiness/price-first. Preserve no-guessing rules and advanced calculator settings.

- [ ] **Step 5: Verify**

```bash
npm test -- merchant-ui.contract.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/finance frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/reports frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/channels frontend/apps/usaha/src/components/business-control
git commit -m "feat(usaha): simplify money reports and online selling"
```

### Task 6: Management surfaces + global consistency

**Files:** settings-family pages plus shared portal components.

**Interfaces:** no API/permission changes.

- [ ] **Step 1: Audit all route pages under `frontend/apps/usaha/src/app/(portal)` for nested card-heavy wrappers**

Search:
```bash
rg "SectionCard|DataPanel|portal-panel" frontend/apps/usaha/src/app/'(portal)'
```

- [ ] **Step 2: Convert settings-family pages to settings-center pattern**

Each group renders short row summaries with current status/value and one edit/action affordance. Full edit forms remain behind action/disclosure.

- [ ] **Step 3: Normalize loading/empty/error copy and remove internal jargon**

Search:
```bash
rg -n "canonical|COGS|account_key|settlement completeness" frontend/apps/usaha/src
```
Key operational UI must not expose these terms.

- [ ] **Step 4: Verify responsive/accessibility contracts**

Confirm visible focus classes, mobile touch targets, and no horizontal navigation overflow outside intentionally-scrollable chips/tabs.

- [ ] **Step 5: Run full frontend verification**

```bash
cd frontend/apps/usaha
npm test
npm run typecheck
npm run build
```
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha
git commit -m "feat(usaha): complete merchant OS redesign"
```

### Task 7: CI contract hardening and merge readiness

**Files:** existing static contract scripts only when new intentional architecture requires updated markers.

- [ ] **Step 1: Run repository Usaha static contracts**

```bash
python scripts/ci/check_usaha_business_os_contract.py
python scripts/config/test_usaha_ui_contract.py
```

- [ ] **Step 2: Fix only intentional contract drift**

Do not weaken server/data/auth requirements. Update UI architecture markers only when they refer to superseded visual structure.

- [ ] **Step 3: Run full Usaha frontend verification again**

```bash
cd frontend/apps/usaha
npm test
npm run typecheck
npm run build
```

- [ ] **Step 4: Compare against `main` and review changed files**

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
```

- [ ] **Step 5: Open PR, inspect CI, fix any relevant failing checks, then squash merge to `main` only after the Usaha frontend test/typecheck/build evidence is green.**
