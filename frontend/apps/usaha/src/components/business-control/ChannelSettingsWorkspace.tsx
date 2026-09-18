'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, Save } from 'lucide-react';
import { buildChannelBusinessSummary } from '@/lib/business-control/channel-ux';
import { businessApiErrorMessage } from '@/lib/business-api-error';
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

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const pct = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const input = 'mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm text-portal-ink';

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

export function ChannelSettingsWorkspace({
  businessId,
  initialChannels,
  defaultPrice,
  defaultHpp = null,
  canViewCosting,
}: Props) {
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
      if (!response.ok) throw new Error(businessApiErrorMessage(payload, 'Gagal menyimpan pengaturan.', response.status));
      setMessage(`${row.displayName} tersimpan.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="space-y-3">
      <details className="portal-panel group" open={readiness !== 'ready'}>
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 sm:p-5">
          <div>
            <h2 className="font-bold text-portal-ink">Pengaturan harga online</h2>
            <p className="mt-0.5 text-xs text-portal-soft">Harga toko dan HPP dipakai untuk simulasi semua kanal.</p>
          </div>
          <ChevronDown className="h-4 w-4 text-portal-soft transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          {readiness !== 'ready' ? (
            <div className="mb-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>
                {readiness === 'missing-price'
                  ? 'Isi harga toko agar simulasi bisa dihitung.'
                  : readiness === 'missing-hpp'
                    ? 'Isi HPP agar saran harga aman bisa dihitung.'
                    : 'Akses ini tidak menampilkan HPP dan keuntungan.'}
              </p>
            </div>
          ) : null}

          <div className={`grid gap-3 ${canViewCosting ? 'sm:grid-cols-2' : ''}`}>
            <label className="text-xs font-semibold text-portal-soft">
              Harga toko
              <input
                type="number"
                min="0"
                className={input}
                value={price ?? ''}
                placeholder="Contoh: 10000"
                onChange={event => setPrice(nullableNumber(event.target.value))}
              />
            </label>
            {canViewCosting ? (
              <label className="text-xs font-semibold text-portal-soft">
                HPP produk
                <input
                  type="number"
                  min="0"
                  className={input}
                  value={hpp ?? ''}
                  placeholder="Modal per produk"
                  onChange={event => setHpp(nullableNumber(event.target.value))}
                />
              </label>
            ) : null}
          </div>
        </div>
      </details>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-portal-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-bold text-portal-ink">Kanal penjualan</h2>
            <p className="text-xs text-portal-soft">Lihat hasil bersih dulu, lalu buka perhitungan jika perlu.</p>
          </div>
          <span className="text-xs font-semibold text-portal-soft">{rows.filter(row => row.enabled).length} aktif</span>
        </div>

        <div className="divide-y divide-portal-line">
          {rows.map(row => (
            <ChannelRow
              key={row.key}
              row={row}
              price={price}
              hpp={hpp}
              canViewCosting={canViewCosting}
              saving={savingKey === row.key}
              onPatch={patch}
              onSave={save}
            />
          ))}
        </div>
      </section>

      {message ? <p role="status" className="px-1 text-xs text-portal-soft">{message}</p> : null}
    </div>
  );
}

function ChannelRow({
  row,
  price,
  hpp,
  canViewCosting,
  saving,
  onPatch,
  onSave,
}: {
  row: EditableChannel;
  price: number | null;
  hpp: number | null;
  canViewCosting: boolean;
  saving: boolean;
  onPatch: (key: string, field: keyof EditableChannel, value: string | number | boolean) => void;
  onSave: (row: EditableChannel) => Promise<void>;
}) {
  const readiness = channelSimulationReadiness({ recordedPrice: price, hpp, canViewCosting });
  const businessSummary = useMemo(
    () => buildChannelBusinessSummary({
      price,
      hpp,
      feePercent: row.feePercent,
      fixedFee: row.fixedFee,
      merchantPromo: row.merchantPromo,
      targetMarginPercent: row.targetMarginPercent,
    }),
    [price, hpp, row.feePercent, row.fixedFee, row.merchantPromo, row.targetMarginPercent],
  );

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <label className="flex min-h-10 shrink-0 items-center">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={event => onPatch(row.key, 'enabled', event.target.checked)}
            className="h-4 w-4"
            aria-label={`Aktifkan ${row.displayName}`}
          />
        </label>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-portal-ink">{row.displayName}</p>
          <p className="mt-0.5 text-[11px] text-portal-soft">
            {row.enabled
              ? `${pct.format(row.feePercent)}% potongan platform`
              : 'Tidak dipakai'}
          </p>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
          row.enabled ? 'bg-portal-mist text-portal-forest' : 'bg-[#f5f6f4] text-portal-soft'
        }`}>
          {row.enabled ? 'Aktif' : 'Tidak dipakai'}
        </span>
      </div>

      {row.enabled && canViewCosting && businessSummary.ready ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-xl bg-[#fafbf9] p-3">
            <p className="text-[11px] text-portal-soft">Harga jual</p>
            <p className="mt-1 text-sm font-black text-portal-ink">{money.format(price ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-[#fafbf9] p-3">
            <p className="text-[11px] text-portal-soft">Total potongan</p>
            <p className="mt-1 text-sm font-black text-portal-ink">{money.format(businessSummary.totalDeductions)}</p>
          </div>
          <div className="rounded-xl bg-[#fafbf9] p-3">
            <p className="text-[11px] text-portal-soft">Diterima bersih</p>
            <p className="mt-1 text-sm font-black text-portal-ink">{money.format(businessSummary.netReceipt)}</p>
          </div>
          <div className="rounded-xl bg-[#fafbf9] p-3">
            <p className="text-[11px] text-portal-soft">Laba per item</p>
            <p className={`mt-1 text-sm font-black ${
              businessSummary.contributionProfit >= 0 ? 'text-portal-forest' : 'text-red-700'
            }`}>
              {money.format(businessSummary.contributionProfit)}
            </p>
          </div>
          <div className="rounded-xl bg-[#fafbf9] p-3">
            <p className="text-[11px] text-portal-soft">Harga aman</p>
            <p className="mt-1 text-sm font-black text-portal-ink">
              {businessSummary.recommendedPrice === null
                ? 'Belum ada'
                : money.format(businessSummary.recommendedPrice)}
            </p>
          </div>
        </div>
      ) : row.enabled && readiness !== 'ready' ? (
        <p className="mt-3 rounded-xl bg-[#fafbf9] px-3 py-2.5 text-xs text-portal-soft">
          {readiness === 'missing-price'
            ? 'Isi harga toko untuk melihat simulasi kanal.'
            : readiness === 'missing-hpp'
              ? 'Lengkapi HPP untuk melihat laba dan harga aman.'
              : 'Akses ini tidak menampilkan HPP dan keuntungan.'}
        </p>
      ) : null}

      <details className="group mt-3 ml-7">
        <summary className="cursor-pointer list-none text-[11px] font-bold text-portal-soft">
          Atur perhitungan
        </summary>
        <div className="mt-3 grid gap-3 rounded-xl bg-[#fafbf9] p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-portal-soft">
            Nama kanal
            <input className={input} value={row.displayName} onChange={event => onPatch(row.key, 'displayName', event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">
            Potongan %
            <input type="number" min="0" max="100" step="0.01" className={input} value={row.feePercent} onChange={event => onPatch(row.key, 'feePercent', Number(event.target.value) || 0)} />
          </label>
          {canViewCosting ? (
            <label className="text-xs font-semibold text-portal-soft">
              Target margin %
              <input type="number" min="0" max="99" step="0.1" className={input} value={row.targetMarginPercent} onChange={event => onPatch(row.key, 'targetMarginPercent', Number(event.target.value) || 0)} />
            </label>
          ) : null}

          <details className="sm:col-span-2 lg:col-span-3">
            <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Biaya tambahan</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">
                Biaya tetap
                <input type="number" min="0" className={input} value={row.fixedFee} onChange={event => onPatch(row.key, 'fixedFee', Number(event.target.value) || 0)} />
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Promo dari toko
                <input type="number" min="0" className={input} value={row.merchantPromo} onChange={event => onPatch(row.key, 'merchantPromo', Number(event.target.value) || 0)} />
              </label>
            </div>
          </details>

          <div className="sm:col-span-2 lg:col-span-3">
            <button type="button" disabled={saving} onClick={() => onSave(row)} className="portal-button-primary disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
