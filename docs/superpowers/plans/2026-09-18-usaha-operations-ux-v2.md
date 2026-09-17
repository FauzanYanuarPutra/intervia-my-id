# Usaha Operations UX V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blocking modal-heavy HPP/cashier/order workflows with a persistent operational workspace while preserving existing URLs, API contracts, permissions, idempotency, stock, finance, and audit behavior.

**Architecture:** Keep route composition in `frontend/apps/usaha/src/app`, business UI in `src/components/business-control`, and pure workflow/state helpers in `src/lib/business-control`. Refactor behavior incrementally: first add failing contract/unit tests, then introduce pure order transition helpers, then replace cashier and HPP blocking/select-heavy interaction surfaces while retaining the existing backend adapters.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, Tailwind CSS, `lajukan-ui`, existing Rust-backed business APIs.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-operations-ux-v2.md`

## Global Constraints

- Keep `frontend/apps/usaha` as the app boundary; do not create a new frontend app.
- Preserve route URLs and existing request/response shapes unless an additive contract is required.
- Preserve permission checks, sale idempotency, stock/accounting source-of-truth behavior, and audit semantics.
- Core workflows must not rely on blocking modal dialogs.
- Modal/dialog usage is limited to short destructive confirmations or mandatory reason capture.
- Prefer visible buttons/chips for small option sets and search pickers for large collections.
- Follow repository `AGENTS.md`; never modify an already-applied migration.

---

### Task 1: Add UX regression contracts

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/operations-ux-v2.contract.test.ts`
- Test: existing source files `QuickSaleWorkspace.tsx`, `QuickSaleProductConfigurator.tsx`, `DurableHppWorkspace.tsx`

**Interfaces:**
- Consumes: source files as text.
- Produces: regression contract asserting cashier core flow has no `ModalSurface`, HPP recipe rows do not render ingredient identity with `<select>`, and search picker markers exist.

- [ ] **Step 1: Write the failing test**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname);
const read = (name: string) => fs.readFileSync(path.join(root, name), 'utf8');

describe('Usaha Operations UX V2 contracts', () => {
  test('cashier core workflow no longer uses blocking ModalSurface', () => {
    expect(read('QuickSaleWorkspace.tsx')).not.toContain('<ModalSurface');
    expect(read('QuickSaleProductConfigurator.tsx')).not.toContain('<ModalSurface');
  });

  test('HPP uses searchable pickers and stable ingredient rows', () => {
    const source = read('DurableHppWorkspace.tsx');
    expect(source).toContain('Cari produk');
    expect(source).toContain('Cari bahan');
    expect(source).toContain('Ganti bahan dengan hapus lalu tambah lagi');
    expect(source).not.toContain('value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}');
  });
});
```

- [ ] **Step 2: Verify RED**

Run in CI/workflow: `npm test -- operations-ux-v2.contract.test.ts`

Expected: FAIL because the current cashier/configurator use `ModalSurface` and HPP does not yet expose the required search/stable-row markers.

- [ ] **Step 3: Commit RED tests**

Commit message: `test: define operations UX v2 contracts`

---

### Task 2: Add explicit order transition model

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/order-workflow.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/order-workflow.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` from `@/lib/portal-types`.
- Produces:
  - `nextOrderAction(status: OrderStatus): { label: string; nextStatus: OrderStatus } | null`
  - `orderStatusFilter(status: OrderStatus, filter: 'semua' | OrderStatus): boolean`

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, test } from 'vitest';
import { nextOrderAction, orderStatusFilter } from './order-workflow';

