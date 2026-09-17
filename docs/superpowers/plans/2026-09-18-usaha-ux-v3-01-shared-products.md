# Usaha UX V3 — Shared Primitives and Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish reusable Usaha-local interaction primitives and replace blocking product management with a persistent product workspace while preserving current product and stock API semantics.

**Architecture:** New primitives live only in `frontend/apps/usaha`. Product selection is URL-addressable through `?edit=<productId>` so refresh/back navigation remain predictable. Desktop keeps the product list visible beside the editor; mobile hides the list while editing and exposes an explicit back link. Product detail updates continue through the existing product PATCH route and stock changes continue through the existing inventory PATCH route.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS, Vitest 3, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Core workflows must not depend on blocking long-form modals.
- 2–6 stable choices use visible chips/buttons/cards.
- Large entity lists use searchable pickers.
- Existing permissions, API payloads, stock semantics, and audit behavior remain authoritative.
- `ModalSurface` remains allowed only for short sensitive confirmations.
- No cross-repo design-system rewrite; primitives stay inside `frontend/apps/usaha`.

---

### Task 1: Add `ChoiceChips` and `EffectPreview`

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/ChoiceChips.tsx`
- Create: `frontend/apps/usaha/src/components/interaction/EffectPreview.tsx`
- Create: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `ChoiceChips<T extends string>({ value, options, onChange, disabled?, ariaLabel })`.
- Produces: `EffectPreview({ items, ariaLabel? })`, with `items: Array<{ label: string; value: string; tone?: 'default' | 'positive' | 'warning' }>`.

- [ ] **Step 1: Write the failing rendering tests**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceChips } from './ChoiceChips';
import { EffectPreview } from './EffectPreview';

describe('Usaha UX V3 primitives', () => {
  it('renders small choices without a select', () => {
    const html = renderToStaticMarkup(
      <ChoiceChips
        value="owned"
        ariaLabel="Sumber barang"
        onChange={() => {}}
        options={[
          { value: 'owned', label: 'Milik sendiri' },
          { value: 'consignment', label: 'Titipan' },
        ]}
      />,
    );
    expect(html).toContain('Milik sendiri');
    expect(html).toContain('Titipan');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('<select');
  });

  it('renders business effects as explicit label/value pairs', () => {
    const html = renderToStaticMarkup(
      <EffectPreview items={[
        { label: 'Stok', value: '+2 kg', tone: 'positive' },
        { label: 'Uang keluar', value: 'Rp60.000' },
      ]} />,
    );
    expect(html).toContain('+2 kg');
    expect(html).toContain('Rp60.000');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
```

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement `ChoiceChips`**

```tsx
export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={selected ? 'merchant-chip merchant-chip-active' : 'merchant-chip'}
          >
            <span>{option.label}</span>
            {option.description ? (
              <span className="block text-[11px] font-normal opacity-80">{option.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement `EffectPreview`**

```tsx
const toneClass = {
  default: 'text-portal-ink',
  positive: 'text-portal-forest',
  warning: 'text-portal-ember',
} as const;

