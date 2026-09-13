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
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="portal-panel p-4">
          <p className="portal-label">Omzet tercatat</p>
          <p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(summary.revenue)}</p>
          <p className="mt-1 text-xs text-portal-soft">Penjualan masuk otomatis dari Kasir, tidak diinput ulang di sini.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Biaya usaha tercatat</p>
          <p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(summary.operatingExpenses)}</p>
          <p className="mt-1 text-xs text-portal-soft">Belanja, sewa, utilitas, gaji, transport, promosi, dan biaya usaha lain.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Hasil sementara sebelum HPP</p>
          <p className={`mt-2 text-2xl font-bold ${summary.operatingProfitBeforeCogs >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>
            {money.format(summary.operatingProfitBeforeCogs)}
          </p>
          <p className="mt-1 text-xs text-portal-soft">Tidak disebut laba bersih; HPP yang belum lengkap tetap ditandai terpisah.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Perubahan kas tercatat</p>
          <p className={`mt-2 text-2xl font-bold ${summary.cashMovement >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>
            {money.format(summary.cashMovement)}
          </p>
          <p className="mt-1 text-xs text-portal-soft">Termasuk modal masuk dan Ambil owner; keduanya tidak mengubah hasil operasi.</p>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => chooseDirection('in')} className={direction === 'in' ? 'portal-button-primary' : 'portal-button-secondary'}>
            <ArrowDownLeft className="h-4 w-4" /> Uang masuk lain
          </button>
          <button type="button" onClick={() => chooseDirection('out')} className={direction === 'out' ? 'portal-button-primary' : 'portal-button-secondary'}>
            <ArrowUpRight className="h-4 w-4" /> Uang keluar
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-portal-soft">Penjualan dibuat dari Kasir agar omzet tidak pernah tercatat dua kali.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-semibold text-portal-soft">Kategori
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={entryType} onChange={event => setEntryType(event.target.value)}>
              {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Nominal
            <input inputMode="numeric" type="number" min="1" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Contoh: 120000" value={entryAmount} onChange={event => setEntryAmount(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Tanggal
            <input type="date" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Dibayar lewat
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={accountKey} onChange={event => setAccountKey(event.target.value)}>
              <option value="cash">Kas</option>
              <option value="bank">Bank</option>
              <option value="ewallet">E-wallet</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Tempat jualan <span className="font-normal">(opsional)</span>
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={channelKey} onChange={event => setChannelKey(event.target.value)}>
              {channelChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Catatan
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Singkat saja" value={note} onChange={event => setNote(event.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving} onClick={save} className="portal-button-primary disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan transaksi
          </button>
          {message ? <p className="text-xs text-portal-soft">{message}</p> : null}
        </div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="border-b border-portal-line p-4 sm:p-5">
          <h2 className="font-bold text-portal-ink">Transaksi terbaru</h2>
          <p className="mt-1 text-sm text-portal-soft">Catatan tersimpan di backend usaha dan sumber otomatis tetap diberi penanda.</p>
        </div>
        <div className="divide-y divide-portal-line">
          {entries.length ? entries.map(entry => {
            const incoming = financeEntryDirection(entry.entry_type) === 'in';
            return (
              <div key={entry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold text-portal-ink">{historyLabels[entry.entry_type] ?? entry.entry_type}</p>
                  <p className="mt-1 text-xs text-portal-soft">{entry.occurred_on} · {entry.account_key}{entry.channel_key ? ` · ${entry.channel_key}` : ''}{entry.note ? ` · ${entry.note}` : ''}</p>
                </div>
                <strong className={incoming ? 'text-portal-forest' : 'text-red-700'}>{incoming ? '+' : '-'}{money.format(entry.amount)}</strong>
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">Belum ada transaksi. Penjualan dari Kasir atau catatan uang lain akan muncul di sini.</div>}
        </div>
      </section>
    </div>
  );
}
