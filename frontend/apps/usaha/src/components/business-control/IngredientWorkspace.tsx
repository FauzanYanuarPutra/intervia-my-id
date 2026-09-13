'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  History,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react';
import {
  effectiveIngredientUnitCost,
  filterIngredients,
  ingredientNumber,
  isIngredientIncomplete,
  needsIngredientPurchase,
  type IngredientFilter,
} from '@/lib/business-control/ingredient-management';

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
  minimum_stock: string | number;
  supplier_name: string | null;
};

type Movement = {
  id: string;
  location_id: string | null;
  movement_type: string;
  quantity_delta: string | number;
  quantity_before: string | number;
  quantity_after: string | number;
  source_type: string | null;
  note: string;
  created_at: string;
};

type Props = {
  businessId: string;
  initialIngredients: Ingredient[];
  primaryLocationId?: string | null;
  primaryLocationName?: string | null;
  canManage?: boolean;
};

type PanelMode = 'edit' | 'stock' | 'history' | 'archive';
type StockAction = 'purchase' | 'waste' | 'other_usage' | 'correction';

type EditDraft = {
  name: string;
  kind: string;
  purchaseUnit: string;
  recipeUnit: string;
  conversionFactor: string;
  purchasePrice: string;
  purchaseQuantity: string;
  yieldPercent: string;
  wastePercent: string;
  minimumStock: string;
  supplier: string;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const unitMoney = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const kindLabels: Record<string, string> = {
  ingredient: 'Bahan',
  packaging: 'Kemasan',
  semi_finished: 'Bahan olahan',
  utility: 'Utilitas langsung',
  labor: 'Tenaga langsung',
};

const filterLabels: Array<{ value: IngredientFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'ingredient', label: 'Bahan' },
  { value: 'packaging', label: 'Kemasan' },
  { value: 'low_stock', label: 'Perlu belanja' },
  { value: 'incomplete', label: 'Belum lengkap' },
];

const movementLabels: Record<string, string> = {
  purchase_receipt: 'Belanja / stok masuk',
  waste: 'Rusak / terbuang',
  adjustment: 'Koreksi stok',
  return_in: 'Pengembalian masuk',
  return_out: 'Pemakaian lain',
  stocktake_adjustment: 'Cocokkan stok',
  sale_consumption: 'Terpakai untuk penjualan',
};

function n(value: string | number | null | undefined) {
  return ingredientNumber(value);
}

function draftFromIngredient(item: Ingredient): EditDraft {
  return {
    name: item.name,
    kind: item.kind,
    purchaseUnit: item.purchase_unit,
    recipeUnit: item.recipe_unit,
    conversionFactor: String(item.conversion_factor),
    purchasePrice: String(item.purchase_price_amount),
    purchaseQuantity: String(item.purchase_quantity),
    yieldPercent: String(item.yield_percent),
    wastePercent: String(item.waste_percent),
    minimumStock: String(item.minimum_stock),
    supplier: item.supplier_name ?? '',
  };
}

function humanDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function responseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const code = String((payload as { error?: unknown }).error ?? '');
    if (code === 'ingredient_in_active_recipe') {
      return 'Bahan ini masih dipakai resep aktif. Lepaskan dari resep terlebih dahulu sebelum diarsipkan.';
    }
    if (code === 'inventory_insufficient_stock') {
      return 'Stok tidak cukup untuk pengurangan ini.';
    }
    if (code === 'business_ingredient_permission_denied') {
      return 'Peranmu tidak memiliki izin mengubah bahan atau stok.';
    }
    if (code) return code.replaceAll('_', ' ');
  }
  return fallback;
}

