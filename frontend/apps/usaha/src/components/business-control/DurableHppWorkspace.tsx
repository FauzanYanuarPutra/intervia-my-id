'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import {
  calculateProductionCapacity,
  calculateRecipeCost,
  type IngredientCostInput,
} from '@/lib/business-control/costing';

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

type RecipeItem = {
  ingredientId: string;
  quantity: number;
  wastePercentOverride: number | null;
};

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

export function DurableHppWorkspace({ businessId, ingredients, products }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [recipeName, setRecipeName] = useState(products[0]?.name ?? 'Resep utama');
  const [servings, setServings] = useState(1);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const product = products.find(item => item.id === productId) ?? products[0];
  const sellingPrice = priceFromLabel(product?.priceLabel);
  const ingredientMap = useMemo(() => new Map(ingredients.map(item => [item.id, item])), [ingredients]);

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
            setRecipeName(selected?.name ?? 'Resep utama');
            setServings(1);
            setItems([]);
          }
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Gagal memuat resep.');
        const aggregate = payload?.data?.recipe as RecipeApiAggregate | undefined;
        if (!cancelled && aggregate) {
          setRecipeName(aggregate.recipe?.name || product?.name || 'Resep utama');
          setServings(n(aggregate.recipe?.servings) || 1);
          setItems(Array.isArray(aggregate.items) ? aggregate.items.map(item => ({
            ingredientId: String(item.ingredient_id ?? ''),
            quantity: n(item.quantity),
            wastePercentOverride: item.waste_percent_override === null || item.waste_percent_override === undefined ? null : n(item.waste_percent_override),
          })).filter(item => item.ingredientId) : []);
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
  const grossProfit = sellingPrice - recipeCost.totalCost;
  const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  function selectProduct(nextId: string) {
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
  }

  function patch(index: number, patchValue: Partial<RecipeItem>) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item));
  }

  async function save() {
    if (!productId) return;
    if (!items.length) {
      setMessage('Tambahkan minimal satu bahan ke resep.');
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
      setMessage('Bahan produk tersimpan. Modal per porsi sekarang dihitung otomatis dari harga dan stok bahan.');
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
    <div className="space-y-3">
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
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-portal-line pt-3 sm:grid-cols-4">
          <div><p className="text-[11px] text-portal-soft">Modal / porsi</p><p className="mt-0.5 text-lg font-black text-portal-ink">{money.format(recipeCost.totalCost)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Untung kotor</p><p className={`mt-0.5 text-lg font-black ${grossProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(grossProfit)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Margin</p><p className="mt-0.5 text-lg font-black text-portal-ink">{number.format(margin)}%</p></div>
          <div><p className="text-[11px] text-portal-soft">Bisa dibuat</p><p className="mt-0.5 text-lg font-black text-portal-ink">{capacity.capacity}</p></div>
        </div>
        {capacity.bottleneck ? <p className="mt-2 text-[11px] font-semibold text-amber-800">Terbatas oleh: {capacity.bottleneck.name}</p> : null}
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
              return (
                <div key={`${item.ingredientId}-${index}`} className="px-4 py-3 sm:px-5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
                    <label className="text-xs font-semibold text-portal-soft">Bahan
                      <select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm text-portal-ink" value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}>
                        {ingredients.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-portal-soft">Dipakai ({ingredient?.recipe_unit ?? 'unit'})
                      <input type="number" min="0.0001" step="any" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm text-portal-ink" value={item.quantity} onChange={event => patch(index, { quantity: Math.max(n(event.target.value), 0) })} />
                    </label>
                    <button type="button" aria-label="Hapus bahan" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-10 w-10 place-items-center rounded-lg text-portal-soft hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft">
                    <span>Biaya <strong className="text-portal-ink">{money.format(cost?.itemCost ?? 0)}</strong></span>
                    <span>Stok {n(ingredient?.stock_quantity)} {ingredient?.recipe_unit}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Detail perhitungan</summary>
                    <div className="mt-2 grid gap-3 rounded-lg bg-[#fafbf9] p-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-portal-soft">Susut khusus %
                        <input type="number" min="0" max="99" step="any" placeholder={String(n(ingredient?.waste_percent))} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={item.wastePercentOverride ?? ''} onChange={event => patch(index, { wastePercentOverride: event.target.value === '' ? null : n(event.target.value) })} />
                      </label>
                      <div><p className="text-xs font-semibold text-portal-soft">Harga beli</p><p className="mt-2 text-sm font-bold text-portal-ink">{money.format(ingredient?.purchase_price_amount ?? 0)} / {n(ingredient?.purchase_quantity)} {ingredient?.purchase_unit}</p></div>
                      <div><p className="text-xs font-semibold text-portal-soft">Yield</p><p className="mt-2 text-sm font-bold text-portal-ink">{n(ingredient?.yield_percent)}%</p></div>
                    </div>
                  </details>
                </div>
              );
            }) : <div className="p-5 text-sm text-portal-soft">Belum ada bahan. Tekan <strong>+ Bahan</strong> untuk mulai.</div>}
          </div>
        )}
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <details className="group">
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Pengaturan lanjutan</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">Nama resep<input className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={recipeName} onChange={event => setRecipeName(event.target.value)} /></label>
              <label className="text-xs font-semibold text-portal-soft">Jumlah porsi<input type="number" min="0.0001" step="any" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={servings} onChange={event => setServings(Math.max(n(event.target.value), 0.0001))} /></label>
            </div>
          </details>
          <button type="button" disabled={saving || loading} onClick={save} className="portal-button-primary justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan resep</button>
        </div>
        {capacity.bottleneck ? <p className="mt-3 flex gap-2 text-xs text-amber-800"><TriangleAlert className="h-4 w-4 shrink-0" /> Stok <strong>{capacity.bottleneck.name}</strong> membatasi produksi sekitar {capacity.capacity} porsi.</p> : null}
        {message ? <p role="status" className="mt-3 text-xs text-portal-soft">{message}</p> : null}
      </section>
    </div>
  );
}
