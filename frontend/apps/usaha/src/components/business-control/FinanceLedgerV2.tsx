'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  History,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  WalletCards,
  X,
} from 'lucide-react';
import {
  financeChannelOptions,
  financeEntryOptions,
} from '@/lib/business-control/finance-entry-options';
import {
  financeEntrySignedCashEffect,
  summarizeFinanceEntries,
} from '@/lib/business-control/ledger';
import { jakartaDateKey } from '@/lib/business-control/insights';

type LegacyEntry = {
  id: string;
  entry_type: string;
  account_key: string;
  amount: number;
  occurred_on: string;
  note: string;
  channel_key: string | null;
};

type Entry = LegacyEntry & {
  source_type?: string | null;
  source_id?: string | null;
  created_by_user_id?: string;
  effect_multiplier?: 1 | -1;
  reversal_of_entry_id?: string | null;
  corrects_entry_id?: string | null;
  correction_reason?: string | null;
  allocation_bucket?: string | null;
  corrected?: boolean;
  replacement_entry_id?: string | null;
  corrected_by_user_id?: string | null;
  corrected_at?: string | null;
  created_at?: string;
};

type Allocation = {
  bucket: 'owner' | 'team' | 'reinvest' | 'operations' | 'reserve';
  balance: number;
};

type Summary = {
  accounts: Array<{ account_key: string; balance: number }>;
  allocations: Allocation[];
  liquid_cash: number;
  receivable: number;
  payable: number;
  sale_revenue: number;
  other_income: number;
  operating_expenses: number;
  inventory_purchases: number;
  owner_capital: number;
  owner_draw: number;
  cash_movement: number;
  allocated_total: number;
  unallocated_cash: number;
};

type Props = {
  businessId: string;
  initialEntries: LegacyEntry[];
  channels?: Array<{ key: string; label: string }>;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const historyLabels: Record<string, string> = {
  sale_income: 'Penjualan',
  sale_refund: 'Refund penjualan',
  other_income: 'Pendapatan lain',
  capital_income: 'Modal masuk',
  owner_capital: 'Modal masuk',
  receivable_payment: 'Piutang dibayar',
  inventory_purchase: 'Belanja stok / bahan',
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
  payable_payment: 'Bayar utang usaha',
  other_expense: 'Pengeluaran lain',
};

const allocationLabels: Record<Allocation['bucket'], string> = {
  owner: 'Owner',
  team: 'Gaji tim',
  reinvest: 'Diputar lagi',
  operations: 'Operasional',
  reserve: 'Cadangan',
};

const allocationOptions: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tanpa kantong' },
  { value: 'owner', label: 'Owner' },
  { value: 'team', label: 'Gaji tim' },
  { value: 'reinvest', label: 'Diputar lagi' },
  { value: 'operations', label: 'Operasional' },
  { value: 'reserve', label: 'Cadangan' },
];

function userShort(value?: string | null) {
  return value ? value.slice(0, 8) : 'sistem';
}

function entryCashEffect(entry: Entry) {
  return financeEntrySignedCashEffect({
    entry_type: entry.entry_type,
    account_key: entry.account_key,
    amount: entry.amount,
    effect_sign: entry.effect_multiplier ?? 1,
  });
}

function canCorrect(entry: Entry) {
  return (
    (entry.effect_multiplier ?? 1) === 1 &&
    !entry.reversal_of_entry_id &&
    !entry.corrected &&
    entry.entry_type !== 'sale_income' &&
    entry.source_type !== 'business_sale'
  );
}