export function IngredientWorkspace({
  businessId,
  initialIngredients,
  primaryLocationId = null,
  primaryLocationName = null,
  canManage = true,
}: Props) {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('ingredient');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [recipeUnit, setRecipeUnit] = useState('gram');
  const [conversionFactor, setConversionFactor] = useState('1000');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [yieldPercent, setYieldPercent] = useState('100');
  const [wastePercent, setWastePercent] = useState('0');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minimumStock, setMinimumStock] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<IngredientFilter>('all');
  const [activePanel, setActivePanel] = useState<{
    id: string;
    mode: PanelMode;
  } | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [stockAction, setStockAction] = useState<StockAction>('purchase');
  const [stockQuantityInput, setStockQuantityInput] = useState('');
  const [correctionDirection, setCorrectionDirection] = useState<'in' | 'out'>(
    'in',
  );
  const [stockNote, setStockNote] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [movements, setMovements] = useState<Record<string, Movement[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const lowStock = useMemo(
    () => ingredients.filter(item => needsIngredientPurchase(item)),
    [ingredients],
  );
  const incomplete = useMemo(
    () => ingredients.filter(item => isIngredientIncomplete(item)),
    [ingredients],
  );
  const visibleIngredients = useMemo(
    () => filterIngredients(ingredients, filter, query),
    [ingredients, filter, query],
  );

  async function reload() {
    const response = await fetch(`/api/businesses/${businessId}/ingredients`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Gagal memuat ulang bahan.');
    const payload = await response.json();
    setIngredients(Array.isArray(payload?.data?.items) ? payload.data.items : []);
  }

  async function save() {
    if (name.trim().length < 2) {
      setMessage('Isi nama bahan atau kemasan.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          purchase_unit: purchaseUnit.trim(),
          recipe_unit: recipeUnit.trim(),
          conversion_factor: n(conversionFactor),
          purchase_price_amount: Math.round(n(purchasePrice)),
          purchase_quantity: n(purchaseQuantity),
          yield_percent: n(yieldPercent),
          waste_percent: n(wastePercent),
          stock_quantity: n(stockQuantity),
          minimum_stock: n(minimumStock),
          supplier_name: supplier.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal menyimpan bahan.'));
      await reload();
      setName('');
      setPurchasePrice('');
      setSupplier('');
      setMessage('Tersimpan. Bahan ini sekarang bisa dipakai di resep HPP.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan bahan.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: Ingredient) {
    setEditDraft(draftFromIngredient(item));
    setActionMessage('');
    setActivePanel({ id: item.id, mode: 'edit' });
  }

  function openStock(item: Ingredient) {
    setStockAction('purchase');
    setStockQuantityInput('');
    setCorrectionDirection('in');
    setStockNote('');
    setActionMessage('');
    setActivePanel({ id: item.id, mode: 'stock' });
  }

  async function openHistory(item: Ingredient) {
    setActionMessage('');
    setActivePanel({ id: item.id, mode: 'history' });
    if (!primaryLocationId) return;
    setHistoryLoading(item.id);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ingredients/${item.id}/movements?locationId=${encodeURIComponent(primaryLocationId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal memuat riwayat stok.'));
      setMovements(current => ({
        ...current,
        [item.id]: Array.isArray(payload?.data?.items) ? payload.data.items : [],
      }));
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Gagal memuat riwayat stok.',
      );
    } finally {
      setHistoryLoading(null);
    }
  }

  async function saveEdit(item: Ingredient) {
    if (!editDraft) return;
    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ingredients/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editDraft.name.trim(),
            kind: editDraft.kind,
            purchase_unit: editDraft.purchaseUnit.trim(),
            recipe_unit: editDraft.recipeUnit.trim(),
            conversion_factor: n(editDraft.conversionFactor),
            purchase_price_amount: Math.round(n(editDraft.purchasePrice)),
            purchase_quantity: n(editDraft.purchaseQuantity),
            yield_percent: n(editDraft.yieldPercent),
            waste_percent: n(editDraft.wastePercent),
            minimum_stock: n(editDraft.minimumStock),
            supplier_name: editDraft.supplier.trim() || null,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal memperbarui bahan.'));
      await reload();
      setActionMessage('Perubahan bahan tersimpan. Stok tidak diubah oleh form ini.');
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Gagal memperbarui bahan.',
      );
    } finally {
      setActionSaving(false);
    }
  }

  async function saveStock(item: Ingredient) {
    if (!primaryLocationId) {
      setActionMessage('Lokasi utama belum tersedia. Atur lokasi usaha terlebih dahulu.');
      return;
    }
    const quantity = n(stockQuantityInput);
    if (quantity <= 0) {
      setActionMessage('Isi jumlah stok lebih dari 0.');
      return;
    }
    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ingredients/${item.id}/stock-adjustments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location_id: primaryLocationId,
            action: stockAction,
            quantity,
            direction: correctionDirection,
            note: stockNote,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal memperbarui stok.'));
      const command = payload?.data?.command;
      await reload();
      setStockQuantityInput('');
      if (command) {
        setActionMessage(
          `Stok tersimpan: ${n(command.quantity_before)} → ${n(command.quantity_after)} ${item.recipe_unit}.`,
        );
      } else {
        setActionMessage('Perubahan stok tersimpan.');
      }
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Gagal memperbarui stok.',
      );
    } finally {
      setActionSaving(false);
    }
  }

  async function archiveIngredient(item: Ingredient) {
    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ingredients/${item.id}/archive`,
        { method: 'POST' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal mengarsipkan bahan.'));
      await reload();
      setActivePanel(null);
      setActionMessage('Bahan diarsipkan. Riwayat transaksi lama tetap tersimpan.');
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Gagal mengarsipkan bahan.',
      );
    } finally {
      setActionSaving(false);
    }
  }

  function projectedStock(item: Ingredient) {
    const quantity = n(stockQuantityInput);
    const before = n(item.stock_quantity);
    if (!quantity) return before;
    if (stockAction === 'purchase') return before + quantity;
    if (stockAction === 'waste' || stockAction === 'other_usage') {
      return before - quantity;
    }
    return correctionDirection === 'out' ? before - quantity : before + quantity;
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-portal-line bg-white p-3">
          <div className="flex items-center gap-2 text-portal-soft">
            <PackagePlus className="h-4 w-4" />
            <span className="text-xs font-semibold">Tercatat</span>
          </div>
          <p className="mt-2 text-xl font-bold text-portal-ink">{ingredients.length}</p>
        </div>
        <div className="rounded-xl border border-portal-line bg-white p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <TriangleAlert className="h-4 w-4" />
            <span className="text-xs font-semibold">Perlu belanja</span>
          </div>
          <p className="mt-2 text-xl font-bold text-portal-ink">{lowStock.length}</p>
        </div>
        <div className="rounded-xl border border-portal-line bg-white p-3">
          <p className="text-xs font-semibold text-portal-soft">Data belum lengkap</p>
          <p className="mt-2 text-xl font-bold text-portal-ink">{incomplete.length}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-portal-line bg-white">
        <div className="border-b border-portal-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-bold text-portal-ink">Bahan & kemasan saat ini</h2>
              <p className="mt-1 text-sm text-portal-soft">
                Harga beli, hasil terpakai, dan stok menjadi sumber perhitungan HPP resep.
              </p>
              {primaryLocationName ? (
                <p className="mt-1 text-xs font-semibold text-portal-soft">
                  Stok aktif: {primaryLocationName}
                </p>
              ) : null}
            </div>
            <label className="relative block w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Cari bahan atau supplier"
                className="min-h-11 w-full rounded-xl border border-portal-line pl-9 pr-3 text-sm text-portal-ink"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {filterLabels.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                  filter === option.value
                    ? 'border-portal-forest bg-portal-forest text-white'
                    : 'border-portal-line bg-white text-portal-soft'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-portal-line">
          {visibleIngredients.length ? (
            visibleIngredients.map(item => {
              const low = needsIngredientPurchase(item);
              const effectiveCost = effectiveIngredientUnitCost(item);
              const min = n(item.minimum_stock);
              const stock = n(item.stock_quantity);
              const panelOpen = activePanel?.id === item.id;
              return (
                <div key={item.id}>
                  <div className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-portal-ink">{item.name}</p>
                          <span className="rounded-full border border-portal-line px-2 py-0.5 text-[11px] text-portal-soft">
                            {kindLabels[item.kind] ?? item.kind}
                          </span>
                          {stock <= 0 ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                              Stok habis
                            </span>
                          ) : low ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                              Perlu belanja
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-portal-soft sm:grid-cols-2 lg:grid-cols-3">
                          <p>
                            <span className="font-semibold text-portal-ink">Stok:</span>{' '}
                            {stock} {item.recipe_unit}
                          </p>
                          <p>
                            {min > 0
                              ? `Batas minimum ${min} ${item.recipe_unit}`
                              : 'Batas minimum belum diatur'}
                          </p>
                          <p>{item.supplier_name ? `Supplier: ${item.supplier_name}` : 'Supplier belum diisi'}</p>
                          <p>
                            {n(item.purchase_price_amount) > 0
                              ? `${money.format(item.purchase_price_amount)} / ${n(item.purchase_quantity)} ${item.purchase_unit}`
                              : 'Harga beli belum diisi'}
                          </p>
                          <p>Hasil terpakai {n(item.yield_percent)}%</p>
                          <p className={effectiveCost === null ? 'font-semibold text-amber-800' : 'font-semibold text-portal-forest'}>
                            {effectiveCost === null
                              ? 'Modal belum bisa dihitung'
                              : `± ${unitMoney.format(effectiveCost)} / ${item.recipe_unit} terpakai`}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => openStock(item)}
                          className="portal-button-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" /> Tambah stok
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => openEdit(item)}
                          className="portal-button-secondary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void openHistory(item)}
                          className="portal-button-secondary min-h-11 justify-center"
                        >
                          <History className="h-4 w-4" /> Riwayat
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            setActionMessage('');
                            setActivePanel({ id: item.id, mode: 'archive' });
                          }}
                          className="portal-button-secondary min-h-11 justify-center text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4" /> Arsipkan
                        </button>
                      </div>
                    </div>
                  </div>

                  {panelOpen ? (
                    <div className="border-t border-portal-line bg-portal-mist/40 px-4 py-4 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-portal-ink">
                          {activePanel.mode === 'edit'
                            ? `Edit ${item.name}`
                            : activePanel.mode === 'stock'
                              ? `Ubah stok ${item.name}`
                              : activePanel.mode === 'history'
                                ? `Riwayat ${item.name}`
                                : `Arsipkan ${item.name}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setActivePanel(null)}
                          className="min-h-10 rounded-lg px-3 text-xs font-semibold text-portal-soft hover:bg-white"
                        >
                          Tutup
                        </button>
                      </div>

                      {activePanel.mode === 'edit' && editDraft ? (
                        <div className="mt-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="text-xs font-semibold text-portal-soft">
                              Nama
                              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.name} onChange={event => setEditDraft(current => current ? { ...current, name: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Jenis
                              <select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" value={editDraft.kind} onChange={event => setEditDraft(current => current ? { ...current, kind: event.target.value } : current)}>
                                {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Harga beli
                              <input type="number" min="0" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.purchasePrice} onChange={event => setEditDraft(current => current ? { ...current, purchasePrice: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Jumlah beli
                              <input type="number" step="any" min="0.0001" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.purchaseQuantity} onChange={event => setEditDraft(current => current ? { ...current, purchaseQuantity: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Unit beli
                              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.purchaseUnit} onChange={event => setEditDraft(current => current ? { ...current, purchaseUnit: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Unit resep
                              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.recipeUnit} onChange={event => setEditDraft(current => current ? { ...current, recipeUnit: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Konversi
                              <input type="number" step="any" min="0.0001" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.conversionFactor} onChange={event => setEditDraft(current => current ? { ...current, conversionFactor: event.target.value } : current)} />
                              <span className="mt-1 block font-normal">Contoh 1 kg = 1000 gram.</span>
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Hasil terpakai %
                              <input type="number" min="1" max="100" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.yieldPercent} onChange={event => setEditDraft(current => current ? { ...current, yieldPercent: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Susut %
                              <input type="number" min="0" max="99" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.wastePercent} onChange={event => setEditDraft(current => current ? { ...current, wastePercent: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Batas minimum
                              <input type="number" min="0" step="any" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.minimumStock} onChange={event => setEditDraft(current => current ? { ...current, minimumStock: event.target.value } : current)} />
                            </label>
                            <label className="text-xs font-semibold text-portal-soft sm:col-span-2">
                              Supplier <span className="font-normal">(opsional)</span>
                              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={editDraft.supplier} onChange={event => setEditDraft(current => current ? { ...current, supplier: event.target.value } : current)} />
                            </label>
                          </div>
                          <p className="mt-3 text-xs text-portal-soft">Stok tidak diubah dari Edit agar riwayat stok tetap dapat diaudit. Gunakan tombol Tambah stok untuk perubahan jumlah.</p>
                          <button type="button" disabled={actionSaving} onClick={() => void saveEdit(item)} className="portal-button-primary mt-4 min-h-11 disabled:opacity-60">
                            {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan perubahan
                          </button>
                        </div>
                      ) : null}

                      {activePanel.mode === 'stock' ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-portal-soft">
                              Alasan perubahan
                              <select value={stockAction} onChange={event => setStockAction(event.target.value as StockAction)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink">
                                <option value="purchase">Belanja / stok masuk</option>
                                <option value="waste">Rusak / terbuang</option>
                                <option value="other_usage">Pemakaian lain</option>
                                <option value="correction">Koreksi stok</option>
                              </select>
                            </label>
                            <label className="text-xs font-semibold text-portal-soft">
                              Jumlah ({item.recipe_unit})
                              <input type="number" min="0.000001" step="any" value={stockQuantityInput} onChange={event => setStockQuantityInput(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" placeholder="Contoh: 1000" />
                            </label>
                            {stockAction === 'correction' ? (
                              <label className="text-xs font-semibold text-portal-soft">
                                Arah koreksi
                                <select value={correctionDirection} onChange={event => setCorrectionDirection(event.target.value as 'in' | 'out')} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink">
                                  <option value="in">Tambah stok</option>
                                  <option value="out">Kurangi stok</option>
                                </select>
                              </label>
                            ) : null}
                            <label className="text-xs font-semibold text-portal-soft sm:col-span-2">
                              Catatan <span className="font-normal">(opsional untuk belanja)</span>
                              <input value={stockNote} onChange={event => setStockNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" placeholder="Contoh: Belanja Pasar Induk / stok rusak" />
                            </label>
                          </div>
                          <div className="rounded-xl border border-portal-line bg-white p-4">
                            <p className="text-xs font-semibold text-portal-soft">Stok sebelum → sesudah</p>
                            <p className="mt-2 text-xl font-bold text-portal-ink">
                              {n(item.stock_quantity)} → {projectedStock(item)} {item.recipe_unit}
                            </p>
                            {projectedStock(item) < 0 ? <p className="mt-2 text-xs font-semibold text-red-700">Stok tidak boleh menjadi negatif.</p> : null}
                            <p className="mt-2 text-xs text-portal-soft">Lokasi: {primaryLocationName || 'Lokasi utama'}</p>
                            {!primaryLocationId ? <p className="mt-2 text-xs font-semibold text-amber-800">Lokasi utama belum tersedia. Atur lokasi usaha sebelum mengubah stok.</p> : null}
                            <button type="button" disabled={actionSaving || !primaryLocationId || projectedStock(item) < 0} onClick={() => void saveStock(item)} className="portal-button-primary mt-4 min-h-11 w-full justify-center disabled:opacity-50">
                              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan perubahan stok
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {activePanel.mode === 'history' ? (
                        <div className="mt-4">
                          {!primaryLocationId ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Lokasi utama belum tersedia, jadi riwayat stok belum bisa ditampilkan.</p>
                          ) : historyLoading === item.id ? (
                            <div className="flex min-h-20 items-center gap-2 text-sm text-portal-soft"><Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…</div>
                          ) : (movements[item.id] ?? []).length ? (
                            <div className="overflow-hidden rounded-xl border border-portal-line bg-white">
                              <div className="divide-y divide-portal-line">
                                {(movements[item.id] ?? []).map(movement => (
                                  <div key={movement.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                    <div>
                                      <p className="text-sm font-semibold text-portal-ink">{movementLabels[movement.movement_type] ?? movement.movement_type.replaceAll('_', ' ')}</p>
                                      <p className="mt-0.5 text-xs text-portal-soft">{humanDate(movement.created_at)}{movement.note ? ` · ${movement.note}` : ''}</p>
                                    </div>
                                    <div className="text-xs sm:text-right">
                                      <p className={`font-bold ${n(movement.quantity_delta) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{n(movement.quantity_delta) >= 0 ? '+' : ''}{n(movement.quantity_delta)} {item.recipe_unit}</p>
                                      <p className="mt-0.5 text-portal-soft">{n(movement.quantity_before)} → {n(movement.quantity_after)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="rounded-xl border border-portal-line bg-white p-4 text-sm text-portal-soft">Belum ada pergerakan stok yang tercatat untuk bahan ini.</p>
                          )}
                        </div>
                      ) : null}

                      {activePanel.mode === 'archive' ? (
                        <div className="mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4">
                          <p className="font-semibold text-red-900">Arsipkan bahan ini?</p>
                          <p className="mt-1 text-sm leading-6 text-red-800">Bahan akan hilang dari daftar aktif, tetapi riwayat transaksi lama tetap disimpan. Jika masih dipakai resep aktif, sistem akan menolak pengarsipan.</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" disabled={actionSaving} onClick={() => void archiveIngredient(item)} className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ya, arsipkan
                            </button>
                            <button type="button" onClick={() => setActivePanel(null)} className="portal-button-secondary min-h-11">Batal</button>
                          </div>
                        </div>
                      ) : null}

                      {actionMessage ? <p className="mt-3 text-xs font-semibold text-portal-soft" role="status">{actionMessage}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="p-5 text-sm text-portal-soft">
              {ingredients.length
                ? 'Tidak ada bahan yang cocok dengan pencarian atau filter ini.'
                : 'Belum ada bahan. Tambahkan bahan utama atau kemasan pertama agar HPP bisa dihitung dari data nyata.'}
            </div>
          )}
        </div>
      </section>

      <details className="rounded-xl border border-portal-line bg-white group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="font-bold text-portal-ink">Tambah bahan atau kemasan baru</p>
            <p className="mt-0.5 text-xs text-portal-soft">Input sekali, lalu gunakan di stok dan resep HPP.</p>
          </div>
          <ChevronDown className="h-4 w-4 text-portal-soft transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-portal-soft">Nama
              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" placeholder="Contoh: Alpukat" value={name} onChange={event => setName(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Jenis
              <select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" value={kind} onChange={event => setKind(event.target.value)}>
                {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Harga beli
              <input type="number" min="0" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" placeholder="34000" value={purchasePrice} onChange={event => setPurchasePrice(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Jumlah beli
              <input type="number" step="any" min="0.0001" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={purchaseQuantity} onChange={event => setPurchaseQuantity(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Unit beli
              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={purchaseUnit} onChange={event => setPurchaseUnit(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Unit resep
              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={recipeUnit} onChange={event => setRecipeUnit(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Konversi
              <input type="number" step="any" min="0.0001" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={conversionFactor} onChange={event => setConversionFactor(event.target.value)} />
              <span className="mt-1 block font-normal">Contoh 1 kg = 1000 gram.</span>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Hasil terpakai %
              <input type="number" min="1" max="100" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={yieldPercent} onChange={event => setYieldPercent(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Susut %
              <input type="number" min="0" max="99" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={wastePercent} onChange={event => setWastePercent(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Stok awal ({recipeUnit || 'unit resep'})
              <input type="number" min="0" step="any" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={stockQuantity} onChange={event => setStockQuantity(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Batas minimum
              <input type="number" min="0" step="any" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={minimumStock} onChange={event => setMinimumStock(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Supplier <span className="font-normal">(opsional)</span>
              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" value={supplier} onChange={event => setSupplier(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || !canManage} onClick={() => void save()} className="portal-button-primary min-h-11 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan bahan
            </button>
            {message ? <p className="text-xs text-portal-soft" role="status">{message}</p> : null}
          </div>
        </div>
      </details>

      {!canManage ? (
        <p className="rounded-xl border border-portal-line bg-white p-4 text-sm text-portal-soft">
          Kamu dapat melihat bahan dan riwayat stok, tetapi peranmu tidak memiliki izin untuk mengubahnya.
        </p>
      ) : null}
    </div>
  );
}
