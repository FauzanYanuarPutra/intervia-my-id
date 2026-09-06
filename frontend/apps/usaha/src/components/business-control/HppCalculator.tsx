'use client';

import { useMemo, useState } from 'react';
import { Calculator, PackagePlus, Plus, Trash2, TriangleAlert } from 'lucide-react';
import {
  calculateProductionCapacity,
  calculateRecipeCost,
  type IngredientCostInput,
} from '@/lib/business-control/costing';

type CostRow = IngredientCostInput & {
  id: string;
  unitLabel: string;
  availableQuantity: number;
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const starterRows: CostRow[] = [
  { id: 'avocado', name: 'Alpukat', purchasePrice: 34000, purchaseQuantity: 1, conversionFactor: 1000, yieldPercent: 80, wastePercent: 0, recipeQuantity: 125, unitLabel: 'gram', availableQuantity: 2200 },
  { id: 'sugar', name: 'Gula', purchasePrice: 18000, purchaseQuantity: 1, conversionFactor: 1000, yieldPercent: 100, wastePercent: 0, recipeQuantity: 20, unitLabel: 'gram', availableQuantity: 1800 },
  { id: 'milk', name: 'SKM', purchasePrice: 15000, purchaseQuantity: 500, conversionFactor: 1, yieldPercent: 100, wastePercent: 0, recipeQuantity: 25, unitLabel: 'ml', availableQuantity: 650 },
  { id: 'ice', name: 'Es', purchasePrice: 12000, purchaseQuantity: 10000, conversionFactor: 1, yieldPercent: 100, wastePercent: 3, recipeQuantity: 180, unitLabel: 'gram', availableQuantity: 8000 },
  { id: 'cup', name: 'Cup 16 oz', purchasePrice: 25000, purchaseQuantity: 50, conversionFactor: 1, yieldPercent: 100, wastePercent: 0, recipeQuantity: 1, unitLabel: 'pcs', availableQuantity: 11 },
  { id: 'straw', name: 'Sedotan', purchasePrice: 8000, purchaseQuantity: 100, conversionFactor: 1, yieldPercent: 100, wastePercent: 0, recipeQuantity: 1, unitLabel: 'pcs', availableQuantity: 80 },
];

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function HppCalculator() {
  const [rows, setRows] = useState<CostRow[]>(starterRows);
  const [sellingPrice, setSellingPrice] = useState(12000);

  const recipe = useMemo(() => {
    try {
      return calculateRecipeCost(rows);
    } catch {
      return { breakdown: [], totalCost: 0 };
    }
  }, [rows]);

  const capacity = useMemo(
    () => calculateProductionCapacity(rows.map(row => ({ name: row.name, availableQuantity: row.availableQuantity, recipeQuantity: row.recipeQuantity }))),
    [rows],
  );
  const grossProfit = sellingPrice - recipe.totalCost;
  const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  function patch(id: string, key: keyof CostRow, value: string | number) {
    setRows(current => current.map(row => row.id === id ? { ...row, [key]: value } : row));
  }

  function addRow() {
    setRows(current => [...current, {
      id: `row-${Date.now()}`,
      name: 'Bahan baru',
      purchasePrice: 0,
      purchaseQuantity: 1,
      conversionFactor: 1,
      yieldPercent: 100,
      wastePercent: 0,
      recipeQuantity: 1,
      unitLabel: 'pcs',
      availableQuantity: 0,
    }]);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="portal-panel p-4"><p className="portal-label">HPP per produk</p><p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(recipe.totalCost)}</p><p className="mt-1 text-xs text-portal-soft">Bahan + kemasan dari resep di bawah.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Untung kotor / produk</p><p className={`mt-2 text-2xl font-bold ${grossProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(grossProfit)}</p><p className="mt-1 text-xs text-portal-soft">Margin {number.format(margin)}% sebelum biaya operasional.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Bisa dibuat</p><p className="mt-2 text-2xl font-bold text-portal-ink">{capacity.capacity} cup</p><p className="mt-1 text-xs text-portal-soft">Pembatas: <strong>{capacity.bottleneck?.name ?? 'Belum ada data stok'}</strong></p></div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-portal-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="portal-kicker">Resep & biaya</p><h2 className="mt-1 text-lg font-bold text-portal-ink">Jus Alpukat 16 oz</h2><p className="mt-1 text-sm text-portal-soft">Contoh awal bisa langsung diubah. Masukkan harga beli, ukuran pembelian, hasil yang benar-benar bisa dipakai, dan pemakaian per cup.</p></div>
          <button type="button" onClick={addRow} className="portal-button-secondary"><Plus className="h-4 w-4" /> Tambah bahan</button>
        </div>

        <div className="divide-y divide-portal-line">
          {rows.map((row, index) => {
            const result = recipe.breakdown[index];
            return (
              <article key={row.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <input aria-label="Nama bahan" className="w-full rounded-xl border border-portal-line bg-white px-3 py-2 text-sm font-bold text-portal-ink outline-none focus:border-portal-forest" value={row.name} onChange={event => patch(row.id, 'name', event.target.value)} />
                    <p className="mt-1 text-xs text-portal-soft">Biaya ke resep: <strong className="text-portal-ink">{money.format(result?.itemCost ?? 0)}</strong></p>
                  </div>
                  <button type="button" aria-label={`Hapus ${row.name}`} className="rounded-xl border border-portal-line p-2 text-portal-soft hover:text-red-700" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  <label className="text-xs font-semibold text-portal-soft">Harga beli<input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.purchasePrice} onChange={event => patch(row.id, 'purchasePrice', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Jumlah beli<input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.purchaseQuantity} onChange={event => patch(row.id, 'purchaseQuantity', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Konversi ke unit resep<input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.conversionFactor} onChange={event => patch(row.id, 'conversionFactor', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Hasil terpakai %<input type="number" min="1" max="100" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.yieldPercent} onChange={event => patch(row.id, 'yieldPercent', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Susut %<input type="number" min="0" max="99" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.wastePercent} onChange={event => patch(row.id, 'wastePercent', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Pakai / produk<input type="number" min="0" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.recipeQuantity} onChange={event => patch(row.id, 'recipeQuantity', numeric(event.target.value))} /></label>
                  <label className="text-xs font-semibold text-portal-soft">Stok tersedia<input type="number" min="0" step="any" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.availableQuantity} onChange={event => patch(row.id, 'availableQuantity', numeric(event.target.value))} /></label>
                </div>
                <p className="mt-2 text-[11px] text-portal-soft">Unit resep: {row.unitLabel} · biaya efektif {money.format(result?.effectiveUnitCost ?? 0)} / {row.unitLabel} · jumlah usable {number.format(result?.usableQuantity ?? 0)} {row.unitLabel}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="portal-panel p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="portal-icon-tile"><PackagePlus className="h-4 w-4" /></span><div><h3 className="font-bold text-portal-ink">Kemasan memang bagian HPP</h3><p className="mt-1 text-sm leading-6 text-portal-soft">Cup, seal/lid, sedotan, plastik, sendok, es, topping, dan bahan yang terbuang sebaiknya masuk resep. Kalau tidak, margin terlihat lebih besar dari kondisi nyata.</p></div></div>
          {capacity.bottleneck ? <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>{capacity.bottleneck.name}</strong> adalah pembatas produksi. Dengan stok sekarang, produk ini hanya bisa dibuat sekitar <strong>{capacity.capacity} kali</strong>.</p></div> : null}
        </div>
        <div className="portal-panel p-4 sm:p-5">
          <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-portal-forest" /><p className="font-bold text-portal-ink">Cek harga jual</p></div>
          <label className="mt-4 block text-xs font-semibold text-portal-soft">Harga jual offline<input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-base font-bold text-portal-ink" value={sellingPrice} onChange={event => setSellingPrice(numeric(event.target.value))} /></label>
          <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-portal-soft">HPP</span><strong>{money.format(recipe.totalCost)}</strong></div><div className="flex justify-between"><span className="text-portal-soft">Sisa setelah HPP</span><strong>{money.format(grossProfit)}</strong></div><div className="flex justify-between"><span className="text-portal-soft">Margin kotor</span><strong>{number.format(margin)}%</strong></div></div>
        </div>
      </section>
    </div>
  );
}
