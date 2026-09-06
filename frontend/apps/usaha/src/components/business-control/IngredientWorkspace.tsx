'use client';

import { useMemo, useState } from 'react';
import { Loader2, PackagePlus, Plus, TriangleAlert } from 'lucide-react';

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

type Props = {
  businessId: string;
  initialIngredients: Ingredient[];
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const kindLabels: Record<string, string> = {
  ingredient: 'Bahan',
  packaging: 'Kemasan',
  semi_finished: 'Bahan olahan',
  utility: 'Utilitas langsung',
  labor: 'Tenaga langsung',
};

function n(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function IngredientWorkspace({ businessId, initialIngredients }: Props) {
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

  const lowStock = useMemo(
    () => ingredients.filter(item => n(item.stock_quantity) <= n(item.minimum_stock) && n(item.minimum_stock) > 0),
    [ingredients],
  );

  async function reload() {
    const response = await fetch(`/api/businesses/${businessId}/ingredients`, { cache: 'no-store' });
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
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan bahan.');
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

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="portal-panel p-4">
          <div className="portal-icon-tile"><PackagePlus className="h-4 w-4" /></div>
          <p className="mt-3 text-2xl font-bold text-portal-ink">{ingredients.length}</p>
          <p className="mt-1 text-xs text-portal-soft">Bahan & kemasan tersimpan</p>
        </div>
        <div className="portal-panel p-4">
          <div className="portal-icon-tile"><TriangleAlert className="h-4 w-4" /></div>
          <p className="mt-3 text-2xl font-bold text-portal-ink">{lowStock.length}</p>
          <p className="mt-1 text-xs text-portal-soft">Sudah menyentuh batas minimum</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Prinsip stok</p>
          <p className="mt-2 font-bold text-portal-ink">Catat yang benar-benar membatasi jualan</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Buah, susu, cup, seal, sedotan, atau bahan olahan bisa sama-sama menjadi pembatas produksi.</p>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div>
          <p className="portal-kicker">Tambah bahan / kemasan</p>
          <h2 className="mt-1 text-lg font-bold text-portal-ink">Input sekali, dipakai di stok dan HPP</h2>
          <p className="mt-1 text-sm text-portal-soft">Isi versi sederhana dulu. Yield dan susut bisa dipakai untuk bahan seperti buah yang tidak 100% menjadi produk.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-portal-soft">Nama
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Contoh: Alpukat" value={name} onChange={event => setName(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Jenis
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={kind} onChange={event => setKind(event.target.value)}>
              {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Harga beli
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="34000" value={purchasePrice} onChange={event => setPurchasePrice(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Jumlah beli
            <input type="number" step="any" min="0.0001" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={purchaseQuantity} onChange={event => setPurchaseQuantity(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Unit beli
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={purchaseUnit} onChange={event => setPurchaseUnit(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Unit resep
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={recipeUnit} onChange={event => setRecipeUnit(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Konversi
            <input type="number" step="any" min="0.0001" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={conversionFactor} onChange={event => setConversionFactor(event.target.value)} />
            <span className="mt-1 block font-normal">Contoh 1 kg = 1000 gram.</span>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Hasil terpakai %
            <input type="number" min="1" max="100" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={yieldPercent} onChange={event => setYieldPercent(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Susut %
            <input type="number" min="0" max="99" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={wastePercent} onChange={event => setWastePercent(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Stok tersedia ({recipeUnit || 'unit resep'})
            <input type="number" min="0" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={stockQuantity} onChange={event => setStockQuantity(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Batas minimum
            <input type="number" min="0" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={minimumStock} onChange={event => setMinimumStock(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Supplier <span className="font-normal">(opsional)</span>
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={supplier} onChange={event => setSupplier(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving} onClick={save} className="portal-button-primary disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan bahan
          </button>
          {message ? <p className="text-xs text-portal-soft">{message}</p> : null}
        </div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="border-b border-portal-line p-4 sm:p-5">
          <h2 className="font-bold text-portal-ink">Bahan & kemasan saat ini</h2>
          <p className="mt-1 text-sm text-portal-soft">Harga beli, yield, dan stok ini menjadi sumber perhitungan HPP resep.</p>
        </div>
        <div className="divide-y divide-portal-line">
          {ingredients.length ? ingredients.map(item => {
            const low = n(item.minimum_stock) > 0 && n(item.stock_quantity) <= n(item.minimum_stock);
            return (
              <div key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-portal-ink">{item.name}</p>
                    <span className="rounded-full border border-portal-line px-2 py-0.5 text-[11px] text-portal-soft">{kindLabels[item.kind] ?? item.kind}</span>
                    {low ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Perlu belanja</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-portal-soft">Stok {n(item.stock_quantity)} {item.recipe_unit} · minimum {n(item.minimum_stock)} · supplier {item.supplier_name || '-'}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-portal-ink">{money.format(item.purchase_price_amount)}</p>
                  <p className="mt-1 text-xs text-portal-soft">per {n(item.purchase_quantity)} {item.purchase_unit} · yield {n(item.yield_percent)}%</p>
                </div>
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">Belum ada bahan. Tambahkan bahan utama atau kemasan pertama agar HPP bisa dihitung dari data nyata.</div>}
        </div>
      </section>
    </div>
  );
}
