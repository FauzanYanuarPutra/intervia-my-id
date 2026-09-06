'use client';

import { useMemo, useState } from 'react';
import { BadgeDollarSign, CircleAlert } from 'lucide-react';
import { calculateChannelMargin, recommendChannelPrice } from '@/lib/business-control/costing';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export function ChannelPriceCalculator({ channel, defaultPrice = 15000, defaultHpp = 8000 }: { channel: string; defaultPrice?: number; defaultHpp?: number }) {
  const [price, setPrice] = useState(defaultPrice);
  const [hpp, setHpp] = useState(defaultHpp);
  const [fee, setFee] = useState(20);
  const [promo, setPromo] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);
  const [targetMargin, setTargetMargin] = useState(25);

  const margin = useMemo(() => calculateChannelMargin({ price, hpp, feeRatePercent: fee, merchantPromo: promo, fixedFee }), [price, hpp, fee, promo, fixedFee]);
  const recommendation = useMemo(() => recommendChannelPrice({ hpp, deductionRatePercent: fee, fixedFee: fixedFee + promo, targetMarginPercent: targetMargin, roundTo: 500 }), [hpp, fee, fixedFee, promo, targetMargin]);

  const input = 'mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2 text-sm text-portal-ink';

  return (
    <div className="portal-panel overflow-hidden">
      <div className="border-b border-portal-line p-4 sm:p-5"><div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-portal-forest" /><h3 className="font-bold text-portal-ink">Harga {channel}</h3></div><p className="mt-1 text-xs leading-5 text-portal-soft">Biaya kanal diisi sendiri sesuai kontrak dan laporan merchant Anda. Lajukan tidak menganggap angka contoh sebagai tarif resmi.</p></div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <label className="text-xs font-semibold text-portal-soft">Harga jual<input className={input} type="number" min="0" value={price} onChange={e => setPrice(Number(e.target.value) || 0)} /></label>
        <label className="text-xs font-semibold text-portal-soft">HPP<input className={input} type="number" min="0" value={hpp} onChange={e => setHpp(Number(e.target.value) || 0)} /></label>
        <label className="text-xs font-semibold text-portal-soft">Potongan kanal %<input className={input} type="number" min="0" max="100" value={fee} onChange={e => setFee(Number(e.target.value) || 0)} /></label>
        <label className="text-xs font-semibold text-portal-soft">Promo ditanggung merchant<input className={input} type="number" min="0" value={promo} onChange={e => setPromo(Number(e.target.value) || 0)} /></label>
        <label className="text-xs font-semibold text-portal-soft">Biaya tetap<input className={input} type="number" min="0" value={fixedFee} onChange={e => setFixedFee(Number(e.target.value) || 0)} /></label>
        <label className="text-xs font-semibold text-portal-soft">Target margin %<input className={input} type="number" min="0" max="99" value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value) || 0)} /></label>
      </div>
      <div className="grid gap-3 border-t border-portal-line bg-[#fafbf9] p-4 sm:grid-cols-4 sm:p-5">
        <div><p className="portal-label">Uang bersih</p><p className="mt-1 font-bold text-portal-ink">{money.format(margin.netRevenue)}</p></div>
        <div><p className="portal-label">Sisa setelah HPP</p><p className={`mt-1 font-bold ${margin.contributionProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(margin.contributionProfit)}</p></div>
        <div><p className="portal-label">Margin</p><p className="mt-1 font-bold text-portal-ink">{pct.format(margin.contributionMarginPercent)}%</p></div>
        <div><p className="portal-label">Saran harga</p><p className="mt-1 font-bold text-portal-ink">{recommendation.valid && recommendation.recommendedPrice !== null ? money.format(recommendation.recommendedPrice) : 'Asumsi tidak mungkin'}</p></div>
      </div>
      {!recommendation.valid ? <div className="flex gap-2 border-t border-red-200 bg-red-50 p-3 text-xs text-red-900"><CircleAlert className="h-4 w-4 shrink-0" /><p>Total potongan + target margin mencapai atau melebihi 100%. Turunkan salah satunya agar harga minimum bisa dihitung.</p></div> : null}
    </div>
  );
}
