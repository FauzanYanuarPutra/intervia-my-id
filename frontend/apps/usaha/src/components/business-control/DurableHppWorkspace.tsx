'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RotateCcw, Save, Trash2, TriangleAlert } from 'lucide-react';
import {
  calculateProductionCapacity,
  calculateRecipeCost,
  type IngredientCostInput,
} from '@/lib/business-control/costing';
import {
  recipeDraftFingerprint,
  validateHppRecipeDraft,
  type HppRecipeDraft,
  type HppRecipeItemDraft,
} from './hpp-recipe-state';

type Ingredient = {
  id: string;
  name: string;
  kind: string;
  purchase_unit: string;
  recipe_unit: string;
  conversion_factor: string | number;
  purchase_price_amount: number;
  purchase_quantity: string | number;
  yield_percent: string | number;
  waste_percent: string | number;
  stock_quantity: string | number;
};

type Product = {
  id: string;
  name: string;
  priceLabel?: string;
};

type RecipeItem = HppRecipeItemDraft;

type RecipeApiItem = {
  ingredient_id?: string | number;
  quantity?: string | number | null;
  waste_percent_override?: string | number | null;
};

type RecipeApiAggregate = {
  recipe?: {
    name?: string | null;
    servings?: string | number | null;
  };
  items?: RecipeApiItem[];
};

