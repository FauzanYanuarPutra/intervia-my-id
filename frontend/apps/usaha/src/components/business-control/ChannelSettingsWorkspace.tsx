'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import {
  calculateChannelMargin,
  recommendChannelPrice,
} from '@/lib/business-control/costing';
import { channelSimulationReadiness } from '@/lib/business-control/progressive-disclosure';

type Channel = {
  channel_key: string;
  display_name: string;
  fee_rate_bps: number;
  fixed_fee_amount: number;
  merchant_promo_amount: number;
  target_margin_bps: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
};

type EditableChannel = {
  key: string;
  displayName: string;
  feePercent: number;
  fixedFee: number;
  merchantPromo: number;
  targetMarginPercent: number;
  enabled: boolean;
};

type Props = {
  businessId: string;
  initialChannels: Channel[];
  defaultPrice: number | null;
  defaultHpp?: number | null;
  canViewCosting: boolean;
};

const defaults: EditableChannel[] = [
  { key: 'offline', displayName: 'Toko / Offline', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: true },
  { key: 'lajukan', displayName: 'Lajukan', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: true },
  { key: 'whatsapp', displayName: 'WhatsApp', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: true },
  { key: 'gofood', displayName: 'GoFood', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: false },
  { key: 'grabfood', displayName: 'GrabFood', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: false },
  { key: 'shopeefood', displayName: 'ShopeeFood', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: false },
];

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function fromSaved(item: Channel): EditableChannel {
  return {
    key: item.channel_key,
    displayName: item.display_name,
    feePercent: item.fee_rate_bps / 100,
    fixedFee: item.fixed_fee_amount,
    merchantPromo: item.merchant_promo_amount,
    targetMarginPercent: item.target_margin_bps / 100,
    enabled: item.enabled,
  };
}

