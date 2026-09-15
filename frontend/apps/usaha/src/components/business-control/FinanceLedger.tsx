'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus } from 'lucide-react';
import {
  financeChannelOptions,
  financeEntryOptions,
} from '@/lib/business-control/finance-entry-options';
import {
  financeEntryDirection,
  summarizeFinanceEntries,
} from '@/lib/business-control/ledger';

type Entry = {
  id: string;
  entry_type: string;
  account_key: string;
  amount: number;
  occurred_on: string;
  note: string;
  channel_key: string | null;
};

type Props = {
  businessId: string;
  initialEntries: Entry[];
  channels?: Array<{ key: string; label: string }>;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const historyLabels: Record<string, string> = {
  sale_income: 'Penjualan',
  other_income: 'Pendapatan lain',
  capital_income: 'Modal masuk',
  owner_capital: 'Modal masuk',
  receivable_payment: 'Piutang dibayar',
  inventory_expense: 'Belanja stok / bahan',
  ingredient_purchase: 'Belanja bahan',
  packaging_purchase: 'Belanja kemasan',
  payroll_expense: 'Gaji karyawan',
  salary: 'Gaji karyawan',
  rent_expense: 'Sewa kios / tempat',
  rent: 'Sewa kios / tempat',
  utilities_expense: 'Listrik / air / internet',
  utilities: 'Listrik / air / internet',
  transport_expense: 'Transport / bensin',
  transport: 'Transport / bensin',
  marketing_expense: 'Promosi',
  marketing: 'Promosi',
  equipment_expense: 'Peralatan',
  equipment: 'Peralatan',
  owner_draw: 'Ambil owner',
  owner_drawing: 'Ambil owner',
  other_expense: 'Pengeluaran lain',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceLedger({ businessId, initialEntries, channels = [] }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [entryType, setEntryType] = useState('other_income');
  const [entryAmount, setEntryAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(today());
  const [accountKey, setAccountKey] = useState('cash');
  const [note, setNote] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const summary = useMemo(() => summarizeFinanceEntries(entries), [entries]);
  const cashIn = useMemo(() => entries.reduce((sum, entry) => financeEntryDirection(entry.entry_type) === 'in' ? sum + Number(entry.amount || 0) : sum, 0), [entries]);
  const cashOut = useMemo(() => entries.reduce((sum, entry) => financeEntryDirection(entry.entry_type) === 'out' ? sum + Number(entry.amount || 0) : sum, 0), [entries]);
  const choices = financeEntryOptions(direction);
  const channelChoices = financeChannelOptions(channels);

  async function reload() {
    const response = await fetch(`/api/businesses/${businessId}/finance-entries`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Gagal memuat ulang transaksi.');
    const payload = await response.json();
    setEntries(Array.isArray(payload?.data?.items) ? payload.data.items : []);
  }

  function chooseDirection(next: 'in' | 'out') {
    setDirection(next);
    setEntryType(next === 'in' ? 'other_income' : 'inventory_expense');
    setMessage('');
  }

  async function save() {
    const parsedAmount = Math.round(Number(entryAmount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage('Isi nominal lebih dari Rp0.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/finance-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: entryType,
          account_key: accountKey,
          amount: parsedAmount,
          occurred_on: occurredOn,
          note,
          channel_key: channelKey || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan transaksi.');
      await reload();
      setEntryAmount('');
      setNote('');
      setChannelKey('');
      setMessage('Tersimpan. Angka ringkasan sudah diperbarui.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="portal-panel p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-semibold text-portal-soft">Uang masuk</p>
            <p className="mt-1 text-lg font-black text-portal-ink">{money.format(cashIn)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-portal-soft">Uang keluar</p>
            <p className="mt-1 text-lg font-black text-portal-ink">{money.format(cashOut)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-portal-soft">Saldo arus</p>
            <p className={`mt-1 text-lg font-black ${summary.cashMovement >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(summary.cashMovement)}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-portal-line pt-3 text-xs text-portal-soft">Penjualan dari Kasir masuk otomatis dan tidak perlu dicatat ulang.</p>
      </section>

      <details className="portal-panel group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 sm:p-5">
          <span className="flex items-center gap-2 font-bold text-portal-ink"><Plus className="h-4 w-4" /> Catat transaksi</span>
          <span className="text-xs font-semibold text-portal-soft">Selain penjualan kasir</span>
        </summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => chooseDirection('in')} className={direction === 'in' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}>
              <ArrowDownLeft className="h-4 w-4" /> Uang masuk
            </button>
            <button type="button" onClick={() => chooseDirection('out')} className={direction === 'out' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}>
              <ArrowUpRight className="h-4 w-4" /> Uang keluar
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-portal-soft">Kategori
              <select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" value={entryType} onChange={event => setEntryType(event.target.value)}>
                {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Nominal
              <input inputMode="numeric" type="number" min="1" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-base font-bold text-portal-ink" placeholder="Contoh: 120000" value={entryAmount} onChange={event => setEntryAmount(event.target.value)} />
            </label>
          </div>

          <details className="mt-3 rounded-xl bg-[#fafbf9] p-3">
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail transaksi</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-portal-soft">Tanggal<input type="date" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} /></label>
              <label className="text-xs font-semibold text-portal-soft">Dibayar lewat<select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={accountKey} onChange={event => setAccountKey(event.target.value)}><option value="cash">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option></select></label>
              <label className="text-xs font-semibold text-portal-soft">Kanal<select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={channelKey} onChange={event => setChannelKey(event.target.value)}>{channelChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
              <label className="text-xs font-semibold text-portal-soft">Catatan<input className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={note} onChange={event => setNote(event.target.value)} placeholder="Opsional" /></label>
            </div>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving} onClick={save} className="portal-button-primary disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan</button>
            {message ? <p role="status" className="text-xs text-portal-soft">{message}</p> : null}
          </div>
        </div>
      </details>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-portal-line px-4 py-3 sm:px-5">
          <h2 className="font-bold text-portal-ink">Transaksi terbaru</h2>
          <span className="text-xs font-semibold text-portal-soft">{entries.length} catatan</span>
        </div>
        <div className="divide-y divide-portal-line">
          {entries.length ? entries.map(entry => {
            const incoming = financeEntryDirection(entry.entry_type) === 'in';
            return (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-portal-ink">{historyLabels[entry.entry_type] ?? entry.entry_type}</p>
                  <p className="mt-0.5 truncate text-[11px] text-portal-soft">{entry.occurred_on} · {entry.account_key}{entry.note ? ` · ${entry.note}` : ''}</p>
                </div>
                <strong className={`shrink-0 text-sm ${incoming ? 'text-portal-forest' : 'text-red-700'}`}>{incoming ? '+' : '-'}{money.format(entry.amount)}</strong>
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">Belum ada transaksi.</div>}
        </div>
      </section>
    </div>
  );
}