type Props = {
  businessId: string;
  ingredients: Ingredient[];
  products: Product[];
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function n(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceFromLabel(value?: string) {
  const parsed = Number((value ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function blankDraft(product?: Product): HppRecipeDraft {
  return {
    recipeName: product?.name ?? 'Resep utama',
    servings: 1,
    items: [],
  };
}

export function DurableHppWorkspace({ businessId, ingredients, products }: Props) {
  const initialDraft = blankDraft(products[0]);
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [recipeName, setRecipeName] = useState(initialDraft.recipeName);
  const [servings, setServings] = useState(initialDraft.servings);
  const [items, setItems] = useState<RecipeItem[]>(initialDraft.items);
  const [savedDraft, setSavedDraft] = useState<HppRecipeDraft>(initialDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const product = products.find(item => item.id === productId) ?? products[0];
  const sellingPrice = priceFromLabel(product?.priceLabel);
  const ingredientMap = useMemo(() => new Map(ingredients.map(item => [item.id, item])), [ingredients]);
  const currentDraft = useMemo<HppRecipeDraft>(() => ({ recipeName, servings, items }), [recipeName, servings, items]);
  const currentFingerprint = useMemo(() => recipeDraftFingerprint(currentDraft), [currentDraft]);
  const savedFingerprint = useMemo(() => recipeDraftFingerprint(savedDraft), [savedDraft]);
  const isDirty = currentFingerprint !== savedFingerprint;
  const validationErrors = useMemo(() => validateHppRecipeDraft(currentDraft), [currentDraft]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage('');
      try {
        const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, { cache: 'no-store' });
        if (response.status === 404) {
          if (!cancelled) {
            const selected = products.find(item => item.id === productId);
            const nextDraft = blankDraft(selected);
            setRecipeName(nextDraft.recipeName);
            setServings(nextDraft.servings);
            setItems(nextDraft.items);
            setSavedDraft(nextDraft);
          }
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Gagal memuat resep.');
        const aggregate = payload?.data?.recipe as RecipeApiAggregate | undefined;
        if (!cancelled && aggregate) {
          const nextDraft: HppRecipeDraft = {
            recipeName: aggregate.recipe?.name || product?.name || 'Resep utama',
            servings: n(aggregate.recipe?.servings) || 1,
            items: Array.isArray(aggregate.items) ? aggregate.items.map(item => ({
              ingredientId: String(item.ingredient_id ?? ''),
              quantity: n(item.quantity),
              wastePercentOverride: item.waste_percent_override === null || item.waste_percent_override === undefined ? null : n(item.waste_percent_override),
            })).filter(item => item.ingredientId) : [],
          };
          setRecipeName(nextDraft.recipeName);
          setServings(nextDraft.servings);
          setItems(nextDraft.items);
          setSavedDraft(nextDraft);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Gagal memuat resep.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId, productId, product?.name, products]);

  const missingCostIngredients = useMemo(() => {
    const missing = new Map<string, string>();
    for (const item of items) {
      const ingredient = ingredientMap.get(item.ingredientId);
      if (!ingredient) continue;
      const hasInvalidCostData = ingredient.purchase_price_amount <= 0
        || n(ingredient.purchase_quantity) <= 0
        || n(ingredient.conversion_factor) <= 0
        || n(ingredient.yield_percent) <= 0
        || n(ingredient.yield_percent) > 100;
      if (hasInvalidCostData) missing.set(ingredient.id, ingredient.name);
    }
    return [...missing.values()];
  }, [ingredientMap, items]);

  const costRows = useMemo(() => items.flatMap(item => {
    const ingredient = ingredientMap.get(item.ingredientId);
    if (!ingredient) return [];
    const input: IngredientCostInput & { availableQuantity: number; name: string } = {
      name: ingredient.name,
      purchasePrice: ingredient.purchase_price_amount,
      purchaseQuantity: n(ingredient.purchase_quantity),
      conversionFactor: n(ingredient.conversion_factor),
      yieldPercent: n(ingredient.yield_percent),
      wastePercent: item.wastePercentOverride ?? n(ingredient.waste_percent),
      recipeQuantity: item.quantity / Math.max(servings, 1),
      availableQuantity: n(ingredient.stock_quantity),
    };
    return [input];
  }), [items, ingredientMap, servings]);

  const recipeCost = useMemo(() => {
    try { return calculateRecipeCost(costRows); }
    catch { return { breakdown: [], totalCost: 0 }; }
  }, [costRows]);
  const capacity = useMemo(() => calculateProductionCapacity(costRows.map(row => ({
    name: row.name,
    availableQuantity: row.availableQuantity,
    recipeQuantity: row.recipeQuantity,
  }))), [costRows]);
  const costingReady = items.length > 0 && missingCostIngredients.length === 0 && validationErrors.length === 0;
  const grossProfit = sellingPrice - recipeCost.totalCost;
  const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  function selectProduct(nextId: string) {
    if (nextId === productId) return;
    if (isDirty && !window.confirm('Ada perubahan resep yang belum disimpan. Pindah produk dan buang perubahan ini?')) return;
    setProductId(nextId);
    setMessage('');
  }

  function addIngredient() {
    const used = new Set(items.map(item => item.ingredientId));
    const next = ingredients.find(item => !used.has(item.id));
    if (!next) {
      setMessage('Semua bahan tersimpan sudah masuk resep.');
      return;
    }
    setItems(current => [...current, { ingredientId: next.id, quantity: 1, wastePercentOverride: null }]);
    setMessage('');
  }

  function patch(index: number, patchValue: Partial<RecipeItem>) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item));
    setMessage('');
  }

  function discardChanges() {
    setRecipeName(savedDraft.recipeName);
    setServings(savedDraft.servings);
    setItems(savedDraft.items.map(item => ({ ...item })));
    setMessage('Perubahan dibatalkan.');
  }

  async function save() {
    if (!productId) return;
    const errors = validateHppRecipeDraft(currentDraft);
    if (errors.length) {
      setMessage(errors[0]);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipeName.trim() || product?.name || 'Resep utama',
          servings,
          items: items.map(item => ({
            ingredient_id: item.ingredientId,
            quantity: item.quantity,
            waste_percent_override: item.wastePercentOverride,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan resep.');
      const nextSavedDraft: HppRecipeDraft = {
        recipeName: recipeName.trim() || product?.name || 'Resep utama',
        servings,
        items: items.map(item => ({ ...item })),
      };
      setRecipeName(nextSavedDraft.recipeName);
      setSavedDraft(nextSavedDraft);
      setMessage('Resep tersimpan. Modal per porsi dihitung otomatis dari harga, konversi, yield, susut, dan jumlah bahan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan resep.');
    } finally {
      setSaving(false);
    }
  }

  if (!products.length) {
    return <div className="portal-panel p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu sebelum menghitung modal produk.</div>;
  }
  if (!ingredients.length) {
    return <div className="portal-panel p-5"><p className="font-bold text-portal-ink">Belum ada bahan atau kemasan.</p><p className="mt-1 text-sm text-portal-soft">Simpan bahan utama, cup, seal, atau kemasan dulu. Setelah itu bahan tersebut langsung bisa dipilih di resep.</p><Link href={`/businesses/${businessId}/inventory`} className="portal-button-primary mt-4">Isi bahan & stok</Link></div>;
  }

  return (
    <div className="space-y-3 pb-2">
      <section className="portal-panel p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
          <label className="text-xs font-semibold text-portal-soft">Produk
            <select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" value={productId} onChange={event => selectProduct(event.target.value)}>
              {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-portal-line bg-[#fafbf9] px-3 py-2.5">
            <p className="text-[11px] font-semibold text-portal-soft">Harga jual dari Barang</p>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <strong className="text-base text-portal-ink">{money.format(sellingPrice)}</strong>
              <Link href={`/businesses/${businessId}/products`} className="text-[11px] font-bold text-portal-forest hover:underline">Ubah di Barang</Link>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-portal-line pt-3">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isDirty ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
            {isDirty ? 'Ada perubahan belum disimpan' : 'Resep tersimpan'}
          </span>
          {missingCostIngredients.length ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">Modal belum lengkap</span> : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><p className="text-[11px] text-portal-soft">Modal / porsi</p><p className="mt-0.5 text-lg font-black text-portal-ink">{costingReady ? money.format(recipeCost.totalCost) : '—'}</p></div>
          <div><p className="text-[11px] text-portal-soft">Untung kotor</p><p className={`mt-0.5 text-lg font-black ${costingReady && grossProfit < 0 ? 'text-red-700' : 'text-portal-forest'}`}>{costingReady ? money.format(grossProfit) : '—'}</p></div>
          <div><p className="text-[11px] text-portal-soft">Margin</p><p className="mt-0.5 text-lg font-black text-portal-ink">{costingReady && sellingPrice > 0 ? `${number.format(margin)}%` : '—'}</p></div>
          <div><p className="text-[11px] text-portal-soft">Bisa dibuat</p><p className="mt-0.5 text-lg font-black text-portal-ink">{capacity.capacity}</p></div>
        </div>
        {capacity.bottleneck ? <p className="mt-2 text-[11px] font-semibold text-amber-800">Terbatas oleh: {capacity.bottleneck.name}</p> : null}
        {missingCostIngredients.length ? (
          <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <p>Lengkapi harga beli, jumlah beli, konversi, atau yield untuk <strong>{missingCostIngredients.join(', ')}</strong> agar modal tidak tampil menyesatkan.</p>
          </div>
        ) : null}
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
          <div><h2 className="font-bold text-portal-ink">Bahan yang dipakai</h2><p className="text-xs text-portal-soft">{product?.name} · {items.length} bahan · harga dan stok diambil otomatis</p></div>
          <button type="button" onClick={addIngredient} className="portal-button-secondary"><Plus className="h-4 w-4" /> Bahan</button>
        </div>

        {loading ? <div className="flex items-center gap-2 p-5 text-sm text-portal-soft"><Loader2 className="h-4 w-4 animate-spin" /> Memuat resep...</div> : (
          <div className="divide-y divide-portal-line">
            {items.length ? items.map((item, index) => {
              const ingredient = ingredientMap.get(item.ingredientId);
              const cost = recipeCost.breakdown[index];
              const usedByOtherRows = new Set(items.filter((_, itemIndex) => itemIndex !== index).map(row => row.ingredientId));
              const ingredientCostReady = Boolean(ingredient)
                && (ingredient?.purchase_price_amount ?? 0) > 0
                && n(ingredient?.purchase_quantity) > 0
                && n(ingredient?.conversion_factor) > 0
                && n(ingredient?.yield_percent) > 0
                && n(ingredient?.yield_percent) <= 100;
              return (
                <div key={`${item.ingredientId}-${index}`} className="px-4 py-3 sm:px-5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
                    <label className="text-xs font-semibold text-portal-soft">Bahan
                      <select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm text-portal-ink" value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}>
                        {ingredients.map(option => <option key={option.id} value={option.id} disabled={usedByOtherRows.has(option.id)}>{option.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-portal-soft">Dipakai ({ingredient?.recipe_unit ?? 'unit'})
                      <input type="number" min="0.0001" step="any" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm text-portal-ink" value={item.quantity} onChange={event => patch(index, { quantity: Math.max(n(event.target.value), 0) })} />
                    </label>
                    <button type="button" aria-label="Hapus bahan" onClick={() => { setItems(current => current.filter((_, itemIndex) => itemIndex !== index)); setMessage(''); }} className="grid h-10 w-10 place-items-center rounded-lg text-portal-soft hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft">
                    <span>Biaya <strong className="text-portal-ink">{ingredientCostReady && cost ? money.format(cost.itemCost) : 'belum bisa dihitung'}</strong></span>
                    <span>Stok {n(ingredient?.stock_quantity)} {ingredient?.recipe_unit}</span>
                    {!ingredientCostReady ? <span className="font-semibold text-amber-800">Data harga/konversi belum lengkap</span> : null}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Detail perhitungan</summary>
                    <div className="mt-2 grid gap-3 rounded-lg bg-[#fafbf9] p-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs font-semibold text-portal-soft">Susut khusus %
                        <input type="number" min="0" max="99.999" step="any" placeholder={String(n(ingredient?.waste_percent))} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={item.wastePercentOverride ?? ''} onChange={event => patch(index, { wastePercentOverride: event.target.value === '' ? null : n(event.target.value) })} />
                      </label>
                      <div><p className="text-xs font-semibold text-portal-soft">Harga beli</p><p className="mt-2 text-sm font-bold text-portal-ink">{money.format(ingredient?.purchase_price_amount ?? 0)} / {n(ingredient?.purchase_quantity)} {ingredient?.purchase_unit}</p></div>
                      <div><p className="text-xs font-semibold text-portal-soft">Konversi</p><p className="mt-2 text-sm font-bold text-portal-ink">1 {ingredient?.purchase_unit} = {n(ingredient?.conversion_factor)} {ingredient?.recipe_unit}</p></div>
                      <div><p className="text-xs font-semibold text-portal-soft">Yield</p><p className="mt-2 text-sm font-bold text-portal-ink">{n(ingredient?.yield_percent)}%</p></div>
                      {ingredientCostReady && cost ? <p className="text-[11px] text-portal-soft sm:col-span-2 lg:col-span-4">Biaya efektif setelah yield/susut: <strong className="text-portal-ink">{money.format(cost.effectiveUnitCost)} / {ingredient?.recipe_unit}</strong>.</p> : null}
                    </div>
                  </details>
                </div>
              );
            }) : <div className="p-5 text-sm text-portal-soft">Belum ada bahan. Tekan <strong>+ Bahan</strong> untuk mulai.</div>}
          </div>
        )}
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <details className="group min-w-0 flex-1">
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Pengaturan lanjutan</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">Nama resep<input className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={recipeName} onChange={event => { setRecipeName(event.target.value); setMessage(''); }} /></label>
              <label className="text-xs font-semibold text-portal-soft">Jumlah hasil / porsi<input type="number" min="0.0001" step="any" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={servings} onChange={event => { setServings(Math.max(n(event.target.value), 0)); setMessage(''); }} /></label>
            </div>
          </details>
          <div className="flex gap-2">
            <button type="button" disabled={!isDirty || saving || loading} onClick={discardChanges} className="portal-button-secondary justify-center disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Batalkan</button>
            <button type="button" disabled={!isDirty || saving || loading || validationErrors.length > 0} onClick={save} className="portal-button-primary justify-center disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan perubahan</button>
          </div>
        </div>
        {validationErrors.length ? <p className="mt-3 flex gap-2 text-xs text-red-700"><TriangleAlert className="h-4 w-4 shrink-0" /> {validationErrors[0]}</p> : null}
        {capacity.bottleneck ? <p className="mt-3 flex gap-2 text-xs text-amber-800"><TriangleAlert className="h-4 w-4 shrink-0" /> Stok <strong>{capacity.bottleneck.name}</strong> membatasi produksi sekitar {capacity.capacity} porsi.</p> : null}
        {message ? <p role="status" className="mt-3 text-xs text-portal-soft">{message}</p> : null}
      </section>

      {isDirty && !loading ? (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-amber-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="mb-2 sm:mb-0">
            <p className="text-sm font-bold text-portal-ink">Perubahan resep belum disimpan</p>
            <p className="text-xs text-portal-soft">Simpan agar HPP produk memakai komposisi terbaru.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={discardChanges} className="portal-button-secondary flex-1 justify-center sm:flex-none"><RotateCcw className="h-4 w-4" /> Batalkan</button>
            <button type="button" disabled={saving || validationErrors.length > 0} onClick={save} className="portal-button-primary flex-1 justify-center disabled:opacity-50 sm:flex-none">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