export function FinanceLedgerV2({ businessId, initialEntries, channels = [] }: Props) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [entryType, setEntryType] = useState('other_income');
  const [entryAmount, setEntryAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(jakartaDateKey());
  const [accountKey, setAccountKey] = useState('cash');
  const [note, setNote] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [allocationBucket, setAllocationBucket] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionMode, setCorrectionMode] = useState<'correct' | 'void'>('correct');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionType, setCorrectionType] = useState('other_expense');
  const [correctionAccount, setCorrectionAccount] = useState('cash');
  const [correctionDate, setCorrectionDate] = useState(jakartaDateKey());
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionBucket, setCorrectionBucket] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const [allocationFrom, setAllocationFrom] = useState('unallocated');
  const [allocationTo, setAllocationTo] = useState('operations');
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationReason, setAllocationReason] = useState('');
  const [movingAllocation, setMovingAllocation] = useState(false);

  const legacySummary = useMemo(
    () =>
      summarizeFinanceEntries(
        entries.map(entry => ({
          entry_type: entry.entry_type,
          account_key: entry.account_key,
          amount: entry.amount,
          effect_sign: entry.effect_multiplier ?? 1,
        })),
      ),
    [entries],
  );
  const choices = financeEntryOptions(direction);
  const channelChoices = financeChannelOptions(channels);

  const allocations = summary?.allocations ?? [
    { bucket: 'owner' as const, balance: 0 },
    { bucket: 'team' as const, balance: 0 },
    { bucket: 'reinvest' as const, balance: 0 },
    { bucket: 'operations' as const, balance: 0 },
    { bucket: 'reserve' as const, balance: 0 },
  ];

  async function reloadAll(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const [historyResponse, summaryResponse] = await Promise.all([
        fetch(`/api/businesses/${businessId}/finance-core/entries`, { cache: 'no-store' }),
        fetch(`/api/businesses/${businessId}/finance-core/summary`, { cache: 'no-store' }),
      ]);
      const historyPayload = await historyResponse.json().catch(() => ({}));
      const summaryPayload = await summaryResponse.json().catch(() => ({}));
      if (!historyResponse.ok) throw new Error(historyPayload?.error || 'Gagal memuat riwayat transaksi.');
      if (!summaryResponse.ok) throw new Error(summaryPayload?.error || 'Gagal memuat ringkasan uang.');
      setEntries(Array.isArray(historyPayload?.data?.items) ? historyPayload.data.items : []);
      setSummary(summaryPayload?.data?.summary ?? null);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    reloadAll(true).catch(() => {
      // Initial server data remains a safe fallback if Finance Core is temporarily unavailable.
    });
    // businessId is stable for this page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function chooseDirection(next: 'in' | 'out') {
    setDirection(next);
    setEntryType(next === 'in' ? 'other_income' : 'inventory_purchase');
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
      const response = await fetch(`/api/businesses/${businessId}/finance-core/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          entry_type: entryType,
          account_key: accountKey,
          amount: parsedAmount,
          occurred_on: occurredOn,
          note,
          channel_key: channelKey || null,
          allocation_bucket: allocationBucket || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan transaksi.');
      await reloadAll(true);
      setEntryAmount('');
      setNote('');
      setChannelKey('');
      setAllocationBucket('');
      setMessage('Tersimpan satu kali. Saldo, kantong, dan riwayat sudah diperbarui.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  }

  function openCorrection(entry: Entry) {
    setCorrectingId(entry.id);
    setCorrectionMode('correct');
    setCorrectionReason('');
    setCorrectionAmount(String(entry.amount));
    setCorrectionType(entry.entry_type);
    setCorrectionAccount(entry.account_key);
    setCorrectionDate(entry.occurred_on);
    setCorrectionNote(entry.note);
    setCorrectionBucket(entry.allocation_bucket ?? '');
    setMessage('');
  }

  async function submitCorrection(entry: Entry) {
    if (correctionReason.trim().length < 3) {
      setMessage('Alasan koreksi wajib diisi minimal 3 karakter.');
      return;
    }
    const parsedAmount = Math.round(Number(correctionAmount));
    if (correctionMode === 'correct' && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setMessage('Nominal pengganti harus lebih dari Rp0.');
      return;
    }
    setCorrecting(true);
    setMessage('');
    try {
      const replacement = correctionMode === 'void'
        ? null
        : {
            entry_type: correctionType,
            account_key: correctionAccount,
            amount: parsedAmount,
            occurred_on: correctionDate,
            note: correctionNote,
            channel_key: entry.channel_key,
            allocation_bucket: correctionBucket || null,
          };
      const response = await fetch(
        `/api/businesses/${businessId}/finance-core/entries/${entry.id}/correct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({ reason: correctionReason.trim(), replacement }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal mengoreksi transaksi.');
      setCorrectingId(null);
      await reloadAll(true);
      setMessage(
        correctionMode === 'void'
          ? 'Transaksi dibatalkan lewat reversal. Catatan asli tetap tersimpan.'
          : 'Koreksi tersimpan sebagai reversal + transaksi pengganti. Histori asli tidak dihapus.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal mengoreksi transaksi.');
    } finally {
      setCorrecting(false);
    }
  }

  async function moveAllocation() {
    const parsedAmount = Math.round(Number(allocationAmount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || allocationReason.trim().length < 3) {
      setMessage('Isi nominal dan alasan pemindahan kantong dengan benar.');
      return;
    }
    setMovingAllocation(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/finance-core/allocations/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          from_bucket: allocationFrom === 'unallocated' ? null : allocationFrom,
          to_bucket: allocationTo,
          amount: parsedAmount,
          reason: allocationReason.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal memindahkan dana antar kantong.');
      await reloadAll(true);
      setAllocationAmount('');
      setAllocationReason('');
      setMessage('Dana kantong berhasil dipindahkan. Kas usaha tidak berubah.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memindahkan dana antar kantong.');
    } finally {
      setMovingAllocation(false);
    }
  }

  const liquidCash = summary?.liquid_cash ?? legacySummary.cashMovement;
  const cashMovement = summary?.cash_movement ?? legacySummary.cashMovement;

  return (
    <div className="space-y-3">
      <section className="portal-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-portal-soft">Saldo authoritative</p>
            <p className="mt-1 text-3xl font-black text-portal-ink">{money.format(liquidCash)}</p>
            <p className="mt-1 text-xs text-portal-soft">Kas + bank + e-wallet dari seluruh ledger, bukan daftar transaksi yang sedang tampil.</p>
          </div>
          <button type="button" onClick={() => reloadAll().catch(error => setMessage(error instanceof Error ? error.message : 'Gagal memuat ulang.'))} disabled={refreshing} className="portal-button-secondary px-3 disabled:opacity-50">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span className="hidden sm:inline">Muat ulang</span>
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#f7f9f6] p-3"><p className="text-[10px] font-bold text-portal-soft">ARUS KAS NETO</p><p className={`mt-1 font-black ${cashMovement >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(cashMovement)}</p></div>
          <div className="rounded-xl bg-[#f7f9f6] p-3"><p className="text-[10px] font-bold text-portal-soft">PIUTANG</p><p className="mt-1 font-black text-portal-ink">{money.format(summary?.receivable ?? 0)}</p></div>
          <div className="rounded-xl bg-[#f7f9f6] p-3"><p className="text-[10px] font-bold text-portal-soft">UTANG</p><p className="mt-1 font-black text-portal-ink">{money.format(summary?.payable ?? 0)}</p></div>
          <div className="rounded-xl bg-[#f7f9f6] p-3"><p className="text-[10px] font-bold text-portal-soft">BELANJA STOK</p><p className="mt-1 font-black text-portal-ink">{money.format(summary?.inventory_purchases ?? legacySummary.inventoryPurchases)}</p><p className="mt-0.5 text-[10px] text-portal-soft">Bukan OPEX saat dibeli</p></div>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-portal-forest" /><h2 className="font-black text-portal-ink">Kantong uang nyata</h2></div>
        <p className="mt-1 text-xs text-portal-soft">Saldo ini nominal. Mengubah persentase rencana tidak mengubah saldo kantong yang sudah ada.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {allocations.map(item => (
            <div key={item.bucket} className="rounded-xl border border-portal-line bg-white p-3">
              <p className="text-[10px] font-bold text-portal-soft">{allocationLabels[item.bucket]}</p>
              <p className="mt-1 text-sm font-black text-portal-ink">{money.format(item.balance)}</p>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-portal-line bg-[#fafbf9] p-3">
            <p className="text-[10px] font-bold text-portal-soft">Belum dibagi</p>
            <p className="mt-1 text-sm font-black text-portal-ink">{money.format(Math.max(0, summary?.unallocated_cash ?? liquidCash))}</p>
          </div>
        </div>
        <details className="mt-3 rounded-xl bg-[#fafbf9] p-3">
          <summary className="cursor-pointer text-xs font-black text-portal-ink"><ArrowLeftRight className="mr-1 inline h-3.5 w-3.5" /> Pindahkan dana antar kantong</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <label className="text-xs font-semibold text-portal-soft">Dari<select value={allocationFrom} onChange={event => setAllocationFrom(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3"><option value="unallocated">Belum dibagi</option>{allocations.map(item => <option key={item.bucket} value={item.bucket}>{allocationLabels[item.bucket]} · {money.format(item.balance)}</option>)}</select></label>
            <label className="text-xs font-semibold text-portal-soft">Ke<select value={allocationTo} onChange={event => setAllocationTo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3">{allocations.map(item => <option key={item.bucket} value={item.bucket}>{allocationLabels[item.bucket]}</option>)}</select></label>
            <label className="text-xs font-semibold text-portal-soft">Nominal<input type="number" min="1" inputMode="numeric" value={allocationAmount} onChange={event => setAllocationAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label>
            <label className="text-xs font-semibold text-portal-soft">Alasan<input value={allocationReason} onChange={event => setAllocationReason(event.target.value)} placeholder="Contoh: tambah dana operasional" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label>
          </div>
          <button type="button" onClick={moveAllocation} disabled={movingAllocation} className="portal-button-primary mt-3 disabled:opacity-50">{movingAllocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />} Pindahkan</button>
        </details>
      </section>

      <details className="portal-panel group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 sm:p-5"><span className="flex items-center gap-2 font-bold text-portal-ink"><Plus className="h-4 w-4" /> Catat transaksi</span><span className="text-xs font-semibold text-portal-soft">Selain penjualan kasir</span></summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => chooseDirection('in')} className={direction === 'in' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}><ArrowDownLeft className="h-4 w-4" /> Uang masuk</button>
            <button type="button" onClick={() => chooseDirection('out')} className={direction === 'out' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}><ArrowUpRight className="h-4 w-4" /> Uang keluar</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-portal-soft">Kategori<select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" value={entryType} onChange={event => setEntryType(event.target.value)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-portal-soft">Nominal<input inputMode="numeric" type="number" min="1" className="mt-1 min-h-11 w-full rounded-xl border border-portal-line px-3 text-base font-bold text-portal-ink" placeholder="Contoh: 120000" value={entryAmount} onChange={event => setEntryAmount(event.target.value)} /></label>
            <label className="text-xs font-semibold text-portal-soft">Kantong<select className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm" value={allocationBucket} onChange={event => setAllocationBucket(event.target.value)}>{allocationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <details className="mt-3 rounded-xl bg-[#fafbf9] p-3"><summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail transaksi</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-portal-soft">Tanggal<input type="date" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} /></label><label className="text-xs font-semibold text-portal-soft">Akun<select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={accountKey} onChange={event => setAccountKey(event.target.value)}><option value="cash">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option><option value="receivable">Piutang</option><option value="payable">Utang</option></select></label><label className="text-xs font-semibold text-portal-soft">Kanal<select className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={channelKey} onChange={event => setChannelKey(event.target.value)}>{channelChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label><label className="text-xs font-semibold text-portal-soft">Catatan<input className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3 text-sm" value={note} onChange={event => setNote(event.target.value)} placeholder="Opsional" /></label></div></details>
          <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={saving} onClick={save} className="portal-button-primary disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan aman</button><p className="text-[11px] text-portal-soft">Double-click/retry dilindungi idempotency.</p></div>
        </div>
      </details>

      {message ? <div role="status" className="rounded-xl border border-portal-line bg-white px-4 py-3 text-xs font-semibold text-portal-soft">{message}</div> : null}

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-portal-line px-4 py-3 sm:px-5"><div><h2 className="font-bold text-portal-ink">Riwayat transaksi</h2><p className="mt-0.5 text-[11px] text-portal-soft">Catatan asli tidak dihapus saat koreksi.</p></div><span className="text-xs font-semibold text-portal-soft">{entries.length} terbaru</span></div>
        <div className="divide-y divide-portal-line">
          {entries.length ? entries.map(entry => {
            const effect = entryCashEffect(entry);
            const isReversal = Boolean(entry.reversal_of_entry_id);
            const isReplacement = Boolean(entry.corrects_entry_id);
            const correctionOpen = correctingId === entry.id;
            return (
              <div key={entry.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-semibold text-portal-ink">{historyLabels[entry.entry_type] ?? entry.entry_type}</p>{entry.corrected ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-800">DIKOREKSI</span> : null}{isReversal ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">PEMBALIK</span> : null}{isReplacement ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">PENGGANTI</span> : null}</div>
                    <p className="mt-0.5 truncate text-[11px] text-portal-soft">{entry.occurred_on} · {entry.account_key}{entry.allocation_bucket ? ` · ${allocationLabels[entry.allocation_bucket as Allocation['bucket']] ?? entry.allocation_bucket}` : ''}{entry.note ? ` · ${entry.note}` : ''}</p>
                    <p className="mt-0.5 text-[10px] text-portal-soft">PIC {userShort(entry.created_by_user_id)}{entry.correction_reason ? ` · ${entry.correction_reason}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right"><strong className={`text-sm ${effect >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>{effect >= 0 ? '+' : '-'}{money.format(Math.abs(effect || entry.amount))}</strong>{canCorrect(entry) ? <button type="button" onClick={() => correctionOpen ? setCorrectingId(null) : openCorrection(entry)} className="mt-1 flex items-center gap-1 text-[10px] font-black text-portal-forest"><PencilLine className="h-3 w-3" /> Koreksi</button> : null}</div>
                </div>

                {correctionOpen ? (
                  <div className="mt-3 rounded-xl border border-portal-line bg-[#fafbf9] p-3">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><History className="h-4 w-4 text-portal-forest" /><p className="text-xs font-black text-portal-ink">Koreksi tanpa menghapus histori</p></div><button type="button" onClick={() => setCorrectingId(null)} className="p-1 text-portal-soft"><X className="h-4 w-4" /></button></div>
                    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCorrectionMode('correct')} className={correctionMode === 'correct' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}><PencilLine className="h-4 w-4" /> Perbaiki</button><button type="button" onClick={() => setCorrectionMode('void')} className={correctionMode === 'void' ? 'portal-button-primary justify-center' : 'portal-button-secondary justify-center'}><RotateCcw className="h-4 w-4" /> Batalkan</button></div>
                    <label className="mt-3 block text-xs font-semibold text-portal-soft">Alasan wajib<input value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} placeholder="Contoh: nominal salah input" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label>
                    {correctionMode === 'correct' ? <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-semibold text-portal-soft">Kategori<select value={correctionType} onChange={event => setCorrectionType(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3">{[...financeEntryOptions('in'), ...financeEntryOptions('out')].filter((choice, index, all) => all.findIndex(item => item.value === choice.value) === index).map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label><label className="text-xs font-semibold text-portal-soft">Nominal<input type="number" min="1" value={correctionAmount} onChange={event => setCorrectionAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Akun<select value={correctionAccount} onChange={event => setCorrectionAccount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3"><option value="cash">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option><option value="receivable">Piutang</option><option value="payable">Utang</option></select></label><label className="text-xs font-semibold text-portal-soft">Tanggal<input type="date" value={correctionDate} onChange={event => setCorrectionDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Kantong<select value={correctionBucket} onChange={event => setCorrectionBucket(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3">{allocationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-semibold text-portal-soft">Catatan<input value={correctionNote} onChange={event => setCorrectionNote(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label></div> : <p className="mt-3 text-xs leading-5 text-portal-soft">Sistem membuat reversal penuh. Baris asli tetap ada dan ditandai dibatalkan.</p>}
                    <div className="mt-3 rounded-lg bg-white p-3 text-[11px] text-portal-soft"><strong className="text-portal-ink">Dampak:</strong> transaksi lama dibalik lebih dulu{correctionMode === 'correct' ? ', lalu nilai pengganti diposting.' : '.'} Saldo akun dan kantong dihitung ulang otomatis.</div>
                    <button type="button" disabled={correcting} onClick={() => submitCorrection(entry)} className="portal-button-primary mt-3 disabled:opacity-50">{correcting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Konfirmasi {correctionMode === 'void' ? 'pembatalan' : 'koreksi'}</button>
                  </div>
                ) : null}
              </div>
            );
          }) : <div className="p-5 text-sm text-portal-soft">Belum ada transaksi.</div>}
        </div>
      </section>
    </div>
  );
}
