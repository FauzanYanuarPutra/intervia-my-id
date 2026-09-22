'use client';

import { RupiahInput } from '@/components/forms/RupiahInput';
import { useMemo, useRef, useState } from 'react';
import {
  Archive,
  ChevronDown,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import {
  resolveIdempotencyAttempt,
  type ClientIdempotencyAttempt,
} from '@/lib/client-idempotency';
import {
  effectiveIngredientUnitCost,
  ingredientNumber,
  needsIngredientPurchase,
  suggestIngredientUnits,
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
  movement_type: string;
  quantity_delta: string | number;
  quantity_before: string | number;
  quantity_after: string | number;
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
  hasLoss: boolean;
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

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const kindLabels: Record<string, string> = {
  ingredient: 'Bahan baku',
  packaging: 'Kemasan',
  semi_finished: 'Bahan olahan',
  utility: 'Utilitas langsung',
  labor: 'Tenaga langsung',
};

const kindOptions = Object.entries(kindLabels).map(([value, label]) => ({ value, label }));
const stockActionOptions: Array<{ value: StockAction; label: string }> = [
  { value: 'purchase', label: 'Belanja / stok masuk' },
  { value: 'waste', label: 'Rusak / terbuang' },
  { value: 'other_usage', label: 'Pemakaian lain' },
  { value: 'correction', label: 'Koreksi stok' },
];
const correctionDirectionOptions = [
  { value: 'in', label: 'Tambah stok' },
  { value: 'out', label: 'Kurangi stok' },
] as const;

const movementLabels: Record<string, string> = {
  purchase_receipt: 'Belanja / stok masuk',
  waste: 'Rusak / terbuang',
  adjustment: 'Koreksi stok',
  return_in: 'Pengembalian masuk',
  return_out: 'Pemakaian lain',
  stocktake_adjustment: 'Cocokkan stok',
  sale_consumption: 'Terpakai untuk penjualan',
};

const commonUnits = [
  'kg',
  'gram',
  'liter',
  'ml',
  'pcs',
  'lusin',
  'dus',
  'pack',
  'botol',
  'karung',
  'meter',
  'roll',
];

function n(value: string | number | null | undefined) {
  return ingredientNumber(value);
}

function clampYield(value: string | number) {
  return Math.min(100, Math.max(0, n(value)));
}

function lossFromYield(value: string | number) {
  return Math.max(0, 100 - clampYield(value));
}

function normalizedUsableYield(item: Pick<Ingredient, 'yield_percent' | 'waste_percent'>) {
  const baseYield = clampYield(item.yield_percent) || 100;
  const legacyWaste = Math.min(100, Math.max(0, n(item.waste_percent)));
  return Math.max(0, Math.min(100, baseYield * (1 - legacyWaste / 100)));
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

function draftFromIngredient(item: Ingredient): EditDraft {
  const usable = normalizedUsableYield(item);
  return {
    name: item.name,
    kind: item.kind,
    purchaseUnit: item.purchase_unit,
    recipeUnit: item.recipe_unit,
    conversionFactor: String(item.conversion_factor),
    purchasePrice: String(item.purchase_price_amount),
    purchaseQuantity: String(item.purchase_quantity),
    yieldPercent: String(usable),
    hasLoss: usable < 100,
    minimumStock: String(item.minimum_stock),
    supplier: item.supplier_name ?? '',
  };
}

function UnitList() {
  return (
    <datalist id="ingredient-common-units">
      {commonUnits.map(unit => <option key={unit} value={unit} />)}
    </datalist>
  );
}

export function IngredientWorkspace({
  businessId,
  initialIngredients,
  primaryLocationId = null,
  primaryLocationName = null,
  canManage = true,
}: Props) {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [query, setQuery] = useState('');

  const [name, setName] = useState('');
  const [kind, setKind] = useState('ingredient');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [recipeUnit, setRecipeUnit] = useState('gram');
  const [conversionFactor, setConversionFactor] = useState('1000');
  const [hasLoss, setHasLoss] = useState(false);
  const [yieldPercent, setYieldPercent] = useState('100');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minimumStock, setMinimumStock] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [activePanel, setActivePanel] = useState<{ id: string; mode: PanelMode } | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editReason, setEditReason] = useState('Pembaruan bahan');
  const [archiveReason, setArchiveReason] = useState('');
  const [stockAction, setStockAction] = useState<StockAction>('purchase');
  const [stockQuantityInput, setStockQuantityInput] = useState('');
  const [correctionDirection, setCorrectionDirection] = useState<'in' | 'out'>('in');
  const [stockNote, setStockNote] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [movements, setMovements] = useState<Record<string, Movement[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const stockAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  const visibleIngredients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id-ID');
    if (!normalized) return ingredients;
    return ingredients.filter(item =>
      item.name.toLocaleLowerCase('id-ID').includes(normalized) ||
      item.supplier_name?.toLocaleLowerCase('id-ID').includes(normalized),
    );
  }, [ingredients, query]);

  const lowStockCount = useMemo(
    () => ingredients.filter(item => needsIngredientPurchase(item)).length,
    [ingredients],
  );

  async function reload() {
    const response = await fetch(`/api/businesses/${businessId}/ingredients`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Gagal memuat ulang bahan.');
    const payload = await response.json();
    setIngredients(Array.isArray(payload?.data?.items) ? payload.data.items : []);
  }

  function suggestUnitsForPurchaseUnit(value: string, target: 'create' | 'edit') {
    const suggestion = suggestIngredientUnits(value);
    if (!suggestion.recipeUnit) return;
    if (target === 'create') {
      setRecipeUnit(suggestion.recipeUnit);
      setConversionFactor(String(suggestion.conversionFactor));
      return;
    }
    setEditDraft(current => current ? {
      ...current,
      recipeUnit: suggestion.recipeUnit,
      conversionFactor: String(suggestion.conversionFactor),
    } : current);
  }

  function validateMaterial(input: {
    name: string;
    purchaseUnit: string;
    recipeUnit: string;
    purchaseQuantity: string;
    conversionFactor: string;
    purchasePrice: string;
    yieldPercent: string;
  }) {
    if (input.name.trim().length < 2) return 'Isi nama bahan atau kemasan.';
    if (!input.purchaseUnit.trim()) return 'Isi satuan saat membeli, misalnya kg, botol, dus, atau pcs.';
    if (!input.recipeUnit.trim()) return 'Isi satuan yang dipakai dalam resep.';
    if (n(input.purchaseQuantity) <= 0) return 'Jumlah pembelian harus lebih dari 0.';
    if (n(input.conversionFactor) <= 0) return 'Isi hubungan satuan pembelian dengan satuan pemakaian.';
    if (n(input.purchasePrice) < 0) return 'Harga beli tidak boleh negatif.';
    const usable = n(input.yieldPercent);
    if (usable <= 0 || usable > 100) return 'Bagian yang dapat digunakan harus antara 1% sampai 100%.';
    return '';
  }

  function resetCreateForm() {
    setName('');
    setKind('ingredient');
    setPurchaseUnit('kg');
    setPurchaseQuantity('1');
    setPurchasePrice('');
    setRecipeUnit('gram');
    setConversionFactor('1000');
    setHasLoss(false);
    setYieldPercent('100');
    setStockQuantity('0');
    setMinimumStock('0');
    setSupplier('');
  }

  async function save() {
    const usableYield = hasLoss ? yieldPercent : '100';
    const validation = validateMaterial({
      name,
      purchaseUnit,
      recipeUnit,
      purchaseQuantity,
      conversionFactor,
      purchasePrice,
      yieldPercent: usableYield,
    });
    if (validation) {
      setMessage(validation);
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
          yield_percent: n(usableYield),
          // Yield already represents the part lost before it is usable. Keep
          // legacy waste at zero so HPP does not apply the same loss twice.
          waste_percent: 0,
          stock_quantity: n(stockQuantity),
          minimum_stock: n(minimumStock),
          supplier_name: supplier.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal menyimpan bahan.'));
      await reload();
      resetCreateForm();
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
    stockAttemptRef.current = null;
    setActivePanel({ id: item.id, mode: 'stock' });
  }

  async function openHistory(item: Ingredient) {
    setActionMessage('');
    setActivePanel({ id: item.id, mode: 'history' });
    if (!primaryLocationId) {
      setActionMessage('Lokasi utama belum tersedia sehingga riwayat stok per lokasi belum bisa dimuat.');
      return;
    }
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
      setActionMessage(error instanceof Error ? error.message : 'Gagal memuat riwayat stok.');
    } finally {
      setHistoryLoading(null);
    }
  }

  async function saveEdit(item: Ingredient) {
    if (!editDraft) return;
    const usableYield = editDraft.hasLoss ? editDraft.yieldPercent : '100';
    const validation = validateMaterial({
      name: editDraft.name,
      purchaseUnit: editDraft.purchaseUnit,
      recipeUnit: editDraft.recipeUnit,
      purchaseQuantity: editDraft.purchaseQuantity,
      conversionFactor: editDraft.conversionFactor,
      purchasePrice: editDraft.purchasePrice,
      yieldPercent: usableYield,
    });
    if (validation) {
      setActionMessage(validation);
      return;
    }

    if (editReason.trim().length < 3) {
      setActionMessage('Tulis alasan perubahan minimal 3 karakter agar perubahan bahan bisa ditelusuri.');
      return;
    }

    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/ingredients/${item.id}`, {
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
          yield_percent: n(usableYield),
          waste_percent: 0,
          minimum_stock: n(editDraft.minimumStock),
          supplier_name: editDraft.supplier.trim() || null,
          reason: editReason.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal memperbarui bahan.'));
      await reload();
      setEditReason('Pembaruan bahan');
      setActionMessage('Perubahan tersimpan. Stok tidak diubah dari Edit agar riwayat tetap dapat diaudit.');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Gagal memperbarui bahan.');
    } finally {
      setActionSaving(false);
    }
  }

  function projectedStock(item: Ingredient) {
    const quantity = n(stockQuantityInput);
    const before = n(item.stock_quantity);
    if (!quantity) return before;
    if (stockAction === 'purchase') return before + quantity;
    if (stockAction === 'waste' || stockAction === 'other_usage') return before - quantity;
    return correctionDirection === 'out' ? before - quantity : before + quantity;
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
    if (projectedStock(item) < 0) {
      setActionMessage('Stok tidak boleh menjadi negatif.');
      return;
    }

    const stockPayload = {
      location_id: primaryLocationId,
      action: stockAction,
      quantity,
      direction: correctionDirection,
      note: stockNote,
    };
    const attempt = resolveIdempotencyAttempt(stockAttemptRef.current, {
      ingredientId: item.id,
      ...stockPayload,
    });
    stockAttemptRef.current = attempt;

    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ingredients/${item.id}/stock-adjustments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
          },
          body: JSON.stringify(stockPayload),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal memperbarui stok.'));
      stockAttemptRef.current = null;
      await reload();
      const command = payload?.data?.command;
      setStockQuantityInput('');
      setActionMessage(command
        ? `Stok tersimpan: ${n(command.quantity_before)} → ${n(command.quantity_after)} ${item.recipe_unit}.`
        : 'Perubahan stok tersimpan.');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Gagal memperbarui stok.');
    } finally {
      setActionSaving(false);
    }
  }

  async function archiveIngredient(item: Ingredient) {
    if (archiveReason.trim().length < 3) {
      setActionMessage('Tulis alasan pengarsipan minimal 3 karakter.');
      return;
    }
    setActionSaving(true);
    setActionMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/ingredients/${item.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(payload, 'Gagal mengarsipkan bahan.'));
      await reload();
      setArchiveReason('');
      setActivePanel(null);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Gagal mengarsipkan bahan.');
    } finally {
      setActionSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <UnitList />

      <section className="portal-panel px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span><strong className="text-lg text-portal-ink">{ingredients.length}</strong> <span className="text-portal-soft">bahan & kemasan</span></span>
          <span className={lowStockCount ? 'font-semibold text-amber-800' : 'text-portal-soft'}>{lowStockCount} perlu perhatian</span>
          {primaryLocationName ? <span className="ml-auto text-xs text-portal-soft">Stok: {primaryLocationName}</span> : null}
        </div>
      </section>

      <details className="rounded-xl border border-portal-line bg-white group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="font-bold text-portal-ink">Tambah bahan</p>
            <p className="mt-0.5 text-xs text-portal-soft">Buka hanya saat mau menambah bahan baru.</p>
          </div>
          <ChevronDown className="h-4 w-4 text-portal-soft transition group-open:rotate-180" />
        </summary>

        <div className="border-t border-portal-line p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-xs font-semibold text-portal-soft">
              Nama
              <input className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" placeholder="Contoh: Alpukat" value={name} onChange={event => setName(event.target.value)} />
            </label>
            <div className="text-xs font-semibold text-portal-soft">
              <span>Kategori</span>
              <div className="mt-1">
                <ChoiceChips value={kind} onChange={setKind} ariaLabel="Kategori bahan" options={kindOptions} />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-portal-line bg-[#fafbf9] p-4">
            <p className="text-sm font-bold text-portal-ink">Pembelian</p>
            <p className="mt-1 text-xs text-portal-soft">Bagaimana biasanya bahan ini dibeli?</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <span className="pb-3 text-sm text-portal-soft">Saya membeli</span>
              <label className="w-24 text-[11px] font-semibold text-portal-soft">Jumlah
                <input type="number" min="0.0001" step="any" value={purchaseQuantity} onChange={event => setPurchaseQuantity(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" />
              </label>
              <label className="w-28 text-[11px] font-semibold text-portal-soft">Satuan
                <input list="ingredient-common-units" value={purchaseUnit} onChange={event => setPurchaseUnit(event.target.value)} onBlur={() => suggestUnitsForPurchaseUnit(purchaseUnit, 'create')} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" />
              </label>
              <span className="pb-3 text-sm text-portal-soft">seharga</span>
              <label className="min-w-40 flex-1 text-[11px] font-semibold text-portal-soft">Harga total
                <div className="mt-1 flex min-h-11 items-center rounded-xl border border-portal-line bg-white px-3">
                  <span className="mr-2 text-sm text-portal-soft">Rp</span>
                  <RupiahInput min={0} value={purchasePrice ? Number(purchasePrice) : null} onValueChange={value => setPurchasePrice(value == null ? '' : String(value))} placeholder="Masukkan nominal" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-portal-ink outline-none pl-0" />
                </div>
              </label>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-portal-line p-4">
            <p className="text-sm font-bold text-portal-ink">Pemakaian</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">
                Dipakai dalam resep sebagai
                <input list="ingredient-common-units" value={recipeUnit} onChange={event => setRecipeUnit(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" />
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Isi setiap {purchaseUnit || 'unit pembelian'}
                <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-portal-line px-3 text-sm">
                  <span>1 {purchaseUnit || 'unit'} =</span>
                  <input type="number" min="0.0001" step="any" value={conversionFactor} onChange={event => setConversionFactor(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-right font-bold text-portal-ink outline-none" />
                  <span className="text-portal-soft">{recipeUnit || 'unit'}</span>
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-[#fafbf9] p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-portal-ink">
                <span>Ada bagian yang biasanya tidak terpakai?</span>
                <input type="checkbox" checked={hasLoss} onChange={event => {
                  setHasLoss(event.target.checked);
                  setYieldPercent(event.target.checked ? '90' : '100');
                }} className="h-4 w-4" />
              </label>
              {hasLoss ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                  <label className="text-xs font-semibold text-portal-soft">Bagian yang dapat digunakan
                    <div className="mt-1 flex min-h-11 items-center rounded-xl border border-portal-line bg-white px-3">
                      <input type="number" min="1" max="100" step="any" value={yieldPercent} onChange={event => setYieldPercent(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
                      <span className="text-sm text-portal-soft">%</span>
                    </div>
                  </label>
                  <p className="pb-2 text-xs text-portal-soft">Artinya sekitar <strong>{number.format(lossFromYield(yieldPercent))}%</strong> tidak terpakai. Lajukan memasukkan ini satu kali saja ke HPP.</p>
                </div>
              ) : <p className="mt-2 text-xs text-portal-soft">Seluruh jumlah dianggap dapat dipakai. Aktifkan jika ada kulit, biji, potongan, atau hasil bersih yang lebih sedikit.</p>}
            </div>
          </div>

          <div className="mt-3 grid gap-4 rounded-xl border border-portal-line p-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-portal-soft">Stok awal yang siap dipakai ({recipeUnit || 'unit'})
              <input type="number" min="0" step="any" value={stockQuantity} onChange={event => setStockQuantity(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" />
              <span className="mt-1 block font-normal">Masukkan dalam satuan pemakaian agar stok dan resep memakai angka yang sama.</span>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Beri peringatan jika stok di bawah ({recipeUnit || 'unit'})
              <input type="number" min="0" step="any" value={minimumStock} onChange={event => setMinimumStock(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Supplier <span className="font-normal">(opsional)</span>
              <input value={supplier} onChange={event => setSupplier(event.target.value)} placeholder="Contoh: Pasar Induk" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || !canManage} onClick={() => void save()} className="portal-button-primary min-h-11 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan bahan
            </button>
            {message ? <p className="text-xs font-semibold text-portal-soft" role="status">{message}</p> : null}
          </div>
        </div>
      </details>

      <section className="overflow-hidden rounded-xl border border-portal-line bg-white">
        <div className="border-b border-portal-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-bold text-portal-ink">Bahan yang sudah tercatat</h2>
              <p className="mt-1 text-xs text-portal-soft">Harga efektif, stok, dan bagian terpakai dihitung dari cara pembelian di atas.</p>
            </div>
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari bahan atau supplier" className="min-h-11 w-full rounded-xl border border-portal-line pl-9 pr-3 text-sm text-portal-ink" />
            </label>
          </div>
        </div>

        <div className="divide-y divide-portal-line">
          {visibleIngredients.length ? visibleIngredients.map(item => {
            const usable = normalizedUsableYield(item);
            const effectiveCost = effectiveIngredientUnitCost({ ...item, yield_percent: usable });
            const loss = lossFromYield(usable);
            const low = needsIngredientPurchase(item);
            const panelOpen = activePanel?.id === item.id;
            return (
              <div key={item.id}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-portal-ink">{item.name}</p>
                        <span className="rounded-full border border-portal-line px-2 py-0.5 text-[11px] text-portal-soft">{kindLabels[item.kind] ?? item.kind}</span>
                        {low ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Perlu belanja</span> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-portal-soft">
                        <span><strong className="text-portal-ink">{number.format(n(item.stock_quantity))} {item.recipe_unit}</strong> tersedia</span>
                        <span>{money.format(item.purchase_price_amount)} untuk {number.format(n(item.purchase_quantity))} {item.purchase_unit}</span>
                        <span className={effectiveCost === null ? 'font-semibold text-amber-800' : 'font-semibold text-portal-forest'}>{effectiveCost === null ? 'Modal belum bisa dihitung' : `${unitMoney.format(effectiveCost)} / ${item.recipe_unit}`}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft">
                        <span>1 {item.purchase_unit} = {number.format(n(item.conversion_factor))} {item.recipe_unit}</span>
                        <span>{number.format(usable)}% dapat digunakan</span>
                        <span>{number.format(loss)}% tidak terpakai</span>
                        {item.supplier_name ? <span>Supplier: {item.supplier_name}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={!canManage} onClick={() => openStock(item)} className="portal-button-primary min-h-10 disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah stok</button>
                      <button type="button" disabled={!canManage} onClick={() => openEdit(item)} className="portal-button-secondary min-h-10 disabled:opacity-50"><Pencil className="h-4 w-4" /> Edit</button>
                      <button type="button" onClick={() => void openHistory(item)} className="portal-button-secondary min-h-10"><History className="h-4 w-4" /> Riwayat</button>
                      <button type="button" disabled={!canManage} onClick={() => { setActionMessage(''); setActivePanel({ id: item.id, mode: 'archive' }); }} className="portal-button-ghost min-h-10 text-red-700 disabled:opacity-50"><Archive className="h-4 w-4" /> Arsipkan</button>
                    </div>
                  </div>
                </div>

                {panelOpen ? (
                  <div className="border-t border-portal-line bg-portal-mist/40 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-portal-ink">
                        {activePanel.mode === 'edit' ? `Edit ${item.name}` : activePanel.mode === 'stock' ? `Ubah stok ${item.name}` : activePanel.mode === 'history' ? `Riwayat ${item.name}` : `Arsipkan ${item.name}`}
                      </p>
                      <button type="button" onClick={() => setActivePanel(null)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-portal-soft hover:bg-white">Tutup</button>
                    </div>

                    {activePanel.mode === 'edit' && editDraft ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-portal-soft">Nama<input value={editDraft.name} onChange={event => setEditDraft(current => current ? { ...current, name: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                          <div className="text-xs font-semibold text-portal-soft"><span>Kategori</span><div className="mt-1"><ChoiceChips value={editDraft.kind} onChange={value => setEditDraft(current => current ? { ...current, kind: value } : current)} ariaLabel="Kategori bahan" options={kindOptions} /></div></div>
                        </div>
                        <div className="rounded-xl border border-portal-line bg-white p-4">
                          <p className="text-xs font-bold text-portal-soft">Cara membeli</p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            <label className="text-xs font-semibold text-portal-soft">Jumlah<input type="number" min="0.0001" step="any" value={editDraft.purchaseQuantity} onChange={event => setEditDraft(current => current ? { ...current, purchaseQuantity: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                            <label className="text-xs font-semibold text-portal-soft">Satuan beli<input list="ingredient-common-units" value={editDraft.purchaseUnit} onChange={event => setEditDraft(current => current ? { ...current, purchaseUnit: event.target.value } : current)} onBlur={() => suggestUnitsForPurchaseUnit(editDraft.purchaseUnit, 'edit')} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                            <label className="text-xs font-semibold text-portal-soft">Harga total
                              <RupiahInput
                                min={0}
                                value={editDraft.purchasePrice ? Number(editDraft.purchasePrice) : null}
                                onValueChange={value =>
                                  setEditDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          purchasePrice: value == null ? '' : String(value),
                                        }
                                      : current,
                                  )
                                }
                                placeholder="Masukkan nominal"
                                className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm"
                              />
                            </label>
                          </div>
                        </div>
                        <div className="grid gap-3 rounded-xl border border-portal-line bg-white p-4 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-portal-soft">Dipakai dalam resep sebagai<input list="ingredient-common-units" value={editDraft.recipeUnit} onChange={event => setEditDraft(current => current ? { ...current, recipeUnit: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                          <label className="text-xs font-semibold text-portal-soft">1 {editDraft.purchaseUnit || 'unit'} berisi berapa {editDraft.recipeUnit || 'unit'}?<input type="number" min="0.0001" step="any" value={editDraft.conversionFactor} onChange={event => setEditDraft(current => current ? { ...current, conversionFactor: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-portal-soft sm:col-span-2"><input type="checkbox" checked={editDraft.hasLoss} onChange={event => setEditDraft(current => current ? { ...current, hasLoss: event.target.checked, yieldPercent: event.target.checked ? (n(current.yieldPercent) < 100 ? current.yieldPercent : '90') : '100' } : current)} /> Ada bagian yang biasanya tidak terpakai?</label>
                          {editDraft.hasLoss ? <label className="text-xs font-semibold text-portal-soft">Bagian yang dapat digunakan (%)<input type="number" min="1" max="100" step="any" value={editDraft.yieldPercent} onChange={event => setEditDraft(current => current ? { ...current, yieldPercent: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /><span className="mt-1 block font-normal">{number.format(lossFromYield(editDraft.yieldPercent))}% dianggap tidak terpakai.</span></label> : null}
                          <label className="text-xs font-semibold text-portal-soft">Beri peringatan jika stok di bawah ({editDraft.recipeUnit || 'unit'})<input type="number" min="0" step="any" value={editDraft.minimumStock} onChange={event => setEditDraft(current => current ? { ...current, minimumStock: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                          <label className="text-xs font-semibold text-portal-soft">Supplier (opsional)<input value={editDraft.supplier} onChange={event => setEditDraft(current => current ? { ...current, supplier: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                        </div>
                        <p className="text-xs text-portal-soft">Stok tidak diubah dari Edit agar riwayat stok tetap dapat diaudit. Gunakan tombol <strong>Tambah stok</strong> untuk perubahan jumlah.</p>
                        <label className="text-xs font-semibold text-portal-soft">Catatan perubahan<input value={editReason} onChange={event => setEditReason(event.target.value)} maxLength={500} placeholder="Contoh: harga pemasok naik" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm text-portal-ink" /></label>
                        <button type="button" disabled={actionSaving} onClick={() => void saveEdit(item)} className="portal-button-primary min-h-11 disabled:opacity-50">{actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan perubahan</button>
                      </div>
                    ) : null}

                    {activePanel.mode === 'stock' ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="text-xs font-semibold text-portal-soft"><span>Alasan perubahan</span><div className="mt-1"><ChoiceChips value={stockAction} onChange={setStockAction} ariaLabel="Alasan perubahan stok" options={stockActionOptions} /></div></div>
                          <label className="text-xs font-semibold text-portal-soft">Jumlah ({item.recipe_unit})<input type="number" min="0.000001" step="any" value={stockQuantityInput} onChange={event => setStockQuantityInput(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                          {stockAction === 'correction' ? <div className="text-xs font-semibold text-portal-soft"><span>Arah koreksi</span><div className="mt-1"><ChoiceChips value={correctionDirection} onChange={setCorrectionDirection} ariaLabel="Arah koreksi stok" options={correctionDirectionOptions} /></div></div> : null}
                          <label className="text-xs font-semibold text-portal-soft sm:col-span-2">Catatan <span className="font-normal">(opsional)</span><input value={stockNote} onChange={event => setStockNote(event.target.value)} placeholder="Contoh: Belanja Pasar Induk" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-sm" /></label>
                        </div>
                        <div className="rounded-xl border border-portal-line bg-white p-4">
                          <p className="text-xs font-semibold text-portal-soft">Stok sebelum → sesudah</p>
                          <p className="mt-2 text-xl font-bold text-portal-ink">{number.format(n(item.stock_quantity))} → {number.format(projectedStock(item))} {item.recipe_unit}</p>
                          <p className="mt-2 text-xs text-portal-soft">Lokasi: {primaryLocationName || 'Lokasi utama'}</p>
                          <button type="button" disabled={actionSaving || !primaryLocationId || projectedStock(item) < 0} onClick={() => void saveStock(item)} className="portal-button-primary mt-4 min-h-11 w-full justify-center disabled:opacity-50">Simpan stok</button>
                        </div>
                      </div>
                    ) : null}

                    {activePanel.mode === 'history' ? (
                      <div className="mt-4">
                        {historyLoading === item.id ? <p className="flex items-center gap-2 text-sm text-portal-soft"><Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat...</p> : movements[item.id]?.length ? <div className="divide-y divide-portal-line rounded-xl border border-portal-line bg-white">{movements[item.id].map(movement => <div key={movement.id} className="p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong className="text-portal-ink">{movementLabels[movement.movement_type] ?? movement.movement_type}</strong><span className="text-portal-soft">{humanDate(movement.created_at)}</span></div><p className="mt-1 text-portal-soft">{number.format(n(movement.quantity_before))} → {number.format(n(movement.quantity_after))} {item.recipe_unit} ({n(movement.quantity_delta) >= 0 ? '+' : ''}{number.format(n(movement.quantity_delta))})</p>{movement.note ? <p className="mt-1 text-portal-soft">{movement.note}</p> : null}</div>)}</div> : <p className="text-sm text-portal-soft">Belum ada riwayat stok untuk bahan ini.</p>}
                      </div>
                    ) : null}

                    {activePanel.mode === 'archive' ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-bold text-red-800">Arsipkan {item.name}?</p>
                        <p className="mt-1 text-xs leading-5 text-red-700">Bahan tidak lagi tersedia untuk transaksi baru. Riwayat lama tetap tersimpan dan bisa ditelusuri.</p>
                        <label className="mt-3 block text-xs font-semibold text-red-800">Alasan pengarsipan<input value={archiveReason} onChange={event => setArchiveReason(event.target.value)} maxLength={500} placeholder="Contoh: supplier berhenti menyediakan" className="mt-1 min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm text-portal-ink" /></label>
                        <button type="button" disabled={actionSaving || archiveReason.trim().length < 3} onClick={() => void archiveIngredient(item)} className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">Ya, arsipkan</button>
                      </div>
                    ) : null}

                    {actionMessage ? <p className="mt-3 text-xs font-semibold text-portal-soft" role="status">{actionMessage}</p> : null}
                  </div>
                ) : null}
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">{ingredients.length ? 'Tidak ada bahan yang cocok dengan pencarian.' : 'Belum ada bahan. Tambahkan bahan pertama dari form di atas.'}</div>}
        </div>
      </section>

      {!canManage ? <p className="rounded-xl border border-portal-line bg-white p-4 text-sm text-portal-soft">Kamu dapat melihat bahan dan riwayat stok, tetapi peranmu tidak memiliki izin untuk mengubahnya.</p> : null}
    </div>
  );
}
