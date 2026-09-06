'use client';

import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Info, WalletCards } from 'lucide-react';
import { summarizeBusinessDay } from '@/lib/business-control/finance';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function ProfitExplainer() {
  const [revenue, setRevenue] = useState(240000);
  const [cogs, setCogs] = useState(140000);
  const [expenses, setExpenses] = useState(35000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [capital, setCapital] = useState(0);
  const [drawing, setDrawing] = useState(50000);

  const summary = useMemo(() => summarizeBusinessDay({
    revenue,
    cogs,
    operatingExpenses: expenses,
    otherIncome,
    ownerCapital: capital,
    ownerDrawing: drawing,
  }), [revenue, cogs, expenses, otherIncome, capital, drawing]);

  const input = 'mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm font-semibold text-portal-ink';
  const numeric = (value: string) => Math.max(0, Number(value) || 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="portal-panel p-4"><p className="portal-label">Omzet</p><p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(summary.revenue)}</p><p className="mt-1 text-xs text-portal-soft">Nilai penjualan.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Laba kotor</p><p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(summary.grossProfit)}</p><p className="mt-1 text-xs text-portal-soft">Omzet dikurangi HPP.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Untung usaha</p><p className={`mt-2 text-2xl font-bold ${summary.operatingProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(summary.operatingProfit)}</p><p className="mt-1 text-xs text-portal-soft">Setelah HPP dan biaya operasional.</p></div>
        <div className="portal-panel p-4"><p className="portal-label">Perubahan uang</p><p className={`mt-2 text-2xl font-bold ${summary.cashMovement >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(summary.cashMovement)}</p><p className="mt-1 text-xs text-portal-soft">Termasuk modal dan ambil pribadi.</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="portal-panel p-4 sm:p-5">
          <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-portal-forest" /><h2 className="font-bold text-portal-ink">Masukkan kondisi hari ini</h2></div>
          <p className="mt-1 text-sm leading-6 text-portal-soft">Tidak perlu debit/kredit. Masukkan angka yang Anda tahu; Lajukan menjelaskan hasilnya.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-portal-soft">Penjualan / omzet<input type="number" min="0" className={input} value={revenue} onChange={e => setRevenue(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">HPP barang terjual<input type="number" min="0" className={input} value={cogs} onChange={e => setCogs(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Biaya operasional<input type="number" min="0" className={input} value={expenses} onChange={e => setExpenses(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Pendapatan lain<input type="number" min="0" className={input} value={otherIncome} onChange={e => setOtherIncome(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Modal pemilik masuk<input type="number" min="0" className={input} value={capital} onChange={e => setCapital(numeric(e.target.value))} /></label>
            <label className="text-xs font-semibold text-portal-soft">Uang diambil pemilik<input type="number" min="0" className={input} value={drawing} onChange={e => setDrawing(numeric(e.target.value))} /></label>
          </div>
        </div>

        <div className="portal-panel p-4 sm:p-5">
          <p className="portal-kicker">Yang sering bikin bingung</p>
          <h2 className="mt-1 text-lg font-bold text-portal-ink">Uang kas ≠ untung</h2>
          <div className="mt-4 space-y-3 text-sm leading-6">
            <div className="flex gap-3 rounded-2xl bg-portal-mist p-3"><ArrowDownToLine className="mt-1 h-4 w-4 shrink-0 text-portal-forest" /><p><strong>Modal pemilik</strong> membuat kas bertambah, tetapi bukan keuntungan dari jualan.</p></div>
            <div className="flex gap-3 rounded-2xl bg-[#fafbf9] p-3"><ArrowUpFromLine className="mt-1 h-4 w-4 shrink-0 text-portal-forest" /><p><strong>Ambil uang pribadi</strong> membuat kas turun, tetapi tidak mengurangi laba operasional usaha.</p></div>
            <div className="flex gap-3 rounded-2xl border border-portal-line p-3"><Info className="mt-1 h-4 w-4 shrink-0 text-portal-forest" /><p>Pada contoh sekarang, usaha menghasilkan <strong>{money.format(summary.operatingProfit)}</strong>, sementara perubahan uang bersih adalah <strong>{money.format(summary.cashMovement)}</strong>.</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}
