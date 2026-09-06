'use client';

import { useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import {
  calculateChannelMargin,
  recommendChannelPrice,
} from '@/lib/business-control/costing';

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
  defaultPrice: number;
  defaultHpp?: number;
};

const defaults: EditableChannel[] = [
  { key: 'offline', displayName: 'Offline / Toko', feePercent: 0, fixedFee: 0, merchantPromo: 0, targetMarginPercent: 25, enabled: true },
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

export function ChannelSettingsWorkspace({ businessId, initialChannels, defaultPrice, defaultHpp = 0 }: Props) {
  const [rows, setRows] = useState(() => initialRows(initialChannels));
  const [price, setPrice] = useState(defaultPrice);
  const [hpp, setHpp] = useState(defaultHpp);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');

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
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan kanal.');
      setMessage(`${row.displayName} tersimpan.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan kanal.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="space-y-4">
      <section className="portal-panel p-4 sm:p-5">
        <p className="portal-kicker">Simulasi bersama</p>
        <h2 className="mt-1 text-lg font-bold text-portal-ink">Bandingkan kanal dengan harga produk yang sama</h2>
        <p className="mt-1 text-sm text-portal-soft">Masukkan HPP produk nyata dari halaman resep. Fee dan promo tidak diisi otomatis karena kondisi merchant bisa berbeda.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-portal-soft">Harga jual
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={price} onChange={event => setPrice(Number(event.target.value) || 0)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">HPP produk
            <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={hpp} onChange={event => setHpp(Number(event.target.value) || 0)} />
          </label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map(row => <ChannelCard key={row.key} row={row} price={price} hpp={hpp} saving={savingKey === row.key} onPatch={patch} onSave={save} />)}
      </div>
      {message ? <p className="text-xs text-portal-soft">{message}</p> : null}
    </div>
  );
}

function ChannelCard({ row, price, hpp, saving, onPatch, onSave }: {
  row: EditableChannel;
  price: number;
  hpp: number;
  saving: boolean;
  onPatch: (key: string, field: keyof EditableChannel, value: string | number | boolean) => void;
  onSave: (row: EditableChannel) => Promise<void>;
}) {
  const margin = useMemo(() => calculateChannelMargin({
    price,
    hpp,
    feeRatePercent: row.feePercent,
    merchantPromo: row.merchantPromo,
    fixedFee: row.fixedFee,
  }), [price, hpp, row.feePercent, row.merchantPromo, row.fixedFee]);
  const recommendation = useMemo(() => recommendChannelPrice({
    hpp,
    deductionRatePercent: row.feePercent,
    fixedFee: row.fixedFee + row.merchantPromo,
    targetMarginPercent: row.targetMarginPercent,
    roundTo: 500,
  }), [hpp, row.feePercent, row.fixedFee, row.merchantPromo, row.targetMarginPercent]);

  return (
    <section className="portal-panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-portal-line p-4 sm:p-5">
        <div><p className="portal-kicker">{row.key}</p><h3 className="mt-1 font-bold text-portal-ink">{row.displayName}</h3></div>
        <label className="flex items-center gap-2 text-xs font-semibold text-portal-soft"><input type="checkbox" checked={row.enabled} onChange={event => onPatch(row.key, 'enabled', event.target.checked)} /> Aktif</label>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <label className="text-xs font-semibold text-portal-soft">Nama kanal
          <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.displayName} onChange={event => onPatch(row.key, 'displayName', event.target.value)} />
        </label>
        <label className="text-xs font-semibold text-portal-soft">Potongan %
          <input type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.feePercent} onChange={event => onPatch(row.key, 'feePercent', Number(event.target.value) || 0)} />
        </label>
        <label className="text-xs font-semibold text-portal-soft">Biaya tetap
          <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.fixedFee} onChange={event => onPatch(row.key, 'fixedFee', Number(event.target.value) || 0)} />
        </label>
        <label className="text-xs font-semibold text-portal-soft">Promo ditanggung merchant
          <input type="number" min="0" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.merchantPromo} onChange={event => onPatch(row.key, 'merchantPromo', Number(event.target.value) || 0)} />
        </label>
        <label className="text-xs font-semibold text-portal-soft">Target margin %
          <input type="number" min="0" max="99" step="0.1" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2 text-sm text-portal-ink" value={row.targetMarginPercent} onChange={event => onPatch(row.key, 'targetMarginPercent', Number(event.target.value) || 0)} />
        </label>
        <div className="flex items-end"><button type="button" disabled={saving} onClick={() => onSave(row)} className="portal-button-primary w-full justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan kanal</button></div>
      </div>
      <div className="grid gap-3 border-t border-portal-line bg-[#fafbf9] p-4 sm:grid-cols-3 sm:p-5">
        <div><p className="portal-label">Uang bersih</p><p className="mt-1 font-bold text-portal-ink">{money.format(margin.netRevenue)}</p></div>
        <div><p className="portal-label">Sisa setelah HPP</p><p className={`mt-1 font-bold ${margin.contributionProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(margin.contributionProfit)}</p><p className="mt-1 text-[11px] text-portal-soft">Margin {pct.format(margin.contributionMarginPercent)}%</p></div>
        <div><p className="portal-label">Harga minimum target</p><p className="mt-1 font-bold text-portal-ink">{recommendation.valid && recommendation.recommendedPrice !== null ? money.format(recommendation.recommendedPrice) : 'Asumsi tidak mungkin'}</p></div>
      </div>
    </section>
  );
}