describe('order workflow', () => {
  test('maps each active status to one explicit next action', () => {
    expect(nextOrderAction('baru')).toEqual({ label: 'Terima & proses', nextStatus: 'diproses' });
    expect(nextOrderAction('diproses')).toEqual({ label: 'Tandai siap', nextStatus: 'siap kirim' });
    expect(nextOrderAction('siap kirim')).toEqual({ label: 'Selesaikan', nextStatus: 'selesai' });
    expect(nextOrderAction('selesai')).toBeNull();
  });

  test('filters statuses without a generic dropdown model', () => {
    expect(orderStatusFilter('baru', 'semua')).toBe(true);
    expect(orderStatusFilter('baru', 'baru')).toBe(true);
    expect(orderStatusFilter('baru', 'diproses')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- order-workflow.test.ts`
Expected: FAIL because `order-workflow.ts` does not exist.

- [ ] **Step 3: Implement minimal helpers**

```ts
import type { OrderStatus } from '@/lib/portal-types';

export type OrderFilter = 'semua' | OrderStatus;

export function nextOrderAction(status: OrderStatus) {
  if (status === 'baru') return { label: 'Terima & proses', nextStatus: 'diproses' as const };
  if (status === 'diproses') return { label: 'Tandai siap', nextStatus: 'siap kirim' as const };
  if (status === 'siap kirim') return { label: 'Selesaikan', nextStatus: 'selesai' as const };
  return null;
}

export function orderStatusFilter(status: OrderStatus, filter: OrderFilter) {
  return filter === 'semua' || status === filter;
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- order-workflow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add explicit order workflow helpers`

---

### Task 3: Refactor cashier into persistent workspace

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleProductConfigurator.tsx`
- Test: `frontend/apps/usaha/src/components/business-control/operations-ux-v2.contract.test.ts`
- Test: existing `QuickSaleWorkspace.test.ts`, `quick-sale.test.ts`

**Interfaces:**
- Consumes: existing `buildQuickSaleRequest`, receipt helpers, tender helpers, product modifier helpers.
- Produces: persistent side-workspace states `cart | configure | checkout | receipt` without `ModalSurface`.

- [ ] **Step 1: Replace modal state with explicit workspace mode**

Use a discriminated state such as:

```ts
type WorkspaceMode = 'cart' | 'configure' | 'checkout' | 'receipt';
const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('cart');
```

Keep current cart lines, idempotency, payment method, cash tender, receipt, search, category filter, and advanced metadata states.

- [ ] **Step 2: Render desktop as catalog + persistent side panel**

Use one responsive grid where the left catalog remains mounted and the right panel renders configuration/cart/checkout/receipt based on `workspaceMode`.

- [ ] **Step 3: Render mobile as stage views, not `<dialog>`**

Keep catalog as primary stage and show a sticky cart CTA. `cart`, `configure`, and `checkout` render as normal full-width sections with back controls. Do not call `showModal()`.

- [ ] **Step 4: Convert `QuickSaleProductConfigurator` to an embeddable panel**

Remove `ModalSurface` and make it return only the configurator surface. Keep radio/checkbox validation, quantity, notes, preview price, and confirm behavior.

- [ ] **Step 5: Preserve transaction semantics**

Do not change the POST endpoint, `Idempotency-Key`, payload builder, payment method values, or receipt builder.

- [ ] **Step 6: Verify tests**

Run:
- `npm test -- operations-ux-v2.contract.test.ts`
- `npm test -- QuickSaleWorkspace.test.ts`
- `npm test -- quick-sale.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: make cashier workflow non-blocking`

---

### Task 4: Refactor HPP recipe editor away from repeated selects

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx`
- Test: `frontend/apps/usaha/src/components/business-control/operations-ux-v2.contract.test.ts`
- Test: existing costing tests.

**Interfaces:**
- Consumes: existing recipe API, `calculateRecipeCost`, `calculateProductionCapacity`.
- Produces: searchable product picker, searchable ingredient picker, stable ingredient rows.

- [ ] **Step 1: Add product search state**

```ts
const [productSearch, setProductSearch] = useState('');
const filteredProducts = products.filter(item => item.name.toLowerCase().includes(productSearch.trim().toLowerCase()));
```

Expose input placeholder/label `Cari produk` and clickable product results/cards.

- [ ] **Step 2: Replace add-ingredient select with search picker**

Add `ingredientSearch` and filter only unused ingredients. Clicking a result appends one recipe item directly.

- [ ] **Step 3: Make recipe rows stable**

Render ingredient name as text, quantity input with unit suffix, cost, optional waste override, and remove button. Do not render an ingredient identity `<select>` inside an existing row. Include helper copy `Ganti bahan dengan hapus lalu tambah lagi`.

- [ ] **Step 4: Preserve summary and audit behavior**

Keep HPP, price, gross profit, margin, production capacity, save, delete/retire reason capture, and history loading behavior unchanged.

- [ ] **Step 5: Verify tests**

Run:
- `npm test -- operations-ux-v2.contract.test.ts`
- `npm test -- src/lib/business-control/costing.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: simplify HPP recipe editing`

---

### Task 5: Upgrade Orders view to operational inbox

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/OrderInboxWorkspace.tsx`
- Test: `frontend/apps/usaha/src/lib/business-control/order-workflow.test.ts`

**Interfaces:**
- Consumes: `OrderRecord[]`, `canManageOrders`, `nextOrderAction`, `orderStatusFilter`.
- Produces: status chips, selected-order detail surface, contextual next action display.

- [ ] **Step 1: Extract order inbox UI**

`OrderInboxWorkspace` receives:

```ts
type Props = {
  orders: OrderRecord[];
  canManageOrders: boolean;
};
```

Use local selection/filter UI. Do not invent backend mutation endpoints that do not exist.

- [ ] **Step 2: Add visible filters**

Render buttons: `Semua`, `Baru`, `Diproses`, `Siap`, `Selesai`. Use `orderStatusFilter`.

- [ ] **Step 3: Add persistent detail/action workspace**

Selecting an order reveals buyer, channel, item summary, amount, status, and the contextual action label from `nextOrderAction`. If no server mutation contract exists, label the action as the expected operational next step without issuing a fake mutation.

- [ ] **Step 4: Replace the route's passive order list**

Keep route tabs and metrics, but render `OrderInboxWorkspace` for the Pesanan tab.

- [ ] **Step 5: Verify**

Run:
- `npm test -- order-workflow.test.ts`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: turn orders into operational inbox`

---

### Task 6: Full frontend verification and PR

**Files:**
- No production file changes unless required to fix verification failures.

**Interfaces:**
- Consumes: all changes from Tasks 1-5.
- Produces: verified branch and reviewable PR.

- [ ] **Step 1: Run complete Usaha test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Inspect branch diff**

Confirm changes are limited to the spec/plan, Usaha business-control helpers/components, and orders route. Verify no secrets, generated artifacts, migrations, or unrelated files changed.

- [ ] **Step 6: Open PR**

Title: `feat(usaha): operations UX v2`

PR body must summarize:
- persistent non-blocking cashier workflow;
- simplified searchable HPP editor;
- operational Orders inbox;
- preserved sale idempotency/API/audit behavior;
- verification results.
