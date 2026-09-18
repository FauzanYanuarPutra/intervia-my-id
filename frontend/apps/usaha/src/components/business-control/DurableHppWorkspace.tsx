'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  History,
  Loader2,
  Plus,
  Save,
  Search,
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
import { SensitiveActionConfirm } from '@/components/interaction/SensitiveActionConfirm';
import { businessApiErrorMessage } from '@/lib/business-api-error';

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
  const [productSearch, setProductSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [recipeName, setRecipeName] = useState(products[0]?.name ?? 'Resep utama');
  const [servings, setServings] = useState(1);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [initialSignature, setInitialSignature] = useState(recipeSignature(products[0]?.name ?? 'Resep utama', 1, []));
  const [history, setHistory] = useState<RecipeHistoryEvent[]>([]);
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireReason, setRetireReason] = useState('');

  const product = products.find(item => item.id === productId) ?? products[0];
  const sellingPrice = priceFromLabel(product?.priceLabel);
  const ingredientMap = useMemo(() => new Map(ingredients.map(item => [item.id, item])), [ingredients]);
  const availableIngredients = useMemo(() => {
    const used = new Set(items.map(item => item.ingredientId));
    return ingredients.filter(item => !used.has(item.id));
  }, [ingredients, items]);
  const productResults = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (query) return products.filter(item => item.name.toLowerCase().includes(query)).slice(0, 8);
    const active = products.filter(item => item.id === productId);
    const others = products.filter(item => item.id !== productId).slice(0, 4);
    return [...active, ...others];
  }, [productId, productSearch, products]);
  const ingredientResults = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    const filtered = query ? availableIngredients.filter(item => item.name.toLowerCase().includes(query)) : availableIngredients;
    return filtered.slice(0, 10);
  }, [availableIngredients, ingredientSearch]);
  const hasUnsavedChanges = initialSignature !== recipeSignature(recipeName, servings, items);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage('');
      setShowIngredientPicker(false);
      setIngredientSearch('');
      const selected = products.find(item => item.id === productId);
      let nextRecipeName = selected?.name ?? 'Resep utama';
      let nextServings = 1;
      let nextItems: RecipeItem[] = [];
      try {
        const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, { cache: 'no-store' });
        if (response.status !== 404) {
          const payload = await response.json();
          if (!response.ok) throw new Error(businessApiErrorMessage(payload, 'Gagal memuat resep.', response.status));
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

  function switchProduct(nextId: string) {
    setProductId(nextId);
    setProductSearch('');
    setMessage('');
    setPendingProductId(null);
  }

  function selectProduct(nextId: string) {
    if (nextId === productId) return;
    if (hasUnsavedChanges) {
      setPendingProductId(nextId);
      return;
    }
    switchProduct(nextId);
  }

  function addIngredient(ingredientId: string) {
    if (!ingredientId) return;
    if (items.some(item => item.ingredientId === ingredientId)) {
      setMessage('Bahan itu sudah ada di resep. Ubah jumlahnya di rincian bahan.');
      return;
    }
    setItems(current => [...current, { ingredientId, quantity: 1, wastePercentOverride: null }]);
    setIngredientSearch('');
    setShowIngredientPicker(false);
    setMessage('');
  }

  function patch(index: number, patchValue: Partial<RecipeItem>) {
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
      if (!response.ok) throw new Error(businessApiErrorMessage(payload, 'Gagal menyimpan resep.', response.status));
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

  function retireActiveRecipe() {
    if (!items.length) {
      setMessage('Belum ada resep aktif untuk dihapus.');
      return;
    }
    setRetireReason('');
    setRetireOpen(true);
  }

  async function confirmRetireActiveRecipe() {
    const reason = retireReason.trim();
    if (reason.length < 3) {
      setMessage('Alasan penghapusan wajib diisi agar riwayat PIC jelas.');
      return;
    }
    setDeleting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/recipe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(businessApiErrorMessage(payload, 'Gagal menghapus resep aktif.', response.status));
      const emptyItems: RecipeItem[] = [];
      setItems(emptyItems);
      setInitialSignature(recipeSignature(recipeName, servings, emptyItems));
      setRetireOpen(false);
      setRetireReason('');
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
          <div>
            <label className="text-xs font-semibold text-portal-soft" htmlFor="hpp-product-search">Cari produk</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input id="hpp-product-search" className="portal-input min-h-11 w-full pl-9" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Ketik nama produk…" autoComplete="off" />
              {productSearch ? <button type="button" aria-label="Hapus pencarian produk" onClick={() => setProductSearch('')} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-portal-soft hover:bg-[#f2f4f1]"><X className="h-4 w-4" /></button> : null}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {productResults.map(item => <button key={item.id} type="button" onClick={() => selectProduct(item.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${item.id === productId ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'}`}><span className="block max-w-44 truncate">{item.name}</span><span className={`mt-0.5 block text-[10px] ${item.id === productId ? 'text-white/70' : 'text-portal-soft'}`}>{item.priceLabel || 'Harga belum diisi'}</span></button>)}
            </div>
            {!productResults.length ? <p className="mt-2 text-xs text-portal-soft">Produk tidak ditemukan.</p> : null}
          </div>
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
          <div><p className="text-[11px] text-portal-soft">Bisa dibuat</p><p className="mt-0.5 text-lg font-black text-portal-ink">{items.length ? `${whole.format(capacity.capacity)} porsi` : '-'}</p></div>
          <div><p className="text-[11px] text-portal-soft">Status</p><p className="mt-0.5 text-sm font-black text-portal-ink">{hasUnsavedChanges ? 'Belum disimpan' : 'Tersimpan'}</p></div>
        </div>
        {capacity.bottleneck ? <p className="mt-2 text-[11px] font-semibold text-amber-800">Stok terbatas oleh {capacity.bottleneck.name}.</p> : null}
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-portal-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="font-bold text-portal-ink">Rincian bahan</h2><p className="text-xs text-portal-soft">{product?.name} · {items.length} bahan · harga dan stok diambil otomatis</p></div>
          <button type="button" onClick={() => setShowIngredientPicker(true)} className="portal-button-secondary justify-center"><Plus className="h-4 w-4" /> Tambah bahan</button>
        </div>

        {showIngredientPicker ? (
          <div className="border-b border-portal-line bg-[#fafbf9] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-black text-portal-ink">Tambah bahan ke resep</p><p className="mt-0.5 text-xs text-portal-soft">Cari lalu tap bahan. Tidak perlu dropdown panjang.</p></div>
              <button type="button" aria-label="Tutup pencarian bahan" onClick={() => { setShowIngredientPicker(false); setIngredientSearch(''); }} className="grid h-9 w-9 place-items-center rounded-lg text-portal-soft hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-3 block text-xs font-semibold text-portal-soft" htmlFor="hpp-ingredient-search">Cari bahan</label>
            <div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" /><input id="hpp-ingredient-search" className="portal-input min-h-11 w-full bg-white pl-9" value={ingredientSearch} onChange={event => setIngredientSearch(event.target.value)} placeholder="Contoh: alpukat, gula, cup…" autoComplete="off" /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ingredientResults.map(option => <button key={option.id} type="button" onClick={() => addIngredient(option.id)} className="rounded-xl border border-portal-line bg-white px-3 py-3 text-left transition hover:border-portal-ink/20 hover:shadow-sm"><span className="block text-sm font-bold text-portal-ink">{option.name}</span><span className="mt-0.5 block text-[11px] text-portal-soft">Stok {number.format(n(option.stock_quantity))} {option.recipe_unit}</span></button>)}
            </div>
            {!ingredientResults.length ? <p className="mt-3 text-xs text-portal-soft">{availableIngredients.length ? 'Bahan tidak ditemukan.' : 'Semua bahan sudah masuk resep.'}</p> : null}
          </div>
        ) : null}

        {loading ? <div className="flex items-center gap-2 p-5 text-sm text-portal-soft"><Loader2 className="h-4 w-4 animate-spin" /> Memuat resep...</div> : (
          <div className="divide-y divide-portal-line">
            {items.length ? items.map((item, index) => {
              const ingredient = ingredientMap.get(item.ingredientId);
              const cost = recipeCost.breakdown[index];
              return (
                <div key={`${item.ingredientId}-${index}`} className="px-4 py-4 sm:px-5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-portal-ink">{ingredient?.name ?? 'Bahan tidak ditemukan'}</p>
                      <p className="mt-0.5 text-[11px] text-portal-soft">Stok {number.format(n(ingredient?.stock_quantity))} {ingredient?.recipe_unit} · Biaya {money.format(cost?.itemCost ?? 0)}</p>
                      <p className="mt-1 text-[10px] text-portal-soft">Ganti bahan dengan hapus lalu tambah lagi.</p>
                    </div>
                    <label className="text-xs font-semibold text-portal-soft">Dipakai
                      <div className="mt-1 flex min-h-11 items-center overflow-hidden rounded-xl border border-portal-line bg-white focus-within:border-portal-ink/40">
                        <input type="number" min="0.0001" step="any" className="min-h-10 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-portal-ink outline-none" value={item.quantity} onChange={event => patch(index, { quantity: Math.max(n(event.target.value), 0) })} />
                        <span className="shrink-0 border-l border-portal-line bg-[#fafbf9] px-3 text-xs font-bold text-portal-soft">{ingredient?.recipe_unit ?? 'unit'}</span>
                      </div>
                    </label>
                    <button type="button" aria-label={`Hapus ${ingredient?.name ?? 'bahan'}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-11 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft"><span>Per porsi <strong className="text-portal-ink">{number.format(costRows[index]?.recipeQuantity ?? 0)} {ingredient?.recipe_unit}</strong></span><span>Hasil terpakai {number.format(n(ingredient?.yield_percent))}%</span></div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Lihat cara hitung</summary>
                    <div className="mt-2 grid gap-3 rounded-lg bg-[#fafbf9] p-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-portal-soft">Susut khusus %
                        <input type="number" min="0" max="99" step="any" placeholder={String(n(ingredient?.waste_percent))} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={item.wastePercentOverride ?? ''} onChange={event => patch(index, { wastePercentOverride: event.target.value === '' ? null : n(event.target.value) })} />
                      </label>
                      <div><p className="text-xs font-semibold text-portal-soft">Harga beli</p><p className="mt-2 text-sm font-bold text-portal-ink">{money.format(ingredient?.purchase_price_amount ?? 0)} / {number.format(n(ingredient?.purchase_quantity))} {ingredient?.purchase_unit}</p></div>
                      <div><p className="text-xs font-semibold text-portal-soft">Formula</p><p className="mt-2 text-xs leading-5 text-portal-soft">Harga beli dibagi jumlah beli, konversi, hasil terpakai, dan susut; hasilnya dikali pemakaian per porsi.</p></div>
                    </div>
                  </details>
                </div>
              );
            }) : <div className="p-5 text-sm text-portal-soft">Belum ada bahan. Tekan <strong>Tambah bahan</strong>, cari nama bahan, lalu tap hasilnya.</div>}
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
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-portal-forest" /><h2 className="font-bold text-portal-ink">Riwayat perubahan</h2></div>
        <div className="mt-3 divide-y divide-portal-line">
          {history.length ? history.slice(0, 8).map((event, index) => (
            <div key={event.id ?? `${event.event_key}-${index}`} className="py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-portal-ink">{formatEventKey(event.event_key)}</strong><span className="text-portal-soft">{formatOccurredAt(event.occurred_at)}</span></div>
              <p className="mt-1 flex items-center gap-1 text-portal-soft"><ShieldCheck className="h-3.5 w-3.5" /> PIC: <span className="font-semibold text-portal-ink">{event.actor_user_id ?? 'Sistem'}</span></p>
              {event.reason ? <p className="mt-1 text-portal-soft">Alasan: {event.reason}</p> : null}
            </div>
          )) : <p className="py-3 text-xs text-portal-soft">Belum ada riwayat. Setelah resep disimpan atau dihapus, PIC dan alasannya tampil di sini.</p>}
        </div>
      </section>

      <SensitiveActionConfirm
        open={Boolean(pendingProductId)}
        title="Pindah produk tanpa menyimpan?"
        description="Perubahan resep saat ini belum disimpan. Jika dilanjutkan, perubahan draft akan ditinggalkan."
        confirmLabel="Pindah produk"
        onCancel={() => setPendingProductId(null)}
        onConfirm={() => pendingProductId && switchProduct(pendingProductId)}
      />

      <SensitiveActionConfirm
        open={retireOpen}
        title="Hapus resep aktif?"
        description={`Resep aktif ${product?.name ?? 'produk ini'} akan dinonaktifkan. Riwayat, PIC, dan alasan tetap tersimpan untuk audit.`}
        confirmLabel="Hapus resep aktif"
        busy={deleting}
        requireText
        value={retireReason}
        onValueChange={setRetireReason}
        onCancel={() => {
          if (!deleting) {
            setRetireOpen(false);
            setRetireReason('');
          }
        }}
        onConfirm={() => void confirmRetireActiveRecipe()}
      />

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
