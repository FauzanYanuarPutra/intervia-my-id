'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus } from 'lucide-react';
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
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const incomeTypes = [
  ['sale_income', 'Penjualan'],
  ['other_income', 'Pendapatan lain'],
  ['owner_capital', 'Modal pemilik'],
  ['receivable_payment', 'Piutang dibayar'],
] as const;

const expenseTypes = [
  ['ingredient_purchase', 'Belanja bahan'],
  ['packaging_purchase', 'Belanja kemasan'],
  ['rent', 'Sewa'],
  ['utilities', 'Listrik / air / internet'],
  ['salary', 'Gaji'],
  ['transport', 'Transport'],
  ['marketing', 'Promosi'],
  ['equipment', 'Peralatan'],
  ['payable_payment', 'Bayar utang'],
  ['owner_drawing', 'Ambil pribadi'],
  ['other_expense', 'Pengeluaran lain'],
] as const;

const labels = Object.fromEntries([...incomeTypes, ...expenseTypes]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceLedger({ businessId, initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [entryType, setEntryType] = useState('sale_income');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(today());
  const [accountKey, setAccountKey] = useState('cash');
  const [note, setNote] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const summary = useMemo(() => summarizeFinanceEntries(entries), [entries]);
  const choices = direction === 'in' ? incomeTypes : expenseTypes;

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
    setEntryType(next === 'in' ? 'sale_income' : 'ingredient_purchase');
    setMessage('');
  }

  async function save() {
    const parsedAmount = Math.round(Number(amount));
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
          channel_key: channelKey.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan transaksi.');
      await reload();
      setAmount('');
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
          <p className="mt-1 text-xs text-portal-soft">Hanya transaksi bertipe Penjualan.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Biaya usaha tercatat</p>
          <p className="mt-2 text-2xl font-bold text-portal-ink">{money.format(summary.operatingExpenses)}</p>
          <p className="mt-1 text-xs text-portal-soft">Belanja, sewa, utilitas, gaji, promosi, dan biaya usaha lain.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Hasil sementara sebelum HPP</p>
          <p className={`mt-2 text-2xl font-bold ${summary.operatingProfitBeforeCogs >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>
            {money.format(summary.operatingProfitBeforeCogs)}
          </p>
          <p className="mt-1 text-xs text-portal-soft">Belum mengurangi HPP produk terjual sampai sales cost snapshot terhubung.</p>
        </div>
        <div className="portal-panel p-4">
          <p className="portal-label">Perubahan kas tercatat</p>
          <p className={`mt-2 text-2xl font-bold ${summary.cashMovement >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>
            {money.format(summary.cashMovement)}
          </p>
          <p className="mt-1 text-xs text-portal-soft">Termasuk modal pemilik dan ambil pribadi.</p>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => chooseDirection('in')} className={direction === 'in' ? 'portal-button-primary' : 'portal-button-secondary'}>
            <ArrowDownLeft className="h-4 w-4" /> Uang masuk
          </button>
          <button type="button" onClick={() => chooseDirection('out')} className={direction === 'out' ? 'portal-button-primary' : 'portal-button-secondary'}>
            <ArrowUpRight className="h-4 w-4" /> Uang keluar
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-semibold text-portal-soft">Kategori
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={entryType} onChange={event => setEntryType(event.target.value)}>
              {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Nominal
            <input inputMode="numeric" type="number" min="1" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Contoh: 120000" value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Tanggal
            <input type="date" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Masuk/keluar lewat
            <select className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" value={accountKey} onChange={event => setAccountKey(event.target.value)}>
              <option value="cash">Kas</option>
              <option value="bank">Bank</option>
              <option value="ewallet">E-wallet</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">Kanal jual <span className="font-normal">(opsional)</span>
            <input className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="gofood / grabfood / offline" value={channelKey} onChange={event => setChannelKey(event.target.value)} />
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
          <p className="mt-1 text-sm text-portal-soft">Catatan ini tersimpan di backend usaha, bukan local browser.</p>
        </div>
        <div className="divide-y divide-portal-line">
          {entries.length ? entries.map(entry => {
            const incoming = financeEntryDirection(entry.entry_type) === 'in';
            return (
              <div key={entry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold text-portal-ink">{labels[entry.entry_type] ?? entry.entry_type}</p>
                  <p className="mt-1 text-xs text-portal-soft">{entry.occurred_on} · {entry.account_key}{entry.channel_key ? ` · ${entry.channel_key}` : ''}{entry.note ? ` · ${entry.note}` : ''}</p>
                </div>
                <strong className={incoming ? 'text-portal-forest' : 'text-red-700'}>{incoming ? '+' : '-'}{money.format(entry.amount)}</strong>
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">Belum ada transaksi. Catat satu uang masuk atau uang keluar untuk mulai.</div>}
        </div>
      </section>
    </div>
  );
}
