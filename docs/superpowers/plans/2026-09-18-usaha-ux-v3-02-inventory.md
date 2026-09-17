# Usaha UX V3 — Inventory Purchase and Yield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn stock purchase and real-yield recording into sentence-like merchant workflows with searchable entity selection and visible business-effect previews.

**Architecture:** Reuse `SearchPicker`, `ChoiceChips`, and `EffectPreview` from the shared-products plan. Keep `StockPurchaseYieldWorkspace` on the current inventory route and preserve all existing `/api/businesses/${businessId}/wave2` action names and payload fields.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Purchase/yield writes keep existing Wave2 semantics.
- Common purchase flow must not require a long dropdown.
- Date and note remain progressive details.
- Preview values come from existing `summarizeStockPurchase` and `previewObservedYield` helpers.
- Read-only users cannot mutate.

---

### Task 1: Lock the inventory V3 contract

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/stock-purchase-yield-v3.contract.test.ts`
- Modify later: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/StockPurchaseYieldWorkspace.tsx', 'utf8');

describe('inventory UX V3', () => {
  it('uses searchable entity pickers and visible compact choices', () => {
    expect(source).toContain('SearchPicker');
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('EffectPreview');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{ingredientId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{yieldIngredientId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{yieldProductId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryProductId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryIngredientId\}/);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
```

Expected: FAIL because current entity controls still use `<select>`.

- [ ] **Step 3: Commit the RED contract**

```bash
git add src/components/business-control/stock-purchase-yield-v3.contract.test.ts
git commit -m "test(usaha): define inventory UX V3 contract"
```

### Task 2: Simplify the purchase flow

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

**Interfaces:**
- Preserve `savePurchase()` payload exactly: `action: 'purchase'`, `ingredient_id`, `stock_quantity_delta`, `total_amount`, `account_key`, `occurred_on`, `note`.

- [ ] **Step 1: Add shared imports and ingredient-query state**

```tsx
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { EffectPreview } from '@/components/interaction/EffectPreview';
import { SearchPicker } from '@/components/interaction/SearchPicker';

const [ingredientQuery, setIngredientQuery] = useState('');
```

- [ ] **Step 2: Replace the purchase ingredient select**

```tsx
<SearchPicker
  items={ingredients}
  value={ingredientId}
  query={ingredientQuery}
  onQueryChange={setIngredientQuery}
  onChange={setIngredientId}
  getKey={item => item.id}
  getLabel={item => item.name}
  getMeta={item => item.purchase_unit}
  placeholder="Cari bahan / kemasan"
  emptyLabel="Bahan tidak ditemukan"
  ariaLabel="Pilih bahan belanja"
  disabled={!canManage}
/>
```

- [ ] **Step 3: Replace payment-account select with visible choices**

```tsx
<ChoiceChips
  value={accountKey}
  onChange={setAccountKey}
  ariaLabel="Dibayar lewat"
  disabled={!canManage}
  options={[
    { value: 'cash', label: 'Kas' },
    { value: 'bank', label: 'Bank' },
    { value: 'ewallet', label: 'E-wallet' },
    { value: 'payable', label: 'Utang usaha' },
  ]}
/>
```

Keep this control inside `Detail opsional` only if product UX review shows payment source is rarely changed; otherwise place it directly below amount. Do not change the posted `account_key` value.

- [ ] **Step 4: Replace the preview strip with `EffectPreview`**

```tsx
{purchasePreview.amountPerUnit !== null ? (
  <EffectPreview items={[
    {
      label: 'Stok bertambah',
      value: `+${purchasePreview.quantity.toLocaleString('id-ID')} ${selectedIngredient?.purchase_unit ?? ''}`,
      tone: 'positive',
    },
    {
      label: 'Biaya per unit',
      value: `${money.format(purchasePreview.amountPerUnit)}/${selectedIngredient?.purchase_unit ?? 'unit'}`,
    },
    {
      label: accountKey === 'payable' ? 'Utang bertambah' : 'Uang keluar',
      value: money.format(purchasePreview.totalAmount),
      tone: 'warning',
    },
  ]} />
) : null}
```

- [ ] **Step 5: Run typecheck and the source contract**

```bash
npm run typecheck
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
```