export function EffectPreview({
  items,
  ariaLabel = 'Dampak',
}: {
  items: Array<{
    label: string;
    value: string;
    tone?: keyof typeof toneClass;
  }>;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className="grid gap-2 sm:grid-cols-2">
      {items.map(item => (
        <div key={item.label} className="rounded-xl bg-[#fafbf9] px-3 py-2.5">
          <p className="text-[11px] text-portal-soft">{item.label}</p>
          <p className={`mt-0.5 text-sm font-black ${toneClass[item.tone ?? 'default']}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the primitive test and typecheck**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/interaction/ChoiceChips.tsx src/components/interaction/EffectPreview.tsx src/components/interaction/usaha-ux-v3-primitives.test.tsx
git commit -m "feat(usaha): add UX V3 choice and effect primitives"
```

### Task 2: Add the reusable `SearchPicker`

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/SearchPicker.tsx`
- Modify: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `SearchPicker<T>({ items, value, query, onQueryChange, onChange, getKey, getLabel, getMeta?, placeholder, emptyLabel, disabled?, ariaLabel })`.
- This picker filters an in-memory collection. Remote search remains feature-specific.

- [ ] **Step 1: Add the failing test**

```tsx
import { SearchPicker } from './SearchPicker';

it('renders searchable entity choices without a select', () => {
  const html = renderToStaticMarkup(
    <SearchPicker
      items={[{ id: 'a', name: 'Alpukat' }, { id: 'b', name: 'Mangga' }]}
      value="a"
      query=""
      onQueryChange={() => {}}
      onChange={() => {}}
      getKey={item => item.id}
      getLabel={item => item.name}
      placeholder="Cari bahan"
      emptyLabel="Tidak ditemukan"
      ariaLabel="Pilih bahan"
    />,
  );
  expect(html).toContain('Cari bahan');
  expect(html).toContain('Alpukat');
  expect(html).toContain('role="listbox"');
  expect(html).not.toContain('<select');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
```

Expected: FAIL because `SearchPicker` is missing.

- [ ] **Step 3: Implement the typed picker**

```tsx
export type SearchPickerProps<T> = {
  items: T[];
  value: string;
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (key: string) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getMeta?: (item: T) => string;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  ariaLabel: string;
};

export function SearchPicker<T>({
  items,
  value,
  query,
  onQueryChange,
  onChange,
  getKey,
  getLabel,
  getMeta,
  placeholder,
  emptyLabel,
  disabled = false,
  ariaLabel,
}: SearchPickerProps<T>) {
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const visible = needle
    ? items.filter(item => `${getLabel(item)} ${getMeta?.(item) ?? ''}`.toLocaleLowerCase('id-ID').includes(needle))
    : items;

  return (
    <div aria-label={ariaLabel}>
      <input
        value={query}
        disabled={disabled}
        onChange={event => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="portal-input w-full"
      />
      <div role="listbox" className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-portal-line bg-white">
        {visible.length ? visible.map(item => {
          const key = getKey(item);
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(key)}
              className="block w-full border-b border-portal-line px-3 py-2.5 text-left last:border-b-0"
            >
              <span className="block text-sm font-bold text-portal-ink">{getLabel(item)}</span>
              {getMeta ? <span className="text-xs text-portal-soft">{getMeta(item)}</span> : null}
            </button>
          );
        }) : <p className="px-3 py-4 text-sm text-portal-soft">{emptyLabel}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/interaction/SearchPicker.tsx src/components/interaction/usaha-ux-v3-primitives.test.tsx
git commit -m "feat(usaha): add searchable entity picker"
```

### Task 3: Build the non-blocking product editor

**Files:**
- Create: `frontend/apps/usaha/src/components/forms/ProductEditorWorkspace.tsx`
- Create: `frontend/apps/usaha/src/components/forms/product-editor-v3.contract.test.ts`
- Modify: `frontend/apps/usaha/src/components/forms/ProductManageForm.tsx`

**Interfaces:**
- Produces: `ProductEditorWorkspace({ businessId, product }: { businessId: string; product: ProductRecord })`.
- Product detail PATCH body remains `{ name, category, priceLabel, status, minStockAlert, stockUnit }`.
- Stock PATCH body remains `{ stockCount, reason: 'manual_adjustment' }`.

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const editorPath = 'src/components/forms/ProductEditorWorkspace.tsx';

describe('product editor V3', () => {
  it('is non-blocking and preserves product/stock endpoints', () => {
    const source = readFileSync(editorPath, 'utf8');
    expect(source).not.toContain('ModalSurface');
    expect(source).toContain(`/products/${'${product.id}'}`);
    expect(source).toContain(`/products/${'${product.id}'}/inventory`);
    expect(source).toContain("reason: 'manual_adjustment'");
    expect(source).toContain('ProductModifierEditor');
    expect(source).toContain('ChoiceChips');
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts
```

Expected: FAIL because `ProductEditorWorkspace.tsx` does not exist.

- [ ] **Step 3: Implement state and the exact mutation handlers**

```tsx
'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { ProductModifierEditor } from '@/components/forms/ProductModifierEditor';
import type { ProductRecord } from '@/lib/portal-types';

type Props = { businessId: string; product: ProductRecord };

function rupiahNumber(priceLabel: string) {
  return priceLabel.replace(/\D/g, '');
}

export function ProductEditorWorkspace({ businessId, product }: Props) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [priceRupiah, setPriceRupiah] = useState(rupiahNumber(product.priceLabel));
  const [status, setStatus] = useState<'live' | 'draft'>(product.status);
  const [stockCount, setStockCount] = useState(product.stockCount?.toString() ?? '');
  const [minStockAlert, setMinStockAlert] = useState(product.minStockAlert?.toString() ?? '');
  const [stockUnit, setStockUnit] = useState(product.stockUnit || 'pcs');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error || 'Perubahan belum berhasil disimpan.');
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPrice = Number(priceRupiah);
    if (name.trim().length < 2 || !Number.isSafeInteger(normalizedPrice) || normalizedPrice <= 0) {
      setError('Periksa nama dan harga produk.');
      return;
    }
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}`, {
        name: name.trim(),
        category: category.trim(),
        priceLabel: `Rp${new Intl.NumberFormat('id-ID').format(normalizedPrice)}`,
        status,
        minStockAlert: minStockAlert.trim() ? Number(minStockAlert) : null,
        stockUnit: stockUnit.trim(),
      });
      setSuccess('Detail produk tersimpan.');
      startTransition(() => router.refresh());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Perubahan belum berhasil disimpan.');
    } finally {
      setPending(false);
    }
  }

  async function saveStock() {
    const normalizedStock = stockCount.trim() ? Number(stockCount) : null;
    if (normalizedStock !== null && (!Number.isFinite(normalizedStock) || normalizedStock < 0)) {
      setError('Jumlah stok harus nol atau lebih.');
      return;
    }
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}/inventory`, {
        stockCount: normalizedStock,
        reason: 'manual_adjustment',
      });
      setSuccess('Stok diperbarui.');
      startTransition(() => router.refresh());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Stok belum berhasil diperbarui.');
    } finally {
      setPending(false);
    }
  }
```

- [ ] **Step 4: Render the workspace sections explicitly**

Continue the same component with this structure:

```tsx
  return (
    <section className="merchant-surface-bordered p-4 sm:p-5">
      <div className="border-b border-portal-line pb-4">
        <BusinessImageCropUpload
          businessId={businessId}
          productId={product.id}
          kind="product"
          currentUrl={product.imageUrl}
          label="Foto produk / menu"
          description="Ganti foto lalu crop 1:1. Perubahan langsung tersimpan ke katalog publik."
        />
      </div>

      <form onSubmit={saveProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Nama
          <input className="portal-input" value={name} onChange={event => setName(event.target.value)} maxLength={160} required />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Kategori
          <input className="portal-input" value={category} onChange={event => setCategory(event.target.value)} maxLength={120} required />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Harga (Rp)
          <input className="portal-input" type="number" min="1" step="1" value={priceRupiah} onChange={event => setPriceRupiah(event.target.value)} required />
        </label>
        <div className="grid gap-1.5 text-xs font-semibold text-portal-ink">Status
          <ChoiceChips value={status} onChange={setStatus} ariaLabel="Status produk" options={[
            { value: 'live', label: 'Aktif' },
            { value: 'draft', label: 'Diarsipkan' },
          ]} />
        </div>
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Batas stok tipis
          <input className="portal-input" type="number" min="0" step="any" value={minStockAlert} onChange={event => setMinStockAlert(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Satuan
          <input className="portal-input" value={stockUnit} onChange={event => setStockUnit(event.target.value)} maxLength={40} required />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="portal-button-primary"><Save className="h-4 w-4" /> {pending ? 'Menyimpan...' : 'Simpan detail'}</button>
        </div>
      </form>

      <div className="mt-5 border-t border-portal-line pt-4">
        <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Stok saat ini
          <input className="portal-input" type="number" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Kosong = belum diketahui" />
        </label>
        <button type="button" onClick={saveStock} disabled={pending} className="portal-button-secondary mt-3"><Save className="h-4 w-4" /> Update stok</button>
      </div>

      <div className="mt-5 border-t border-portal-line pt-4">
        <ProductModifierEditor businessId={businessId} productId={product.id} />
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-portal-ember">{error}</p> : null}
      {success ? <p className="mt-3 text-sm font-semibold text-portal-forest">{success}</p> : null}
    </section>
  );
}
```

- [ ] **Step 5: Convert `ProductManageForm.tsx` into a temporary compatibility export**

```tsx
'use client';

export { ProductEditorWorkspace as ProductManageForm } from './ProductEditorWorkspace';
```

- [ ] **Step 6: Run the product-editor contract and typecheck**

```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/forms/ProductEditorWorkspace.tsx src/components/forms/ProductManageForm.tsx src/components/forms/product-editor-v3.contract.test.ts
git commit -m "feat(usaha): add non-blocking product editor"
```

### Task 4: Wire the products page to list + persistent editor

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify: `frontend/apps/usaha/src/components/forms/product-editor-v3.contract.test.ts`

**Interfaces:**
- Products page accepts `searchParams.edit?: string`.
- Selecting a product changes the URL; no product row opens `ProductManageForm` inside nested `<details>`.

- [ ] **Step 1: Extend the contract test before production changes**

```ts
const page = readFileSync('src/app/(portal)/businesses/[businessId]/products/page.tsx', 'utf8');
expect(page).toContain('query.edit');
expect(page).toContain('ProductEditorWorkspace');
expect(page).toContain('Kelola');
expect(page).not.toContain('<ProductManageForm');
```

Run:
```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Extend page params and resolve the selected product**

```ts
type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; stock?: string; edit?: string }>;
};

const selectedProduct = business.products.find(product => product.id === query.edit) ?? null;
```

Import:

```ts
import { ProductEditorWorkspace } from '@/components/forms/ProductEditorWorkspace';
```

Remove the `ProductManageForm` import.

- [ ] **Step 3: Replace the row action with an edit link while preserving filters**

Inside `visibleProducts.map`, construct params and render the link:

```tsx
const editParams = new URLSearchParams();
if (query.q) editParams.set('q', query.q);
if (attentionOnly) editParams.set('stock', 'attention');
editParams.set('edit', product.id);

<Link
  href={`/businesses/${business.id}/products?${editParams.toString()}`}
  className="portal-button-ghost shrink-0"
>
  Kelola
</Link>
```

Delete only the old row `<details>` block that wrapped `ProductManageForm`; keep the existing product thumbnail/name/price/stock/status markup unchanged.

- [ ] **Step 4: Wrap the existing filter + list area and render the editor as the second column**

Immediately before the existing search form, open:

```tsx
<div className={selectedProduct ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]' : ''}>
  <div className={selectedProduct ? 'hidden space-y-3 lg:block' : 'space-y-3'}>
```

Close that first `<div>` immediately after the existing product-list `<section>`. Then render:

```tsx
{selectedProduct ? (
  <div className="min-w-0">
    <Link
      href={`/businesses/${business.id}/products`}
      className="portal-button-ghost mb-3 lg:hidden"
    >
      ← Kembali ke produk
    </Link>
    <ProductEditorWorkspace businessId={business.id} product={selectedProduct} />
  </div>
) : null}
</div>
```

Keep `Tambah produk` and HPP/channel navigation below this workspace exactly where they currently appear.

- [ ] **Step 5: Run targeted tests and typecheck**

```bash
npm test -- src/components/forms/product-editor-v3.contract.test.ts src/components/business-control/operations-ux-v2.contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(portal)'/businesses/'[businessId]'/products/page.tsx src/components/forms/product-editor-v3.contract.test.ts
git commit -m "feat(usaha): wire persistent product workspace"
```

### Task 5: Replace add-product small choices with `ChoiceChips`

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/ProductQuickFormSimple.tsx`
- Create: `frontend/apps/usaha/src/components/forms/product-quick-v3.contract.test.ts`

**Interfaces:**
- Preserve POST `/api/businesses/${businessId}/products` payload fields and defaults.

- [ ] **Step 1: Write the failing contract**

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('src/components/forms/ProductQuickFormSimple.tsx', 'utf8');

it('uses visible choices for the compact product enums', () => {
  expect(source).toContain('ChoiceChips');
  expect(source).not.toMatch(/<select[^>]*value=\{category\}/);
  expect(source).not.toMatch(/<select[^>]*value=\{sourceType\}/);
  expect(source).not.toMatch(/<select[^>]*value=\{stockMode\}/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/product-quick-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Replace the three selects**

Import `ChoiceChips`, then render:

```tsx
<ChoiceChips
  value={category}
  onChange={setCategory}
  ariaLabel="Kategori produk"
  options={categoryOptions.map(value => ({ value, label: value }))}
/>

<ChoiceChips
  value={sourceType}
  onChange={setSourceType}
  ariaLabel="Sumber barang"
  options={sourceTypeOptions.map(option => ({ value: option.value, label: option.label }))}
/>

<ChoiceChips
  value={stockMode}
  onChange={setStockMode}
  ariaLabel="Cara menghitung stok"
  options={[
    { value: 'manual', label: 'Sudah dihitung' },
    { value: 'estimated', label: 'Masih perkiraan' },
  ]}
/>
```

Keep `ownerLabel` and `consignmentTerms` conditional on `sourceType === 'consignment'`.

- [ ] **Step 4: Run targeted and full Usaha tests plus typecheck**

```bash
npm test -- src/components/forms/product-quick-v3.contract.test.ts
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/ProductQuickFormSimple.tsx src/components/forms/product-quick-v3.contract.test.ts
git commit -m "feat(usaha): simplify product setup choices"
```

### Task 6: Verify Batch 1

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

- [ ] **Step 2: Search for the forbidden product-edit modal path**

```bash
rg "ModalSurface|ProductManageForm" src/components/forms/ProductEditorWorkspace.tsx src/app/'(portal)'/businesses/'[businessId]'/products/page.tsx
```

Expected: no `ModalSurface`; products page has no `ProductManageForm` usage.

- [ ] **Step 3: Review API-related diff**

```bash
git diff main...HEAD -- src/components/forms/ProductEditorWorkspace.tsx src/components/forms/ProductQuickFormSimple.tsx
```

Expected: product and inventory API paths/payload field names match their pre-V3 behavior.
