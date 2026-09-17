# Usaha UX V3 — Inventory Purchase and Yield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn stock purchase and real-yield recording into sentence-like merchant workflows with searchable entity selection and visible business-effect previews.

**Architecture:** Reuse `SearchPicker`, `ChoiceChips`, and `EffectPreview` from the shared-products plan. Keep `StockPurchaseYieldWorkspace` on the existing inventory route and preserve the `/api/businesses/${businessId}/wave2` action payloads; only the interaction layer changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Purchase and yield writes keep existing Wave2 action names and durable side effects.
- Common purchase flow must not require a long dropdown.
- Date/note remain progressive details.
- Preview values must come from existing `summarizeStockPurchase` / `previewObservedYield` helpers.
- Permissions remain authoritative; read-only state cannot mutate.

---

### Task 1: Lock the inventory V3 interaction contract

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/stock-purchase-yield-v3.contract.test.ts`
- Modify later: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

**Interfaces:**
- Consumes shared `SearchPicker`, `ChoiceChips`, `EffectPreview`.

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/StockPurchaseYieldWorkspace.tsx', 'utf8');

describe('inventory UX V3', () => {
  it('uses searchable entity choice and visible payment choices', () => {
    expect(source).toContain('SearchPicker');
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('EffectPreview');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{ingredientId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{yieldIngredientId\}/);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
```
Expected: FAIL because the workspace still contains `<select>` entity controls.

- [ ] **Step 3: Commit the RED test only if the branch workflow requires reviewable TDD commits**

```bash
git add src/components/business-control/stock-purchase-yield-v3.contract.test.ts
git commit -m "test(usaha): define inventory UX V3 contract"
```

### Task 2: Replace purchase ingredient and payment selectors

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

**Interfaces:**
- Preserve `savePurchase()` payload:
  `action: 'purchase'`, `ingredient_id`, `stock_quantity_delta`, `total_amount`, `account_key`, `occurred_on`, `note`.

- [ ] **Step 1: Add local search state and SearchPicker for ingredients**

```tsx
const [ingredientQuery, setIngredientQuery] = useState('');

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

- [ ] **Step 2: Replace payment account select with four visible choices**

```tsx
<ChoiceChips value={accountKey} onChange={setAccountKey} ariaLabel="Dibayar lewat" options={[
  { value: 'cash', label: 'Kas' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'payable', label: 'Utang usaha' },
]} disabled={!canManage} />
```

- [ ] **Step 3: Replace the old preview strip with EffectPreview**

```tsx
{purchasePreview.amountPerUnit !== null ? <EffectPreview items={[
  { label: 'Stok bertambah', value: `+${purchasePreview.quantity.toLocaleString('id-ID')} ${selectedIngredient?.purchase_unit ?? ''}`, tone: 'positive' },
  { label: 'Biaya per unit', value: `${money.format(purchasePreview.amountPerUnit)}/${selectedIngredient?.purchase_unit ?? 'unit'}` },
  { label: accountKey === 'payable' ? 'Utang bertambah' : 'Uang keluar', value: money.format(purchasePreview.totalAmount) },
]} /> : null}
```

- [ ] **Step 4: Run targeted contract and typecheck**

```bash
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
npm run typecheck
```
Expected: contract may still fail only on yield selectors; TypeScript must pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx
git commit -m "feat(usaha): simplify stock purchase workflow"
```

### Task 3: Replace yield ingredient/product selectors with searchable pickers

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`

**Interfaces:**
- Preserve `saveYield()` payload and `previewObservedYield()` calculations.

- [ ] **Step 1: Add query state for yield entities**

```tsx
const [yieldIngredientQuery, setYieldIngredientQuery] = useState('');
const [yieldProductQuery, setYieldProductQuery] = useState('');
```

- [ ] **Step 2: Replace yield ingredient select**

```tsx
<SearchPicker items={ingredients} value={yieldIngredientId} query={yieldIngredientQuery}
  onQueryChange={setYieldIngredientQuery}
  onChange={next => { setYieldIngredientId(next); setInputUnit(ingredients.find(item => item.id === next)?.purchase_unit ?? 'kg'); }}
  getKey={item => item.id} getLabel={item => item.name} getMeta={item => item.purchase_unit}
  placeholder="Cari bahan" emptyLabel="Bahan tidak ditemukan" ariaLabel="Pilih bahan hasil nyata" disabled={!canManage} />
```

- [ ] **Step 3: Replace optional product select**

Add a button `Tanpa produk tertentu` that sets `yieldProductId` to `''`, then render:

```tsx
<SearchPicker items={products} value={yieldProductId} query={yieldProductQuery}
  onQueryChange={setYieldProductQuery} onChange={setYieldProductId}
  getKey={item => item.id} getLabel={item => item.name}
  placeholder="Cari produk (opsional)" emptyLabel="Produk tidak ditemukan" ariaLabel="Pilih produk hasil nyata" disabled={!canManage} />
```

- [ ] **Step 4: Show the sentence preview from the same state**

```tsx
<p className="rounded-xl bg-[#fafbf9] px-3 py-2.5 text-sm font-bold text-portal-ink">
  {inputQuantity || '0'} {inputUnit} {ingredients.find(item => item.id === yieldIngredientId)?.name ?? 'bahan'} menghasilkan {outputUnits || '0'} {products.find(item => item.id === yieldProductId)?.name ?? 'unit hasil'}
</p>
```

- [ ] **Step 5: Run targeted tests**

```bash
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
npm run typecheck
```
Expected: PASS except any remaining primary-material select assertions added in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx
git commit -m "feat(usaha): make yield observation searchable"
```

### Task 4: Simplify primary-material setup without changing its payload

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/StockPurchaseYieldWorkspace.tsx`
- Modify test: `frontend/apps/usaha/src/components/business-control/stock-purchase-yield-v3.contract.test.ts`

**Interfaces:**
- Preserve `action: 'set_primary_material'`, `product_id`, `ingredient_id`, `expected_input_quantity`, `expected_output_units`.

- [ ] **Step 1: Extend the failing contract**

```ts
expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryProductId\}/);
expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryIngredientId\}/);
```

Run targeted test; expected: FAIL.

- [ ] **Step 2: Add query states and replace both selectors with SearchPicker**

```tsx
const [primaryProductQuery, setPrimaryProductQuery] = useState('');
const [primaryIngredientQuery, setPrimaryIngredientQuery] = useState('');
```

Use the same `getKey` / `getLabel` mapping as Task 3. Keep this section under `Pengaturan bahan utama` details.

- [ ] **Step 3: Run targeted test and typecheck**

```bash
npm test -- src/components/business-control/stock-purchase-yield-v3.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/business-control/StockPurchaseYieldWorkspace.tsx src/components/business-control/stock-purchase-yield-v3.contract.test.ts
git commit -m "feat(usaha): simplify primary material mapping"
```

### Task 5: Verify Batch 2

**Files:** No production changes expected.

- [ ] **Step 1: Run full Usaha verification**

```bash
cd frontend/apps/usaha
npm run lint
npm test
npm run typecheck
npm run build
```
Expected: all exit 0.

- [ ] **Step 2: Diff-check API semantics**

```bash
git diff main...HEAD -- src/components/business-control/StockPurchaseYieldWorkspace.tsx
```
Expected: existing Wave2 `action` names and posted field names are unchanged; UI interaction and preview presentation are the substantive changes.
