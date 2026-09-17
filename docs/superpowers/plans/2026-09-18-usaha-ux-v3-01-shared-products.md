# Usaha UX V3 — Shared Primitives and Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the reusable Usaha UX V3 interaction primitives and remove blocking product-management workflows while keeping current product and inventory API semantics.

**Architecture:** Keep all new primitives local to `frontend/apps/usaha`. Product editing becomes a persistent page workspace selected through `?edit=<productId>`: desktop keeps the list visible beside the editor, while mobile shows the editor as the primary stage with an explicit back link. Existing product PATCH and inventory PATCH endpoints remain authoritative.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS, Vitest 3, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Core workflows must not depend on blocking long-form modals.
- 2–6 stable choices use visible chips/buttons/cards.
- Large entity lists use a searchable picker.
- Existing permissions, API payloads, audit rules, and inventory semantics remain authoritative.
- `ModalSurface` remains allowed only for short sensitive confirmations.
- No cross-repo design-system rewrite; primitives live inside `frontend/apps/usaha`.

---

### Task 1: Add the shared ChoiceChips and EffectPreview primitives

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/ChoiceChips.tsx`
- Create: `frontend/apps/usaha/src/components/interaction/EffectPreview.tsx`
- Test: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `ChoiceChips<T extends string>({ value, options, onChange, disabled?, ariaLabel })`
- Produces: `EffectPreview({ items, ariaLabel? })` where `items` is `Array<{ label: string; value: string; tone?: 'default' | 'positive' | 'warning' }>`.

- [ ] **Step 1: Write the failing primitive rendering tests**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceChips } from './ChoiceChips';
import { EffectPreview } from './EffectPreview';

describe('UX V3 primitives', () => {
  it('renders every small choice without a select', () => {
    const html = renderToStaticMarkup(
      <ChoiceChips value="owned" ariaLabel="Sumber barang" onChange={() => {}} options={[
        { value: 'owned', label: 'Milik sendiri' },
        { value: 'consignment', label: 'Titipan' },
      ]} />,
    );
    expect(html).toContain('Milik sendiri');
    expect(html).toContain('Titipan');
    expect(html).not.toContain('<select');
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders business effects as label/value pairs', () => {
    const html = renderToStaticMarkup(<EffectPreview items={[
      { label: 'Stok', value: '+2 kg', tone: 'positive' },
      { label: 'Uang keluar', value: 'Rp60.000' },
    ]} />);
    expect(html).toContain('+2 kg');
    expect(html).toContain('Rp60.000');
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:
```bash
cd frontend/apps/usaha
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
```
Expected: FAIL because `ChoiceChips.tsx` and `EffectPreview.tsx` do not exist.

- [ ] **Step 3: Implement the minimal primitives**

```tsx
export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };

export function ChoiceChips<T extends string>({ value, options, onChange, disabled = false, ariaLabel }: {
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
    {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value} disabled={disabled}
      onClick={() => onChange(option.value)}
      className={option.value === value ? 'merchant-chip merchant-chip-active' : 'merchant-chip'}>
      <span>{option.label}</span>{option.description ? <span className="block text-[11px] font-normal opacity-80">{option.description}</span> : null}
    </button>)}
  </div>;
}
```

```tsx
export function EffectPreview({ items, ariaLabel = 'Dampak' }: {
  items: Array<{ label: string; value: string; tone?: 'default' | 'positive' | 'warning' }>;
  ariaLabel?: string;
}) {
  return <div aria-label={ariaLabel} className="grid gap-2 sm:grid-cols-2">
    {items.map(item => <div key={item.label} className="rounded-xl bg-[#fafbf9] px-3 py-2.5">
      <p className="text-[11px] text-portal-soft">{item.label}</p><p className="mt-0.5 text-sm font-black text-portal-ink">{item.value}</p>
    </div>)}
  </div>;
}
```

- [ ] **Step 4: Re-run the test and verify GREEN**

Run the same command; expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/usaha/src/components/interaction
git commit -m "feat(usaha): add UX V3 choice and effect primitives"
```

