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
  const [sellingPrice, setSellingPrice] = useState(priceFromLabel(products[0]?.priceLabel));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const product = products.find(item => item.id === productId) ?? products[0];
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
            setSellingPrice(priceFromLabel(selected?.priceLabel));
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
          const selected = products.find(item => item.id === productId);
          setSellingPrice(priceFromLabel(selected?.priceLabel));
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
      setMessage('Resep tersimpan. HPP sekarang dihitung dari bahan canonical usaha.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan resep.');
    } finally {
      setSaving(false);
    }
  }

  if (!products.length) {
    return <div className="portal-panel p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu sebelum membuat resep HPP.</div>;
  }
  if (!ingredients.length) {
    return <div className="portal-panel p-5"><p className="font-bold text-portal-ink">Belum ada bahan atau kemasan.</p><p className="mt-1 text-sm text-portal-soft">Simpan bahan utama, cup, seal, atau kemasan dulu. Setelah itu bahan tersebut langsung bisa dipilih di resep.</p><Link href={`/businesses/${businessId}/inventory`} className="portal-button-primary mt-4">Isi bahan & stok</Link></div>;
  }

  return (
    <div className="space-y-4">
      <section className="portal-panel p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold text-portal-soft">Produk
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={productId} onChange={event => selectProduct(event.target.value)}>
              {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Nama resep
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={recipeName} onChange={event => setRecipeName(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Resep menghasilkan berapa porsi?
            <input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={servings} onChange={event => setServings(Math.max(n(event.target.value), 0.0001))} />
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="portal-panel p-4"><p className="portal-label">HPP / produk</p><p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(recipeCost.totalCost)}</p><p className="mt-1 text-xs text-portal-soft">Bahan + kemasan sesuai resep tersimpan.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Sisa setelah HPP</p><p className={`mt-2 text-2xl font-bold ${grossProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(grossProfit)}</p><p className="mt-1 text-xs text-portal-soft">Margin kotor {number.format(margin)}%.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Bisa dibuat</p><p className="mt-2 text-2xl font-bold text-portal-ink">{capacity.capacity}</p><p className="mt-1 text-xs text-portal-soft">Pembatas: <strong>{capacity.bottleneck?.name ?? 'Belum dapat dihitung'}</strong></p></div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-portal-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="portal-kicker">Komposisi resep</p><h2 className="mt-1 text-lg font-bold text-portal-ink">{product?.name}</h2><p className="mt-1 text-sm text-portal-soft">Pilih bahan yang sudah tersimpan. Harga beli, yield, susut, dan stok diambil otomatis dari Stok & Belanja.</p></div>
          <button type="button" onClick={addIngredient} className="portal-button-secondary"><Plus className="h-4 w-4" /> Tambah bahan</button>
        </div>
        {loading ? <div className="flex items-center gap-2 p-5 text-sm text-portal-soft"><Loader2 className="h-4 w-4 animate-spin" /> Memuat resep...</div> : (
          <div className="divide-y divide-portal-line">
            {items.length ? items.map((item, index) => {
              const ingredient = ingredientMap.get(item.ingredientId);
              const cost = recipeCost.breakdown[index];
              return <div key={`${item.ingredientId}-${index}`} className="p-4 sm:p-5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
                  <label className="text-xs font-semibold text-portal-soft">Bahan / kemasan
                    <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}>
                      {ingredients.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-portal-soft">Jumlah dipakai ({ingredient?.recipe_unit ?? 'unit'})
                    <input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={item.quantity} onChange={event => patch(index, { quantity: Math.max(n(event.target.value), 0) })} />
                  </label>
                  <label className="text-xs font-semibold text-portal-soft">Susut khusus % <span className="font-normal">(opsional)</span>
                    <input type="number" min="0" max="99" step="any" placeholder={String(n(ingredient?.waste_percent))} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={item.wastePercentOverride ?? ''} onChange={event => patch(index, { wastePercentOverride: event.target.value === '' ? null : n(event.target.value) })} />
                  </label>
                  <button type="button" aria-label="Hapus bahan" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-portal-line p-2.5 text-portal-soft hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft">
                  <span>Biaya: <strong className="text-portal-ink">{money.format(cost?.itemCost ?? 0)}</strong></span>
                  <span>Harga beli {money.format(ingredient?.purchase_price_amount ?? 0)} / {n(ingredient?.purchase_quantity)} {ingredient?.purchase_unit}</span>
                  <span>Yield {n(ingredient?.yield_percent)}%</span>
                  <span>Stok {n(ingredient?.stock_quantity)} {ingredient?.recipe_unit}</span>
                </div>
              </div>;
            }) : <div className="p-5 text-sm text-portal-soft">Resep belum punya bahan. Klik <strong>Tambah bahan</strong> untuk mulai.</div>}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="portal-panel p-4 sm:p-5">
          {capacity.bottleneck ? <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>{capacity.bottleneck.name}</strong> menjadi pembatas. Dengan stok sekarang, resep ini kira-kira bisa dibuat <strong>{capacity.capacity} kali</strong>.</p></div> : <p className="text-sm text-portal-soft">Kapasitas produksi muncul setelah resep memiliki bahan dengan stok yang valid.</p>}
        </div>
        <div className="portal-panel p-4 sm:p-5">
          <label className="text-xs font-semibold text-portal-soft">Harga jual untuk cek margin
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-base font-bold text-portal-ink" value={sellingPrice} onChange={event => setSellingPrice(n(event.target.value))} />
          </label>
          <button type="button" disabled={saving || loading} onClick={save} className="portal-button-primary mt-4 w-full justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan resep</button>
          {message ? <p className="mt-3 text-xs leading-5 text-portal-soft">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}