'use client';

import { useMemo, useState } from 'react';
import { BadgeDollarSign, ChevronDown, CircleAlert } from 'lucide-react';
import { RupiahInput } from '@/components/forms/RupiahInput';
import { calculateChannelMargin, recommendChannelPrice } from '@/lib/business-control/costing';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const input = 'mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink';

export function ChannelPriceCalculator({ channel, defaultPrice = 15000, defaultHpp = 8000 }: { channel: string; defaultPrice?: number; defaultHpp?: number }) {
  const [price, setPrice] = useState(defaultPrice);
  const [hpp, setHpp] = useState(defaultHpp);
  const [fee, setFee] = useState(20);
  const [promo, setPromo] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);
  const [targetMargin, setTargetMargin] = useState(25);

  const margin = useMemo(() => calculateChannelMargin({ price, hpp, feeRatePercent: fee, merchantPromo: promo, fixedFee }), [price, hpp, fee, promo, fixedFee]);
  const recommendation = useMemo(() => recommendChannelPrice({ hpp, deductionRatePercent: fee, fixedFee: fixedFee + promo, targetMarginPercent: targetMargin, roundTo: 500 }), [hpp, fee, fixedFee, promo, targetMargin]);

  return (
    <section className="portal-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-portal-line px-4 py-3 sm:px-5">
        <BadgeDollarSign className="h-4 w-4 text-portal-forest" />
        <div><h3 className="font-bold text-portal-ink">Harga {channel}</h3><p className="text-xs text-portal-soft">Cek harga jual online tanpa hitung manual.</p></div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <label className="text-xs font-semibold text-portal-soft">Harga toko<RupiahInput min={0} value={price} onValueChange={value => setPrice(value ?? 0)} className={input} /></label>
        <label className="text-xs font-semibold text-portal-soft">HPP<RupiahInput min={0} value={hpp} onValueChange={value => setHpp(value ?? 0)} className={input} /></label>
        <label className="text-xs font-semibold text-portal-soft">Potongan aplikasi %<input className={input} type="number" min="0" max="100" value={fee} onChange={e => setFee(Number(e.target.value) || 0)} /></label>
      </div>

      <div className="border-y border-portal-line bg-[#fafbf9] px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold text-portal-soft">Saran harga online</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <p className="text-2xl font-black text-portal-ink">{recommendation.valid && recommendation.recommendedPrice !== null ? money.format(recommendation.recommendedPrice) : 'Belum bisa dihitung'}</p>
          <p className={`text-sm font-bold ${margin.contributionProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>Sisa {money.format(margin.contributionProfit)} · {pct.format(margin.contributionMarginPercent)}%</p>
        </div>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-portal-soft sm:px-5">
          Pengaturan lanjutan <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-portal-line p-4 sm:grid-cols-3 sm:p-5">
          <label className="text-xs font-semibold text-portal-soft">Promo dari toko<RupiahInput min={0} value={promo} onValueChange={value => setPromo(value ?? 0)} className={input} /></label>
          <label className="text-xs font-semibold text-portal-soft">Biaya tetap<RupiahInput min={0} value={fixedFee} onValueChange={value => setFixedFee(value ?? 0)} className={input} /></label>
          <label className="text-xs font-semibold text-portal-soft">Target margin %<input className={input} type="number" min="0" max="99" value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value) || 0)} /></label>
        </div>
      </details>

      {!recommendation.valid ? <div className="flex gap-2 border-t border-red-200 bg-red-50 p-3 text-xs text-red-900"><CircleAlert className="h-4 w-4 shrink-0" /><p>Potongan dan target margin terlalu tinggi. Turunkan salah satunya.</p></div> : null}
    </section>
  );
}