### Task 2: Add the reusable SearchPicker primitive

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/SearchPicker.tsx`
- Modify test: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `SearchPicker<T>({ items, value, query, onQueryChange, onChange, getKey, getLabel, getMeta?, placeholder, emptyLabel, disabled?, ariaLabel })`.
- The component filters the supplied in-memory collection; remote search remains owned by feature-specific forms such as team invitations.

- [ ] **Step 1: Add a failing SearchPicker contract test**

```tsx
it('renders a selected entity and searchable alternatives without select markup', () => {
  const html = renderToStaticMarkup(<SearchPicker
    items={[{ id: 'a', name: 'Alpukat' }, { id: 'b', name: 'Mangga' }]}
    value="a" query="" onQueryChange={() => {}} onChange={() => {}}
    getKey={item => item.id} getLabel={item => item.name}
    placeholder="Cari bahan" emptyLabel="Tidak ditemukan" ariaLabel="Pilih bahan"
  />);
  expect(html).toContain('Cari bahan');
  expect(html).toContain('Alpukat');
  expect(html).not.toContain('<select');
});
```

- [ ] **Step 2: Run test and verify RED**

Run the primitive test command; expected: FAIL because `SearchPicker` is missing.

- [ ] **Step 3: Implement SearchPicker with explicit input/listbox semantics**

```tsx
export function SearchPicker<T>({ items, value, query, onQueryChange, onChange, getKey, getLabel, getMeta, placeholder, emptyLabel, disabled = false, ariaLabel }: SearchPickerProps<T>) {
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const visible = needle ? items.filter(item => `${getLabel(item)} ${getMeta?.(item) ?? ''}`.toLocaleLowerCase('id-ID').includes(needle)) : items;
  return <div aria-label={ariaLabel}>
    <input value={query} disabled={disabled} onChange={event => onQueryChange(event.target.value)} placeholder={placeholder} className="portal-input w-full" />
    <div role="listbox" className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-portal-line bg-white">
      {visible.length ? visible.map(item => {
        const key = getKey(item); const selected = key === value;
        return <button key={key} type="button" role="option" aria-selected={selected} disabled={disabled} onClick={() => onChange(key)} className="block w-full border-b border-portal-line px-3 py-2.5 text-left last:border-b-0">
          <span className="block text-sm font-bold text-portal-ink">{getLabel(item)}</span>{getMeta ? <span className="text-xs text-portal-soft">{getMeta(item)}</span> : null}
        </button>;
      }) : <p className="px-3 py-4 text-sm text-portal-soft">{emptyLabel}</p>}
    </div>
  </div>;
}
```

- [ ] **Step 4: Run primitive tests and typecheck**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/usaha/src/components/interaction
git commit -m "feat(usaha): add searchable entity picker"
```

### Task 3: Replace product-management modal with an inline workspace

**Files:**
- Create: `frontend/apps/usaha/src/components/forms/ProductEditorWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify: `frontend/apps/usaha/src/components/forms/ProductManageForm.tsx`
- Test: `frontend/apps/usaha/src/components/forms/product-editor-v3.contract.test.ts`

**Interfaces:**
- Produces: `ProductEditorWorkspace({ businessId, product })` preserving current product PATCH and inventory PATCH request bodies.
- `ProductManageForm.tsx` becomes a compatibility re-export during this batch: `export { ProductEditorWorkspace as ProductManageForm } from './ProductEditorWorkspace';`.
- Products page accepts `searchParams.edit?: string` and resolves the selected product from `business.products`.

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/app/(portal)/businesses/[businessId]/products/page.tsx', 'utf8');
const editor = readFileSync('src/components/forms/ProductEditorWorkspace.tsx', 'utf8');

describe('product editor V3', () => {
  it('uses a persistent editor and no normal-edit ModalSurface', () => {
    expect(page).toContain('query.edit');
    expect(page).toContain('ProductEditorWorkspace');
    expect(editor).not.toContain('ModalSurface');
    expect(editor).toContain('/inventory');
    expect(editor).toContain('ProductModifierEditor');
  });
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts
```
Expected: FAIL because the new workspace does not exist.

- [ ] **Step 3: Extract the current product mutation logic into ProductEditorWorkspace**

Keep the existing `request`, `saveProduct`, and `saveStock` semantics. Render the form directly instead of an opener plus `ModalSurface`:

```tsx
export function ProductEditorWorkspace({ businessId, product }: Props) {
  // keep current state + request/saveProduct/saveStock logic
  return <section className="merchant-surface-bordered p-4 sm:p-5">
    <BusinessImageCropUpload businessId={businessId} productId={product.id} kind="product" currentUrl={product.imageUrl} label="Foto produk / menu" />
    <form onSubmit={saveProduct}>{/* name, price, category, status, threshold, unit */}</form>
    <section className="mt-5 border-t border-portal-line pt-4">{/* stock update */}</section>
    <ProductModifierEditor businessId={businessId} productId={product.id} />
  </section>;
}
```

