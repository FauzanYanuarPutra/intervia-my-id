'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save, TriangleAlert } from 'lucide-react';
import { reconcileSettlement } from '@/lib/business-control/settlement';

type SettlementRecord = {
  id: string;
  channel_key: string;
  period_start: string;
  period_end: string;
  gross_sales_amount: number;
  platform_fee_amount: number;
  merchant_promo_amount: number;
  refunds_amount: number;
  other_deductions_amount: number;
  expected_transfer_amount: number;
  actual_transfer_amount: number;
  difference_amount: number;
  status: 'matched' | 'short' | 'excess';
  note: string;
};

type ChannelOption = { key: string; label: string };

type Props = {
  businessId: string;
  initialSettlements: SettlementRecord[];
  initialChannels?: ChannelOption[];
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const today = () => new Date().toISOString().slice(0, 10);
const defaultChannels: ChannelOption[] = [
  { key: 'gofood', label: 'GoFood' },
  { key: 'grabfood', label: 'GrabFood' },
  { key: 'shopeefood', label: 'ShopeeFood' },
];

function amount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function channelLabel(key: string, channels: ChannelOption[]) {
  return channels.find(channel => channel.key === key)?.label ?? key;
}

export function SettlementWorkspace({ businessId, initialSettlements, initialChannels = [] }: Props) {
  const channels = useMemo(() => {
    const merged = new Map(defaultChannels.map(channel => [channel.key, channel]));
    for (const channel of initialChannels) merged.set(channel.key, channel);
    return [...merged.values()];
  }, [initialChannels]);
  const [records, setRecords] = useState(initialSettlements);
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? 'gofood');
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [grossSales, setGrossSales] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [merchantPromo, setMerchantPromo] = useState(0);
  const [refunds, setRefunds] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [actualTransfer, setActualTransfer] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const preview = useMemo(() => {
    try {
      return reconcileSettlement({ grossSales, platformFee, merchantPromo, refunds, otherDeductions, actualTransfer });
    } catch {
      return null;
    }
  }, [grossSales, platformFee, merchantPromo, refunds, otherDeductions, actualTransfer]);

  async function save() {
    if (!preview) {
      setMessage('Periksa angka. Total potongan tidak boleh lebih besar dari omzet kotor.');
      return;
    }
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      setMessage('Periode settlement tidak valid.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_key: channelKey,
          period_start: periodStart,
          period_end: periodEnd,
          gross_sales_amount: grossSales,
          platform_fee_amount: platformFee,
          merchant_promo_amount: merchantPromo,
          refunds_amount: refunds,
          other_deductions_amount: otherDeductions,
          actual_transfer_amount: actualTransfer,
          note,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Gagal menyimpan settlement.');
      const saved = payload?.data?.settlement as SettlementRecord | undefined;
      if (saved) setRecords(current => [saved, ...current]);
      setMessage(saved?.status === 'matched' ? 'Settlement cocok dan tersimpan.' : 'Settlement tersimpan. Ada selisih yang perlu diperiksa.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan settlement.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink';

  return (
    <div className="space-y-4">
      <section className="portal-panel overflow-hidden">
        <div className="border-b border-portal-line p-4 sm:p-5">
          <p className="portal-kicker">Cocokkan platform</p>
          <h2 className="mt-1 text-lg font-bold text-portal-ink">Settlement masuk sesuai laporan?</h2>
          <p className="mt-1 text-sm leading-6 text-portal-soft">Masukkan angka dari laporan merchant atau rekening. Lajukan menghitung transfer yang seharusnya dan selisihnya. Catatan settlement tidak otomatis dihitung lagi sebagai omzet.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
          <label className="text-xs font-semibold text-portal-soft">Kanal
            <select className={inputClass} value={channelKey} onChange={event => setChannelKey(event.target.value)}>
              {channels.map(channel => <option key={channel.key} value={channel.key}>{channel.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Dari tanggal
            <input className={inputClass} type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Sampai tanggal
            <input className={inputClass} type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Omzet kotor
            <input className={inputClass} type="number" min="0" value={grossSales} onChange={event => setGrossSales(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Biaya platform
            <input className={inputClass} type="number" min="0" value={platformFee} onChange={event => setPlatformFee(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Promo ditanggung merchant
            <input className={inputClass} type="number" min="0" value={merchantPromo} onChange={event => setMerchantPromo(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Refund
            <input className={inputClass} type="number" min="0" value={refunds} onChange={event => setRefunds(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Potongan lain
            <input className={inputClass} type="number" min="0" value={otherDeductions} onChange={event => setOtherDeductions(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Transfer aktual
            <input className={inputClass} type="number" min="0" value={actualTransfer} onChange={event => setActualTransfer(amount(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-portal-soft sm:col-span-2 lg:col-span-3">Catatan
            <input className={inputClass} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Contoh: Settlement ShopeeFood 5 September" />
          </label>
        </div>
        <div className="grid gap-3 border-t border-portal-line bg-[#fafbf9] p-4 sm:grid-cols-3 sm:p-5">
          <div><p className="portal-label">Seharusnya diterima</p><p className="mt-1 text-xl font-bold text-portal-ink">{preview ? money.format(preview.expectedTransfer) : '—'}</p></div>
          <div><p className="portal-label">Transfer aktual</p><p className="mt-1 text-xl font-bold text-portal-ink">{money.format(actualTransfer)}</p></div>
          <div><p className="portal-label">Selisih</p><p className={`mt-1 text-xl font-bold ${preview?.difference === 0 ? 'text-portal-forest' : 'text-amber-700'}`}>{preview ? money.format(preview.difference) : 'Periksa angka'}</p></div>
        </div>
        <div className="flex flex-col gap-3 border-t border-portal-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="text-xs leading-5 text-portal-soft">{preview?.status === 'matched' ? 'Angka cocok.' : preview ? 'Ada selisih. Simpan agar bisa ditindaklanjuti.' : 'Total potongan melebihi omzet kotor.'}</div>
          <button type="button" onClick={save} disabled={saving} className="portal-button-primary justify-center disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan settlement</button>
        </div>
        {message ? <p className="border-t border-portal-line px-4 py-3 text-xs text-portal-soft sm:px-5">{message}</p> : null}
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="border-b border-portal-line p-4 sm:p-5"><h2 className="font-bold text-portal-ink">Riwayat settlement</h2><p className="mt-1 text-sm text-portal-soft">Selisih tetap terlihat sampai Anda memeriksa sumbernya.</p></div>
        <div className="divide-y divide-portal-line">
          {records.length ? records.map(record => (
            <article key={record.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-portal-ink">{channelLabel(record.channel_key, channels)}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${record.status === 'matched' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{record.status === 'matched' ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}{record.status === 'matched' ? 'Cocok' : record.status === 'short' ? 'Kurang' : 'Lebih'}</span>
                </div>
                <p className="mt-1 text-xs text-portal-soft">{record.period_start} – {record.period_end} · omzet {money.format(record.gross_sales_amount)} · seharusnya {money.format(record.expected_transfer_amount)}</p>
                {record.note ? <p className="mt-1 text-xs text-portal-soft">{record.note}</p> : null}
              </div>
              <div className="sm:text-right"><p className="text-xs text-portal-soft">Aktual {money.format(record.actual_transfer_amount)}</p><p className={`mt-1 font-bold ${record.difference_amount === 0 ? 'text-portal-forest' : 'text-amber-700'}`}>Selisih {money.format(record.difference_amount)}</p></div>
            </article>
          )) : <div className="p-5 text-sm text-portal-soft">Belum ada settlement. Mulai dari laporan merchant terbaru atau transfer yang baru masuk.</div>}
        </div>
      </section>
    </div>
  );
}
