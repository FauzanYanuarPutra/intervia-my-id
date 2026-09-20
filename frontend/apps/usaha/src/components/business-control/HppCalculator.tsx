'use client';
import { RupiahInput } from '@/components/forms/RupiahInput';

import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, TriangleAlert } from 'lucide-react';
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
const input = 'mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm text-portal-ink';

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
    try { return calculateRecipeCost(rows); }
    catch { return { breakdown: [], totalCost: 0 }; }
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
    <div className="space-y-3">
      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-portal-soft">HPP / produk</p>
            <p className="mt-1 text-3xl font-black text-portal-ink">{money.format(recipe.totalCost)}</p>
          </div>
          <label className="w-full text-xs font-semibold text-portal-soft sm:w-52">Harga jual
            <RupiahInput min={0} className={`${input} text-base font-bold`} value={sellingPrice} onValueChange={value => setSellingPrice(value ?? 0)} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-portal-line pt-3">
          <div><p className="text-[11px] text-portal-soft">Untung kotor</p><p className={`mt-0.5 text-sm font-bold ${grossProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(grossProfit)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Margin</p><p className="mt-0.5 text-sm font-bold text-portal-ink">{number.format(margin)}%</p></div>
          <div><p className="text-[11px] text-portal-soft">Bisa dibuat</p><p className="mt-0.5 text-sm font-bold text-portal-ink">{capacity.capacity} cup</p></div>
        </div>
        {capacity.bottleneck ? <p className="mt-3 flex items-center gap-2 text-xs text-amber-800"><TriangleAlert className="h-3.5 w-3.5" /> Stok pembatas: <strong>{capacity.bottleneck.name}</strong></p> : null}
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
          <div><h2 className="font-bold text-portal-ink">Resep</h2><p className="text-xs text-portal-soft">Jus Alpukat 16 oz · {rows.length} bahan</p></div>
          <button type="button" onClick={addRow} className="portal-button-secondary"><Plus className="h-4 w-4" /> Bahan</button>
        </div>

        <div className="divide-y divide-portal-line">
          {rows.map((row, index) => {
            const result = recipe.breakdown[index];
            return (
              <article key={row.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <input aria-label="Nama bahan" className="w-full border-0 bg-transparent p-0 text-sm font-bold text-portal-ink outline-none" value={row.name} onChange={event => patch(row.id, 'name', event.target.value)} />
                    <p className="mt-0.5 text-xs text-portal-soft">{row.recipeQuantity} {row.unitLabel} · <strong className="text-portal-ink">{money.format(result?.itemCost ?? 0)}</strong></p>
                  </div>
                  <button type="button" aria-label={`Hapus ${row.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-portal-soft hover:bg-red-50 hover:text-red-700" onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 className="h-4 w-4" /></button>
                </div>

                <details className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-portal-soft">Detail bahan <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold text-portal-soft">Harga beli<RupiahInput min={0} className={input} value={row.purchasePrice} onValueChange={value => patch(row.id, 'purchasePrice', value ?? 0)} /></label>
                    <label className="text-xs font-semibold text-portal-soft">Jumlah beli<input type="number" min="0.0001" step="any" className={input} value={row.purchaseQuantity} onChange={event => patch(row.id, 'purchaseQuantity', numeric(event.target.value))} /></label>
                    <label className="text-xs font-semibold text-portal-soft">Pakai / produk<input type="number" min="0" step="any" className={input} value={row.recipeQuantity} onChange={event => patch(row.id, 'recipeQuantity', numeric(event.target.value))} /></label>
                    <label className="text-xs font-semibold text-portal-soft">Stok<input type="number" min="0" step="any" className={input} value={row.availableQuantity} onChange={event => patch(row.id, 'availableQuantity', numeric(event.target.value))} /></label>
                  </div>
                  <details className="mt-3 rounded-lg bg-[#fafbf9] p-3">
                    <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Teknis perhitungan</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-portal-soft">Konversi<input type="number" min="0.0001" step="any" className={input} value={row.conversionFactor} onChange={event => patch(row.id, 'conversionFactor', numeric(event.target.value))} /></label>
                      <label className="text-xs font-semibold text-portal-soft">Hasil terpakai %<input type="number" min="1" max="100" className={input} value={row.yieldPercent} onChange={event => patch(row.id, 'yieldPercent', numeric(event.target.value))} /></label>
                      <label className="text-xs font-semibold text-portal-soft">Susut %<input type="number" min="0" max="99" className={input} value={row.wastePercent} onChange={event => patch(row.id, 'wastePercent', numeric(event.target.value))} /></label>
                    </div>
                  </details>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