Use `ChoiceChips` for status:

```tsx
<ChoiceChips value={status} onChange={setStatus} ariaLabel="Status produk" options={[
  { value: 'live', label: 'Aktif' }, { value: 'draft', label: 'Diarsipkan' },
]} />
```

- [ ] **Step 4: Change the products page to list + workspace**

Extend search params:

```ts
searchParams: Promise<{ q?: string; stock?: string; edit?: string }>;
const selectedProduct = business.products.find(product => product.id === query.edit) ?? null;
```

Render links as `/products?edit=<id>` while preserving current `q`/`stock` values. Use a desktop grid when selected:

```tsx
<div className={selectedProduct ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]' : ''}>
  <div className={selectedProduct ? 'hidden lg:block' : ''}>{/* existing product list */}</div>
  {selectedProduct ? <div><Link href={`/businesses/${business.id}/products`} className="lg:hidden">← Kembali ke produk</Link><ProductEditorWorkspace businessId={business.id} product={selectedProduct} /></div> : null}
</div>
```

- [ ] **Step 5: Preserve compatibility and run targeted tests**

Set `ProductManageForm.tsx` to the compatibility export. Run:

```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts src/components/business-control/operations-ux-v2.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/products/page.tsx frontend/apps/usaha/src/components/forms
git commit -m "feat(usaha): make product editing non-blocking"
```

### Task 4: Replace add-product small-choice selects with ChoiceChips

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/ProductQuickFormSimple.tsx`
- Test: `frontend/apps/usaha/src/components/forms/product-quick-v3.contract.test.ts`

**Interfaces:**
- Consumes: `ChoiceChips` from Task 1.
- Preserves POST `/api/businesses/${businessId}/products` payload fields and defaults.

- [ ] **Step 1: Write the failing source contract**

```ts
const source = readFileSync('src/components/forms/ProductQuickFormSimple.tsx', 'utf8');
expect(source).toContain('ChoiceChips');
expect(source).not.toMatch(/<select[^>]*value=\{sourceType\}/);
expect(source).not.toMatch(/<select[^>]*value=\{stockMode\}/);
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/product-quick-v3.contract.test.ts
```
Expected: FAIL on current selects.

- [ ] **Step 3: Replace source/status-style choices with visible controls**

```tsx
<ChoiceChips value={sourceType} onChange={setSourceType} ariaLabel="Sumber barang" options={sourceTypeOptions} />
<ChoiceChips value={stockMode} onChange={setStockMode} ariaLabel="Cara menghitung stok" options={[
  { value: 'manual', label: 'Sudah dihitung' },
  { value: 'estimated', label: 'Masih perkiraan' },
]} />
```

Render category as visible chips because the current list is five stable values:

```tsx
<ChoiceChips value={category} onChange={setCategory} ariaLabel="Kategori produk" options={categoryOptions.map(value => ({ value, label: value }))} />
```

- [ ] **Step 4: Run targeted tests, full Usaha tests, typecheck**

```bash
npm test -- src/components/forms/product-quick-v3.contract.test.ts
npm test
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/usaha/src/components/forms/ProductQuickFormSimple.tsx frontend/apps/usaha/src/components/forms/product-quick-v3.contract.test.ts
git commit -m "feat(usaha): simplify product setup choices"
```

### Task 5: Verify Batch 1 as an independently mergeable deliverable

**Files:** No production changes expected.

- [ ] **Step 1: Run Usaha lint, test, typecheck, and production build**

```bash
cd frontend/apps/usaha
npm run lint
npm test
npm run typecheck
npm run build
```
Expected: all commands exit 0.

- [ ] **Step 2: Inspect the diff for forbidden regressions**

```bash
git diff main...HEAD -- frontend/apps/usaha/src/app/'(portal)'/businesses/'[businessId]'/products frontend/apps/usaha/src/components/forms frontend/apps/usaha/src/components/interaction
```
Expected: normal product editing no longer imports/uses `ModalSurface`; API paths and payload semantics remain unchanged.

- [ ] **Step 3: Commit only if verification required a test/document adjustment**

Use a focused message such as:
```bash
git commit -am "test(usaha): lock product UX V3 contracts"
```
