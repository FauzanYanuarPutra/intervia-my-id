'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { summarizeBusinessDay } from '@/lib/business-control/finance';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const input = 'mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm font-semibold text-portal-ink';

export function ProfitExplainer() {
  const [revenue, setRevenue] = useState(240000);
  const [cogs, setCogs] = useState(140000);
  const [expenses, setExpenses] = useState(35000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [capital, setCapital] = useState(0);
  const [drawing, setDrawing] = useState(50000);
  const numeric = (value: string) => Math.max(0, Number(value) || 0);

  const summary = useMemo(() => summarizeBusinessDay({ revenue, cogs, operatingExpenses: expenses, otherIncome, ownerCapital: capital, ownerDrawing: drawing }), [revenue, cogs, expenses, otherIncome, capital, drawing]);

  return (
    <div className="space-y-3">
      <section className="portal-panel p-4 sm:p-5">
        <p className="text-xs font-semibold text-portal-soft">Untung usaha</p>
        <p className={`mt-1 text-3xl font-black ${summary.operatingProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(summary.operatingProfit)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-portal-line pt-3">
          <div><p className="text-[11px] text-portal-soft">Omzet</p><p className="mt-0.5 text-sm font-bold text-portal-ink">{money.format(summary.revenue)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Laba kotor</p><p className="mt-0.5 text-sm font-bold text-portal-ink">{money.format(summary.grossProfit)}</p></div>
          <div><p className="text-[11px] text-portal-soft">Uang berubah</p><p className="mt-0.5 text-sm font-bold text-portal-ink">{money.format(summary.cashMovement)}</p></div>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <h2 className="font-bold text-portal-ink">Kondisi hari ini</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-portal-soft">Omzet<input type="number" min="0" className={input} value={revenue} onChange={e => setRevenue(numeric(e.target.value))} /></label>
          <label className="text-xs font-semibold text-portal-soft">HPP terjual<input type="number" min="0" className={input} value={cogs} onChange={e => setCogs(numeric(e.target.value))} /></label>
          <label className="text-xs font-semibold text-portal-soft">Biaya operasional<input type="number" min="0" className={input} value={expenses} onChange={e => setExpenses(numeric(e.target.value))} /></label>
        </div>

        <details className="group mt-4 border-t border-portal-line pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-portal-soft">Input tambahan <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-portal-soft">Pendapatan lain<input type="number" min="0" className={input} value={otherIncome} onChange={e => setOtherIncome(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Modal pemilik<input type="number" min="0" className={input} value={capital} onChange={e => setCapital(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Ambil pemilik<input type="number" min="0" className={input} value={drawing} onChange={e => setDrawing(numeric(e.target.value))} /></label>
          </div>
        </details>
      </section>

      <details className="portal-panel group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-bold text-portal-ink sm:p-5"><span className="flex items-center gap-2"><Info className="h-4 w-4 text-portal-forest" /> Penjelasan kas & untung</span><ChevronDown className="h-4 w-4 text-portal-soft transition group-open:rotate-180" /></summary>
        <div className="border-t border-portal-line px-4 py-3 text-sm leading-6 text-portal-soft sm:px-5"><p><strong className="text-portal-ink">Modal pemilik</strong> menambah kas tapi bukan untung. <strong className="text-portal-ink">Ambil uang pribadi</strong> mengurangi kas tapi bukan biaya operasional.</p></div>
      </details>
    </div>
  );
}