Expected: test remains RED only because yield/primary-material selects are not migrated yet; TypeScript must pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx
git commit -m "feat(usaha): simplify stock purchase workflow"
```

### Task 3: Make real-yield observation sentence-like

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

**Interfaces:**
- Preserve `saveYield()` payload and existing `previewObservedYield()` calculations.

- [ ] **Step 1: Add search state**

```tsx
const [yieldIngredientQuery, setYieldIngredientQuery] = useState('');
const [yieldProductQuery, setYieldProductQuery] = useState('');
```

- [ ] **Step 2: Replace yield ingredient selection**

```tsx
<SearchPicker
  items={ingredients}
  value={yieldIngredientId}
  query={yieldIngredientQuery}
  onQueryChange={setYieldIngredientQuery}
  onChange={next => {
    setYieldIngredientId(next);
    setInputUnit(ingredients.find(item => item.id === next)?.purchase_unit ?? 'kg');
  }}
  getKey={item => item.id}
  getLabel={item => item.name}
  getMeta={item => item.purchase_unit}
  placeholder="Cari bahan"
  emptyLabel="Bahan tidak ditemukan"
  ariaLabel="Pilih bahan hasil nyata"
  disabled={!canManage}
/>
```

- [ ] **Step 3: Replace optional product selection**

Render an explicit reset control and picker:

```tsx
<button
  type="button"
  onClick={() => setYieldProductId('')}
  disabled={!canManage}
  className={yieldProductId ? 'merchant-chip' : 'merchant-chip merchant-chip-active'}
>
  Tanpa produk tertentu
</button>

<SearchPicker
  items={products}
  value={yieldProductId}
  query={yieldProductQuery}
  onQueryChange={setYieldProductQuery}
  onChange={setYieldProductId}
  getKey={item => item.id}
  getLabel={item => item.name}
  placeholder="Cari produk (opsional)"
  emptyLabel="Produk tidak ditemukan"
  ariaLabel="Pilih produk hasil nyata"
  disabled={!canManage}
/>
```

- [ ] **Step 4: Add the human sentence preview**

```tsx
<p className="rounded-xl bg-[#fafbf9] px-3 py-2.5 text-sm font-bold text-portal-ink">
  {inputQuantity || '0'} {inputUnit}{' '}
  {ingredients.find(item => item.id === yieldIngredientId)?.name ?? 'bahan'} menghasilkan{' '}
  {outputUnits || '0'} {products.find(item => item.id === yieldProductId)?.name ?? 'unit hasil'}
</p>
```

Keep the existing average/evidence/confidence cards sourced from `summarizeObservedYield`.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx
git commit -m "feat(usaha): make yield observation searchable"
```

### Task 4: Replace primary-material selectors explicitly

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/stock-purchase-yield-v3.contract.test.ts`

**Interfaces:**
- Preserve `action: 'set_primary_material'`, `product_id`, `ingredient_id`, `expected_input_quantity`, `expected_output_units`.

- [ ] **Step 1: Add search state**

```tsx
const [primaryProductQuery, setPrimaryProductQuery] = useState('');
const [primaryIngredientQuery, setPrimaryIngredientQuery] = useState('');
```

- [ ] **Step 2: Replace the product selector with this exact picker**

```tsx
<SearchPicker
  items={products}
  value={primaryProductId}
  query={primaryProductQuery}
  onQueryChange={setPrimaryProductQuery}
  onChange={setPrimaryProductId}
  getKey={item => item.id}
  getLabel={item => item.name}
  placeholder="Cari produk"
  emptyLabel="Produk tidak ditemukan"
  ariaLabel="Pilih produk bahan utama"
  disabled={!canManage}
/>
```

- [ ] **Step 3: Replace the primary ingredient selector with this exact picker**

```tsx
<SearchPicker
  items={ingredients}
  value={primaryIngredientId}
  query={primaryIngredientQuery}
  onQueryChange={setPrimaryIngredientQuery}
  onChange={setPrimaryIngredientId}
  getKey={item => item.id}
  getLabel={item => item.name}
  getMeta={item => item.purchase_unit}
  placeholder="Cari bahan utama"
  emptyLabel="Bahan tidak ditemukan"
  ariaLabel="Pilih bahan utama"
  disabled={!canManage}
/>
```

Keep both pickers under `Pengaturan bahan utama` because this is advanced setup, not a daily purchase action.

- [ ] **Step 4: Run the full inventory contract and typecheck**

```bash
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx src/components/business-control/stock-purchase-yield-v3.contract.test.ts
git commit -m "feat(usaha): simplify primary material mapping"
```

### Task 5: Verify Batch 2

**Files:** No production changes expected.

- [ ] **Step 1: Run complete Usaha verification**

```bash
cd frontend/apps/usaha
npm run lint
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify Wave2 payload names were not changed**

```bash
rg "action: 'purchase'|action: 'create_yield_observation'|action: 'set_primary_material'|ingredient_id|stock_quantity_delta|total_amount|account_key|input_quantity|output_units|expected_input_quantity|expected_output_units" src/components/business-control/StockPurchaseYieldWorkspace.tsx
```

Expected: every existing action and required payload field remains present.
