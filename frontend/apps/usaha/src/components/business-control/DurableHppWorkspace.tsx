'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  History,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
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

type RecipeHistoryEvent = {
  id?: string;
  actor_user_id?: string | null;
  event_key?: string;
  reason?: string | null;
  occurred_at?: string;
};

type Props = {
  businessId: string;
  ingredients: Ingredient[];
  products: Product[];
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function n(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceFromLabel(value?: string) {
  const parsed = Number((value ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function recipeSignature(recipeName: string, servings: number, items: RecipeItem[]) {
  return JSON.stringify({
    recipeName: recipeName.trim(),
    servings,
    items: [...items]
      .map(item => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        wastePercentOverride: item.wastePercentOverride,
      }))
      .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId)),
  });
}

function formatEventKey(value?: string) {
  if (value === 'recipe.published') return 'Resep disimpan';
  if (value === 'recipe.retired') return 'Resep aktif dihapus';
  return value ?? 'Perubahan resep';
}

function formatOccurredAt(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

export function DurableHppWorkspace({ businessId, ingredients, products }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [recipeName, setRecipeName] = useState(products[0]?.name ?? 'Resep utama');
  const [servings, setServings] = useState(1);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [initialSignature, setInitialSignature] = useState(recipeSignature(products[0]?.name ?? 'Resep utama', 1, []));
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [history, setHistory] = useState<RecipeHistoryEvent[]>([]);
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const product = products.find(item => item.id === productId) ?? products[0];
  const sellingPrice = priceFromLabel(product?.priceLabel);
  const ingredientMap = useMemo(() => new Map(ingredients.map(item => [item.id, item])), [ingredients]);
  const availableIngredients = useMemo(() => {
    const used = new Set(items.map(item => item.ingredientId));
    return ingredients.filter(item => !used.has(item.id));
  }, [ingredients, items]);
  const hasUnsavedChanges = initialSignature !== recipeSignature(recipeName, servings, items);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage('');
      setShowIngredientPicker(false);
      setSelectedIngredientId('');
      const selected = products.find(item => item.id === productId);
      let nextRecipeName = selected?.name ?? 'Resep utama';
      let nextServings = 1;
      let nextItems: RecipeItem[] = [];
      try {
        const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, { cache: 'no-store' });
        if (response.status !== 404) {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error || 'Gagal memuat resep.');
          const aggregate = payload?.data?.recipe as RecipeApiAggregate | undefined;
          if (aggregate) {
            nextRecipeName = aggregate.recipe?.name || selected?.name || 'Resep utama';
            nextServings = n(aggregate.recipe?.servings) || 1;
            nextItems = Array.isArray(aggregate.items) ? aggregate.items.map(item => ({
              ingredientId: String(item.ingredient_id ?? ''),
              quantity: n(item.quantity),
              wastePercentOverride: item.waste_percent_override === null || item.waste_percent_override === undefined ? null : n(item.waste_percent_override),
            })).filter(item => item.ingredientId) : [];
          }
        }
        const historyResponse = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe?history=1`, { cache: 'no-store' });
        const historyPayload = await historyResponse.json().catch(() => ({}));
        if (!cancelled) {
          setRecipeName(nextRecipeName);
          setServings(nextServings);
          setItems(nextItems);
          setInitialSignature(recipeSignature(nextRecipeName, nextServings, nextItems));
          setHistory(Array.isArray(historyPayload?.data?.history) ? historyPayload.data.history : []);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Gagal memuat resep.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId, productId, products]);

  const costRows = useMemo(() => items.flatMap(item => {
    const ingredient = ingredientMap.get(item.ingredientId);
    if (!ingredient) return [];
    const input: IngredientCostInput & { availableQuantity: number; name: string; unit: string } = {
      name: ingredient.name,
      purchasePrice: ingredient.purchase_price_amount,
      purchaseQuantity: n(ingredient.purchase_quantity),
      conversionFactor: n(ingredient.conversion_factor),
      yieldPercent: n(ingredient.yield_percent),
      wastePercent: item.wastePercentOverride ?? n(ingredient.waste_percent),
      recipeQuantity: item.quantity / Math.max(servings, 1),
      availableQuantity: n(ingredient.stock_quantity),
      unit: ingredient.recipe_unit,
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
    if (hasUnsavedChanges && !window.confirm('Perubahan resep belum disimpan. Pindah produk tanpa menyimpan?')) return;
    setProductId(nextId);
    setMessage('');
  }

  function addSelectedIngredient() {
    if (!selectedIngredientId) {
      setMessage('Pilih bahan dulu, baru tambahkan ke resep.');
      return;
    }
    if (items.some(item => item.ingredientId === selectedIngredientId)) {
      setMessage('Bahan itu sudah ada di resep. Ubah jumlahnya di rincian bahan.');
      return;
    }
    setItems(current => [...current, { ingredientId: selectedIngredientId, quantity: 1, wastePercentOverride: null }]);
    setSelectedIngredientId('');
    setShowIngredientPicker(false);
    setMessage('');
  }

  function patch(index: number, patchValue: Partial<RecipeItem>) {
    if (patchValue.ingredientId && items.some((item, itemIndex) => itemIndex !== index && item.ingredientId === patchValue.ingredientId)) {
      setMessage('Satu bahan hanya boleh muncul sekali dalam resep.');
      return;
    }
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item));
    setMessage('');
  }

  async function refreshHistory() {
    const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe?history=1`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    setHistory(Array.isArray(payload?.data?.history) ? payload.data.history : []);
  }

  function validateBeforeSave() {
    if (!items.length) return 'Tambahkan minimal satu bahan ke resep.';
    if (servings <= 0) return 'Jumlah porsi harus lebih dari 0.';
    const ids = new Set<string>();
    for (const item of items) {
      if (!item.ingredientId) return 'Ada bahan yang belum dipilih.';
      if (ids.has(item.ingredientId)) return 'Ada bahan ganda. Satu bahan cukup dicatat sekali.';
      ids.add(item.ingredientId);
      if (item.quantity <= 0) return 'Jumlah bahan harus lebih dari 0.';
    }
    return '';
  }

  async function save() {
    if (!productId) return;
    const validation = validateBeforeSave();
    if (validation) {
      setMessage(validation);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const savedRecipeName = recipeName.trim() || product?.name || 'Resep utama';
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: savedRecipeName,
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
      setRecipeName(savedRecipeName);
      setInitialSignature(recipeSignature(savedRecipeName, servings, items));
      setMessage('Resep tersimpan. HPP, margin, stok, dan PIC perubahan tercatat di riwayat.');
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan resep.');
    } finally {
      setSaving(false);
    }
  }

  async function retireActiveRecipe() {
    if (!items.length) {
      setMessage('Belum ada resep aktif untuk dihapus.');
      return;
    }
    const reason = window.prompt('Alasan menghapus resep aktif? Alasan ini masuk riwayat PIC.', 'Resep salah input');
    if (!reason || reason.trim().length < 3) {
      setMessage('Alasan penghapusan wajib diisi agar riwayat PIC jelas.');
      return;
    }
    if (!window.confirm(`Hapus resep aktif untuk ${product?.name ?? 'produk ini'}? Riwayat dan PIC tetap tersimpan.`)) return;
    setDeleting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menghapus resep aktif.');
      const emptyItems: RecipeItem[] = [];
      setItems(emptyItems);
      setInitialSignature(recipeSignature(recipeName, servings, emptyItems));
      setMessage('Resep aktif dihapus. Riwayat dan PIC tetap tercatat untuk audit internal.');
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menghapus resep aktif.');
    } finally {
      setDeleting(false);
    }
  }

  if (!products.length) {
    return <div className="portal-panel p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu sebelum menghitung modal produk.</div>;
  }
  if (!ingredients.length) {
    return <div className="portal-panel p-5"><p className="font-bold text-portal-ink">Belum ada bahan atau kemasan.</p><p className="mt-1 text-sm text-portal-soft">Simpan bahan utama, cup, seal, atau kemasan dulu. Setelah itu bahan tersebut langsung bisa dipilih di resep.</p><Link href={`/businesses/${businessId}/inventory`} className="portal-button-primary mt-4">Isi bahan & stok</Link></div>;
  }

  return (
    <div className="space-y-3 pb-20">
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
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-portal-line pt-3 sm:grid-cols-5">
          <div><p className="text-[11px] text-portal-soft">HPP / porsi</p><p className="mt-0.5 text-lg font-black text-portal-ink">{money.format(recipeCost.totalCost)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Sisa kotor</p><p className={`mt-0.5 text-lg font-black ${grossProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(grossProfit)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Margin</p><p className="mt-0.5 text-lg font-black text-portal-ink">{number.format(margin)}%</p></div>
          <div><p className="text-[11px] text-portal-soft">Bisa dibuat</p><p className="mt-0.5 text-lg font-black text-portal-ink">{items.length ? whole.format(capacity.capacity) : '-'}</p></div>
          <div><p className="text-[11px] text-portal-soft">Status</p><p className="mt-0.5 text-sm font-black text-portal-ink">{hasUnsavedChanges ? 'Belum disimpan' : 'Tersimpan'}</p></div>
        </div>
        {capacity.bottleneck ? <p className="mt-2 text-[11px] font-semibold text-amber-800">Terbatas oleh: {capacity.bottleneck.name}</p> : null}
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-portal-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="font-bold text-portal-ink">Rincian bahan</h2><p className="text-xs text-portal-soft">{product?.name} - {items.length} bahan - harga dan stok diambil otomatis</p></div>
          <button type="button" onClick={() => setShowIngredientPicker(true)} className="portal-button-secondary justify-center"><Plus className="h-4 w-4" /> Pilih bahan</button>
        </div>

        {showIngredientPicker ? (
          <div className="border-b border-portal-line bg-[#fafbf9] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="text-xs font-semibold text-portal-soft">Pilih bahan
                <select className="mt-1 min-h-11 w-full rounded-lg border border-portal-line bg-white px-3 text-sm text-portal-ink" value={selectedIngredientId} onChange={event => setSelectedIngredientId(event.target.value)}>
                  <option value="">Pilih bahan yang belum ada di resep</option>
                  {availableIngredients.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={addSelectedIngredient} className="portal-button-primary justify-center"><Check className="h-4 w-4" /> Tambahkan</button>
              <button type="button" onClick={() => setShowIngredientPicker(false)} className="portal-button-secondary justify-center"><X className="h-4 w-4" /> Batal</button>
            </div>
            {!availableIngredients.length ? <p className="mt-2 text-xs text-portal-soft">Semua bahan sudah masuk resep. Ubah jumlah di rincian bahan.</p> : null}
          </div>
        ) : null}

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
                    <span>Stok {number.format(n(ingredient?.stock_quantity))} {ingredient?.recipe_unit}</span>
                    <span>Dipakai per porsi {number.format(costRows[index]?.recipeQuantity ?? 0)} {ingredient?.recipe_unit}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Lihat cara hitung</summary>
                    <div className="mt-2 grid gap-3 rounded-lg bg-[#fafbf9] p-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-portal-soft">Susut khusus %
                        <input type="number" min="0" max="99" step="any" placeholder={String(n(ingredient?.waste_percent))} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={item.wastePercentOverride ?? ''} onChange={event => patch(index, { wastePercentOverride: event.target.value === '' ? null : n(event.target.value) })} />
                      </label>
                      <div><p className="text-xs font-semibold text-portal-soft">Harga beli</p><p className="mt-2 text-sm font-bold text-portal-ink">{money.format(ingredient?.purchase_price_amount ?? 0)} / {number.format(n(ingredient?.purchase_quantity))} {ingredient?.purchase_unit}</p></div>
                      <div><p className="text-xs font-semibold text-portal-soft">Formula</p><p className="mt-2 text-xs leading-5 text-portal-soft">Harga beli dibagi jumlah beli, konversi, yield, dan susut; hasilnya dikali pemakaian per porsi.</p></div>
                    </div>
                  </details>
                </div>
              );
            }) : <div className="p-5 text-sm text-portal-soft">Belum ada bahan. Tekan <strong>Pilih bahan</strong> untuk mulai tanpa bahan acak.</div>}
          </div>
        )}
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <details className="group">
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Pengaturan lanjutan</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">Nama resep<input className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={recipeName} onChange={event => setRecipeName(event.target.value)} /></label>
              <label className="text-xs font-semibold text-portal-soft">1 kali resep menghasilkan berapa porsi?<input type="number" min="0.0001" step="any" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line px-3 text-sm" value={servings} onChange={event => setServings(Math.max(n(event.target.value), 0.0001))} /></label>
            </div>
          </details>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={deleting || loading || !items.length} onClick={retireActiveRecipe} className="portal-button-secondary justify-center text-red-700 disabled:opacity-60">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus resep aktif</button>
            <button type="button" disabled={saving || loading} onClick={save} className="portal-button-primary justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan resep</button>
          </div>
        </div>
        {capacity.bottleneck ? <p className="mt-3 flex gap-2 text-xs text-amber-800"><TriangleAlert className="h-4 w-4 shrink-0" /> Stok <strong>{capacity.bottleneck.name}</strong> membatasi produksi sekitar {whole.format(capacity.capacity)} porsi.</p> : null}
        {message ? <p role="status" className="mt-3 text-xs text-portal-soft">{message}</p> : null}
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-portal-forest" />
          <h2 className="font-bold text-portal-ink">Riwayat perubahan</h2>
        </div>
        <div className="mt-3 divide-y divide-portal-line">
          {history.length ? history.slice(0, 8).map((event, index) => (
            <div key={event.id ?? `${event.event_key}-${index}`} className="py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-portal-ink">{formatEventKey(event.event_key)}</strong>
                <span className="text-portal-soft">{formatOccurredAt(event.occurred_at)}</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-portal-soft"><ShieldCheck className="h-3.5 w-3.5" /> PIC: <span className="font-semibold text-portal-ink">{event.actor_user_id ?? 'Sistem'}</span></p>
              {event.reason ? <p className="mt-1 text-portal-soft">Alasan: {event.reason}</p> : null}
            </div>
          )) : <p className="py-3 text-xs text-portal-soft">Belum ada riwayat. Setelah resep disimpan atau dihapus, PIC dan alasannya tampil di sini.</p>}
        </div>
      </section>

      {hasUnsavedChanges ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-portal-line bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-portal-ink">Ada perubahan resep yang belum disimpan.</p>
            <button type="button" disabled={saving || loading} onClick={save} className="portal-button-primary justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan perubahan</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
