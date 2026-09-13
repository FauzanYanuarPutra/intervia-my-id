'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2, Plus, ShieldCheck, WalletCards } from 'lucide-react';
import type {
  Wave2FinancePlan,
  Wave2Obligation,
} from '@/lib/business-wave2-server';
import { calculateSafeToSpend } from '@/lib/business-control/finance';
import {
  obligationUrgency,
  summarizeRecurringObligations,
} from '@/lib/business-control/finance-obligations';
import { financeEntryDirection } from '@/lib/business-control/ledger';

type FinanceEntry = {
  entry_type: string;
  account_key: string;
  amount: number;
};

type Props = {
  businessId: string;
  initialPlan: Wave2FinancePlan | null;
  initialObligations: Wave2Obligation[];
  entries: FinanceEntry[];
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPlan(plan: Wave2FinancePlan | null) {
  return {
    owner_payroll_bps: plan?.owner_payroll_bps ?? 0,
    staff_payroll_bps: plan?.staff_payroll_bps ?? 0,
    working_capital_bps: plan?.working_capital_bps ?? 0,
    operations_bps: plan?.operations_bps ?? 0,
    reserve_bps: plan?.reserve_bps ?? 0,
  };
}

function bpsToPercent(value: number) {
  return String(value / 100);
}

function percentToBps(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function urgencyLabel(value: ReturnType<typeof obligationUrgency>) {
  if (value === 'overdue') return 'Terlambat';
  if (value === 'today') return 'Hari ini';
  if (value === 'soon') return 'Dekat';
  return 'Nanti';
}

function urgencyClass(value: ReturnType<typeof obligationUrgency>) {
  if (value === 'overdue') return 'bg-red-50 text-red-700';
  if (value === 'today') return 'bg-amber-50 text-amber-800';
  if (value === 'soon') return 'bg-[#f4f6ee] text-portal-forest';
  return 'bg-[#f5f6f4] text-portal-soft';
}

export function FinancePlanningWorkspace({
  businessId,
  initialPlan,
  initialObligations,
  entries,
}: Props) {
  const [plan, setPlan] = useState(defaultPlan(initialPlan));
  const [obligations, setObligations] = useState(initialObligations);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [billType, setBillType] = useState('utilities_expense');
  const [billAmount, setBillAmount] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [nextDueOn, setNextDueOn] = useState(today());
  const [accountKey, setAccountKey] = useState('cash');

  const todayValue = today();
  const totalBps = Object.values(plan).reduce((sum, value) => sum + value, 0);
  const liquidCash = useMemo(
    () => entries.reduce((sum, entry) => {
      if (!['cash', 'bank', 'ewallet'].includes(entry.account_key)) return sum;
      const entryAmount = Number(entry.amount);
      if (!Number.isFinite(entryAmount) || entryAmount < 0) return sum;
      return sum + (financeEntryDirection(entry.entry_type) === 'in' ? entryAmount : -entryAmount);
    }, 0),
    [entries],
  );
  const activeObligations = obligations.filter(item => item.active);
  const obligationSummary = summarizeRecurringObligations(
    activeObligations.map(item => ({
      amount: item.amount,
      intervalDays: item.interval_days,
      nextDueOn: item.next_due_on,
      active: item.active,
    })),
    todayValue,
  );
  const dueSoon = activeObligations.filter(item => obligationUrgency(item.next_due_on, todayValue) !== 'later');
  const dueSoonWithoutPayroll = dueSoon
    .filter(item => item.entry_type !== 'payroll_expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const protectedPayroll = dueSoon
    .filter(item => item.entry_type === 'payroll_expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const reserveFloor = Math.max(0, Math.round(liquidCash * plan.reserve_bps / 10_000));
  const safeToSpend = calculateSafeToSpend({
    liquidCash: Math.max(0, liquidCash),
    dueSoonObligations: dueSoonWithoutPayroll,
    reserveFloor,
    protectedPayroll,
  });
  const sortedObligations = [...activeObligations].sort((a, b) =>
    a.next_due_on.localeCompare(b.next_due_on),
  );

  async function reloadFinancePlan() {
    const response = await fetch(`/api/businesses/${businessId}/wave2?kind=finance`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Gagal memuat rencana uang.');
    setPlan(defaultPlan(payload?.data?.plan ?? null));
    setObligations(Array.isArray(payload?.data?.obligations) ? payload.data.obligations : []);
  }

  async function savePlan() {
    if (totalBps > 10_000) {
      setMessage('Total alokasi tidak boleh lebih dari 100%.');
      return;
    }
    setSavingPlan(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/wave2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_finance_plan', ...plan }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan alokasi.');
      await reloadFinancePlan();
      setMessage('Target pembagian tersimpan. Uang nyata belum berpindah sampai ada transaksi.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan alokasi.');
    } finally {
      setSavingPlan(false);
    }
  }

  async function addBill() {
    const parsedAmount = Math.round(Number(billAmount));
    const parsedInterval = Math.round(Number(intervalDays));
    if (!label.trim() || parsedAmount <= 0 || parsedInterval <= 0) {
      setMessage('Isi nama tagihan, nominal, dan jarak hari dengan benar.');
      return;
    }
    setSavingBill(true);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/wave2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_obligation',
          label: label.trim(),
          entry_type: billType,
          account_key: accountKey,
          amount: parsedAmount,
          interval_days: parsedInterval,
          next_due_on: nextDueOn,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menambah tagihan.');
      await reloadFinancePlan();
      setLabel('');
      setBillAmount('');
      setMessage('Tagihan rutin tersimpan. Belum dianggap keluar sampai dibayar.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menambah tagihan.');
    } finally {
      setSavingBill(false);
    }
  }

  async function payBill(obligationId: string) {
    setPayingId(obligationId);
    setMessage('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/wave2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_obligation',
          obligation_id: obligationId,
          paid_on: todayValue,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal mencatat pembayaran.');
      await reloadFinancePlan();
      setMessage('Pembayaran tercatat dan jadwal tagihan berikutnya sudah maju.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal mencatat pembayaran.');
    } finally {
      setPayingId(null);
    }
  }

  const allocationFields = [
    ['owner_payroll_bps', 'Owner'],
    ['staff_payroll_bps', 'Gaji tim'],
    ['working_capital_bps', 'Diputar lagi'],
    ['operations_bps', 'Operasional'],
    ['reserve_bps', 'Cadangan'],
  ] as const;

  return (
    <div className="space-y-3">
      <section className="grid gap-2 sm:grid-cols-3">
        <div className="portal-panel p-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-portal-forest">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-bold">Aman dipakai</p>
          </div>
          <p className="mt-2 text-2xl font-black text-portal-ink">{money.format(safeToSpend)}</p>
          <p className="mt-1 text-[11px] leading-4 text-portal-soft">Sudah menyisihkan tagihan dekat, gaji, dan cadangan.</p>
        </div>
        <div className="portal-panel p-4">
          <WalletCards className="h-4 w-4 text-portal-forest" />
          <p className="mt-2 text-xs font-semibold text-portal-soft">Kas sekarang</p>
          <p className="mt-1 text-xl font-black text-portal-ink">{money.format(liquidCash)}</p>
          <p className="mt-1 text-[11px] text-portal-soft">Kas + bank + e-wallet tercatat.</p>
        </div>
        <div className="portal-panel p-4">
          <CalendarClock className="h-4 w-4 text-portal-forest" />
          <p className="mt-2 text-xs font-semibold text-portal-soft">Tagihan dekat</p>
          <p className="mt-1 text-xl font-black text-portal-ink">{money.format(obligationSummary.dueSoonAmount)}</p>
          <p className="mt-1 text-[11px] text-portal-soft">
            {obligationSummary.dueSoonCount} tagihan ≤14 hari
            {obligationSummary.overdueCount ? ` · ${obligationSummary.overdueCount} terlambat` : ''}
          </p>
        </div>
      </section>

      {activeObligations.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-portal-soft">
          <span>Perkiraan biaya rutin 30 hari <strong className="text-portal-ink">{money.format(obligationSummary.monthlyForecast)}</strong></span>
          {obligationSummary.nextDueOn ? <span>Jadwal terdekat {obligationSummary.nextDueOn}</span> : null}
        </div>
      ) : null}

      <details className="portal-panel group">
        <summary className="cursor-pointer list-none p-4 sm:p-5">
          <span className="font-bold text-portal-ink">Atur pembagian uang</span>
          <span className="ml-2 text-xs font-semibold text-portal-soft">
            {(totalBps / 100).toLocaleString('id-ID')}% direncanakan · {Math.max(0, (10_000 - totalBps) / 100).toLocaleString('id-ID')}% bebas
          </span>
        </summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          <p className="mb-3 text-xs leading-5 text-portal-soft">Ini hanya target pembagian, bukan transaksi otomatis.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {allocationFields.map(([key, labelText]) => (
              <label key={key} className="text-xs font-semibold text-portal-soft">
                {labelText}
                <div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white px-3 py-2.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="min-w-0 flex-1 bg-transparent text-sm text-portal-ink outline-none"
                    value={bpsToPercent(plan[key])}
                    onChange={event => setPlan(current => ({ ...current, [key]: percentToBps(event.target.value) }))}
                  />
                  <span className="text-xs text-portal-soft">%</span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={savePlan} disabled={savingPlan || totalBps > 10_000} className="portal-button-primary disabled:opacity-50">
              {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan target
            </button>
            {totalBps > 10_000 ? <p className="text-xs font-bold text-red-700">Lewat 100%. Kurangi salah satu bagian.</p> : null}
          </div>
        </div>
      </details>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
          <div>
            <p className="font-bold text-portal-ink">Tagihan rutin</p>
            <p className="mt-0.5 text-xs text-portal-soft">Listrik, kios, gaji, bensin, internet, dan biaya berulang lain.</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-portal-soft">{activeObligations.length} aktif</span>
        </div>

        <div className="divide-y divide-portal-line">
          {sortedObligations.length ? sortedObligations.map(item => {
            const urgency = obligationUrgency(item.next_due_on, todayValue);
            return (
              <div key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-portal-ink">{item.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyClass(urgency)}`}>
                      {urgencyLabel(urgency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-portal-soft">
                    {money.format(item.amount)} · tiap {item.interval_days} hari · {item.next_due_on}
                  </p>
                </div>
                <button type="button" onClick={() => payBill(item.id)} disabled={payingId === item.id} className="portal-button-secondary shrink-0 disabled:opacity-50">
                  {payingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sudah dibayar
                </button>
              </div>
            );
          }) : (
            <div className="p-5 text-sm text-portal-soft">Belum ada tagihan rutin. Tambahkan kalau memang ada.</div>
          )}
        </div>

        <details className="border-t border-portal-line">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-portal-ink sm:px-5">
            <Plus className="mr-1.5 inline h-4 w-4" /> Tambah tagihan rutin
          </summary>
          <div className="grid gap-3 border-t border-portal-line bg-[#fafbf9] p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">
            <label className="text-xs font-semibold text-portal-soft">Nama tagihan
              <input value={label} onChange={event => setLabel(event.target.value)} placeholder="Listrik kios" className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Nominal
              <input type="number" min="1" value={billAmount} onChange={event => setBillAmount(event.target.value)} placeholder="20000" className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Berulang tiap
              <div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white pr-3">
                <input type="number" min="1" value={intervalDays} onChange={event => setIntervalDays(event.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-portal-ink outline-none" />
                <span className="text-xs text-portal-soft">hari</span>
              </div>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Kategori
              <select value={billType} onChange={event => setBillType(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">
                <option value="utilities_expense">Listrik / air / internet</option>
                <option value="rent_expense">Sewa kios / tempat</option>
                <option value="payroll_expense">Gaji tim</option>
                <option value="transport_expense">Transport / bensin</option>
                <option value="inventory_expense">Belanja stok</option>
                <option value="other_expense">Pengeluaran lain</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-portal-soft">Jatuh tempo berikutnya
              <input type="date" value={nextDueOn} onChange={event => setNextDueOn(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink" />
            </label>
            <label className="text-xs font-semibold text-portal-soft">Dibayar lewat
              <select value={accountKey} onChange={event => setAccountKey(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">
                <option value="cash">Kas</option>
                <option value="bank">Bank</option>
                <option value="ewallet">E-wallet</option>
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={addBill} disabled={savingBill} className="portal-button-primary disabled:opacity-50">
                {savingBill ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan tagihan
              </button>
              <p className="text-xs text-portal-soft">Belum dianggap uang keluar sampai ditandai dibayar.</p>
            </div>
          </div>
        </details>
      </section>

      {message ? <p className="rounded-xl border border-portal-line bg-white px-4 py-3 text-xs text-portal-soft">{message}</p> : null}
    </div>
  );
}