function initialRows(saved: Channel[]) {
  const map = new Map(saved.map(item => [item.channel_key, fromSaved(item)]));
  const standard = defaults.map(item => map.get(item.key) ?? item);
  const standardKeys = new Set(defaults.map(item => item.key));
  const custom = saved.filter(item => !standardKeys.has(item.channel_key)).map(fromSaved);
  return [...standard, ...custom];
}

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function ChannelSettingsWorkspace({ businessId, initialChannels, defaultPrice, defaultHpp = null, canViewCosting }: Props) {
  const [rows, setRows] = useState(() => initialRows(initialChannels));
  const [price, setPrice] = useState<number | null>(defaultPrice);
  const [hpp, setHpp] = useState<number | null>(defaultHpp);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');
  const readiness = channelSimulationReadiness({ recordedPrice: price, hpp, canViewCosting });

  function patch(key: string, field: keyof EditableChannel, value: string | number | boolean) {
    setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
  }

  async function save(row: EditableChannel) {
    setSavingKey(row.key);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/channels/${encodeURIComponent(row.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: row.displayName,
          fee_rate_bps: Math.round(row.feePercent * 100),
          fixed_fee_amount: Math.round(row.fixedFee),
          merchant_promo_amount: Math.round(row.merchantPromo),
          target_margin_bps: Math.round(row.targetMarginPercent * 100),
          enabled: row.enabled,
          metadata: {},
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan pengaturan.');
      setMessage(`${row.displayName} tersimpan.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-portal-line bg-white p-4 sm:p-5">
        <p className="portal-kicker">Hitung harga online</p>
        <h2 className="mt-1 text-lg font-bold text-portal-ink">Mulai dari harga toko dan modal yang benar-benar kamu tahu</h2>
        <p className="mt-1 text-sm text-portal-soft">Potongan aplikasi dan promo diisi sesuai kondisi akun tokomu karena nilainya bisa berbeda dan berubah.</p>

        {readiness === 'missing-price' ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Harga jual belum tersedia. Isi harga nyata; Lajukan tidak memakai harga contoh.</p></div>
        ) : readiness === 'missing-hpp' ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Modal produk belum lengkap. Sisa keuntungan dan harga aman belum bisa dihitung.</p></div>
        ) : readiness === 'price-only' ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-portal-line bg-[#fafbf9] p-3 text-xs leading-5 text-portal-soft"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Aksesmu dapat mengatur tempat jualan, tetapi modal dan keuntungan produk tidak ditampilkan.</p></div>
        ) : null}

        <div className={`mt-4 grid gap-3 ${canViewCosting ? 'sm:grid-cols-2' : ''}`}>
          <label className="text-xs font-semibold text-portal-soft">Harga toko
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={price ?? ''} placeholder="Contoh: 10000" onChange={event => setPrice(nullableNumber(event.target.value))} />
          </label>
          {canViewCosting ? <label className="text-xs font-semibold text-portal-soft">Modal produk (HPP)
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={hpp ?? ''} placeholder="Isi modal per produk" onChange={event => setHpp(nullableNumber(event.target.value))} />
          </label> : null}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map(row => <ChannelCard key={row.key} row={row} price={price} hpp={hpp} canViewCosting={canViewCosting} saving={savingKey === row.key} onPatch={patch} onSave={save} />)}
      </div>
      {message ? <p className="text-xs text-portal-soft">{message}</p> : null}
    </div>
  );
}

function ChannelCard({ row, price, hpp, canViewCosting, saving, onPatch, onSave }: {
  row: EditableChannel;
  price: number | null;
  hpp: number | null;
  canViewCosting: boolean;
  saving: boolean;
  onPatch: (key: string, field: keyof EditableChannel, value: string | number | boolean) => void;
  onSave: (row: EditableChannel) => Promise<void>;
}) {
  const readiness = channelSimulationReadiness({ recordedPrice: price, hpp, canViewCosting });
  const netBeforeHpp = useMemo(() => price === null ? null : calculateChannelMargin({
    price,
    hpp: 0,
    feeRatePercent: row.feePercent,
    merchantPromo: row.merchantPromo,
    fixedFee: row.fixedFee,
  }), [price, row.feePercent, row.merchantPromo, row.fixedFee]);
  const margin = useMemo(() => readiness === 'ready' && price !== null && hpp !== null ? calculateChannelMargin({
    price,
    hpp,
    feeRatePercent: row.feePercent,
    merchantPromo: row.merchantPromo,
    fixedFee: row.fixedFee,
  }) : null, [readiness, price, hpp, row.feePercent, row.merchantPromo, row.fixedFee]);
  const recommendation = useMemo(() => readiness === 'ready' && hpp !== null ? recommendChannelPrice({
    hpp,
    deductionRatePercent: row.feePercent,
    fixedFee: row.fixedFee + row.merchantPromo,
    targetMarginPercent: row.targetMarginPercent,
    roundTo: 500,
  }) : null, [readiness, hpp, row.feePercent, row.fixedFee, row.merchantPromo, row.targetMarginPercent]);

  return (
    <section className="overflow-hidden rounded-xl border border-portal-line bg-white">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div><h3 className="font-bold text-portal-ink">{row.displayName}</h3><p className="mt-1 text-xs text-portal-soft">{row.enabled ? 'Dipakai untuk jualan' : 'Tidak dipakai'}</p></div>
        <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-portal-soft"><input type="checkbox" checked={row.enabled} onChange={event => onPatch(row.key, 'enabled', event.target.checked)} /> Aktif</label>
      </div>

      {row.enabled ? (
        <div className={`grid gap-3 border-t border-portal-line px-4 py-3 sm:px-5 ${canViewCosting ? 'sm:grid-cols-3' : ''}`}>
          <div><p className="portal-label">Uang diterima sebelum modal</p><p className="mt-1 font-bold text-portal-ink">{netBeforeHpp ? money.format(netBeforeHpp.netRevenue) : 'Belum ada harga'}</p></div>
          {canViewCosting ? <div><p className="portal-label">Sisa setelah modal</p><p className={`mt-1 font-bold ${margin && margin.contributionProfit < 0 ? 'text-red-700' : 'text-portal-forest'}`}>{margin ? money.format(margin.contributionProfit) : 'Belum siap'}</p>{margin ? <p className="mt-1 text-[11px] text-portal-soft">{pct.format(margin.contributionMarginPercent)}% dari harga jual</p> : null}</div> : null}
          {canViewCosting ? <div><p className="portal-label">Harga online aman</p><p className="mt-1 font-bold text-portal-ink">{recommendation?.valid && recommendation.recommendedPrice !== null ? money.format(recommendation.recommendedPrice) : 'Belum siap'}</p></div> : null}
        </div>
      ) : null}

      <details className="border-t border-portal-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-portal-forest sm:px-5">Atur potongan & promo</summary>
        <div className="grid gap-3 border-t border-portal-line bg-[#fafbf9] p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold text-portal-soft">Nama tempat jualan<input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.displayName} onChange={event => onPatch(row.key, 'displayName', event.target.value)} /></label>
          <label className="text-xs font-semibold text-portal-soft">Potongan aplikasi %<input type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.feePercent} onChange={event => onPatch(row.key, 'feePercent', Number(event.target.value) || 0)} /></label>
          <label className="text-xs font-semibold text-portal-soft">Biaya tetap per pesanan<input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.fixedFee} onChange={event => onPatch(row.key, 'fixedFee', Number(event.target.value) || 0)} /></label>
          <label className="text-xs font-semibold text-portal-soft">Promo ditanggung toko<input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.merchantPromo} onChange={event => onPatch(row.key, 'merchantPromo', Number(event.target.value) || 0)} /></label>
          {canViewCosting ? <label className="text-xs font-semibold text-portal-soft">Target keuntungan %<input type="number" min="0" max="99" step="0.1" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.targetMarginPercent} onChange={event => onPatch(row.key, 'targetMarginPercent', Number(event.target.value) || 0)} /></label> : null}
          <div className="flex items-end"><button type="button" disabled={saving} onClick={() => onSave(row)} className="portal-button-primary w-full justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan</button></div>
        </div>
      </details>
    </section>
  );
}
