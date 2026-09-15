'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, ShieldCheck, WalletCards } from 'lucide-react';
import type {
  Wave2FinancePlan,
  Wave2Obligation,
} from '@/lib/business-wave2-server';
import {
  obligationUrgency,
  summarizeRecurringObligations,
} from '@/lib/business-control/finance-obligations';
import { jakartaDateKey } from '@/lib/business-control/insights';

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

type FinanceSummary = {
  liquid_cash: number;
  allocated_total: number;
  unallocated_cash: number;
  allocations: Array<{ bucket: string; balance: number }>;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const bucketLabels: Record<string, string> = {
  owner: 'Owner',
  team: 'Gaji tim',
  reinvest: 'Diputar lagi',
  operations: 'Operasional',
  reserve: 'Cadangan',
};

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
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
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

export function FinancePlanningWorkspaceV2({
  businessId,
  initialPlan,
  initialObligations,
}: Props) {
  const [plan, setPlan] = useState(defaultPlan(initialPlan));
  const [obligations, setObligations] = useState(initialObligations);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [billType, setBillType] = useState('utilities_expense');
  const [billAmount, setBillAmount] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [nextDueOn, setNextDueOn] = useState(jakartaDateKey());
  const [accountKey, setAccountKey] = useState('cash');

  const todayValue = jakartaDateKey();
  const totalBps = Object.values(plan).reduce((sum, value) => sum + value, 0);
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
  const dueSoonAmount = activeObligations
    .filter(item => obligationUrgency(item.next_due_on, todayValue) !== 'later')
    .reduce((sum, item) => sum + item.amount, 0);
  const unallocatedCash = Math.max(0, summary?.unallocated_cash ?? 0);
  const freeAfterNearBills = Math.max(0, unallocatedCash - dueSoonAmount);
  const sortedObligations = useMemo(
    () => [...activeObligations].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
    [activeObligations],
  );

  async function reloadFinanceCore() {
    const response = await fetch(`/api/businesses/${businessId}/finance-core/summary`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Gagal memuat saldo authoritative.');
    setSummary(payload?.data?.summary ?? null);
  }

  async function reloadFinancePlan() {
    const response = await fetch(`/api/businesses/${businessId}/wave2?kind=finance`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Gagal memuat rencana uang.');
    setPlan(defaultPlan(payload?.data?.plan ?? null));
    setObligations(Array.isArray(payload?.data?.obligations) ? payload.data.obligations : []);
  }

  useEffect(() => {
    reloadFinanceCore().catch(() => {
      // Page stays usable for planning if the authoritative summary is temporarily unavailable.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function savePlan() {
    if (totalBps > 10_000) {
      setMessage('Total target tidak boleh lebih dari 100%.');
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
      if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan target pembagian.');
      await reloadFinancePlan();
      setMessage('Target persentase tersimpan. Saldo kantong lama tidak berubah.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan target pembagian.');
    } finally {
      setSavingPlan(false);
    }
  }

  async function addBill() {
    const amount = Math.round(Number(billAmount));
    const interval = Math.round(Number(intervalDays));
    if (!label.trim() || amount <= 0 || interval <= 0) {
      setMessage('Isi nama tagihan, nominal, dan interval dengan benar.');
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
          amount,
          interval_days: interval,
          next_due_on: nextDueOn,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal menambah tagihan.');
      await reloadFinancePlan();
      setLabel('');
      setBillAmount('');
      setMessage('Tagihan rutin tersimpan. Belum mengurangi kas sampai dibayar.');
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
      await Promise.all([reloadFinancePlan(), reloadFinanceCore()]);
      setMessage('Pembayaran tercatat. Saldo authoritative sudah dimuat ulang.');
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
      <section className="portal-panel p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-portal-forest"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-bold">Bebas setelah tagihan dekat</p></div>
            <p className="mt-1 text-3xl font-black text-portal-ink">{money.format(freeAfterNearBills)}</p>
            <p className="mt-1 text-[11px] leading-5 text-portal-soft">Dihitung dari uang yang belum masuk kantong, lalu dikurangi tagihan yang jatuh tempo dekat. Saldo kantong terlindungi tidak ikut dianggap bebas.</p>
          </div>
          <div><p className="text-[11px] font-semibold text-portal-soft">Kas authoritative</p><p className="mt-1 text-base font-black text-portal-ink">{summary ? money.format(summary.liquid_cash) : 'Memuat…'}</p></div>
          <div><p className="text-[11px] font-semibold text-portal-soft">Belum dibagi</p><p className="mt-1 text-base font-black text-portal-ink">{summary ? money.format(unallocatedCash) : 'Memuat…'}</p></div>
        </div>
      </section>

      <section className="portal-panel p-4 sm:p-5">
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-portal-forest" /><p className="font-black text-portal-ink">Saldo kantong saat ini</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(summary?.allocations ?? []).map(item => <div key={item.bucket} className="rounded-xl bg-[#f7f9f6] p-3"><p className="text-[10px] font-bold text-portal-soft">{bucketLabels[item.bucket] ?? item.bucket}</p><p className="mt-1 text-sm font-black text-portal-ink">{money.format(item.balance)}</p></div>)}
        </div>
        <p className="mt-3 text-[11px] text-portal-soft">Persentase di bawah hanya target pembagian ke depan. Memindahkan nominal dilakukan dari tab Aktivitas → Kantong uang nyata.</p>
      </section>

      {activeObligations.length ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-portal-soft"><span>Perkiraan biaya rutin 30 hari <strong className="text-portal-ink">{money.format(obligationSummary.monthlyForecast)}</strong></span><span>Tagihan dekat <strong className="text-portal-ink">{money.format(dueSoonAmount)}</strong></span>{obligationSummary.nextDueOn ? <span>Jadwal terdekat {obligationSummary.nextDueOn}</span> : null}</div> : null}

      <section className="portal-panel p-4 sm:p-5">
        <div><p className="font-bold text-portal-ink">Target pembagian uang baru</p><p className="mt-1 text-xs text-portal-soft">Mengubah target tidak mengubah saldo kantong yang sudah terkumpul.</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {allocationFields.map(([key, labelText]) => <label key={key} className="text-xs font-semibold text-portal-soft">{labelText}<div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white px-3 py-2.5"><input type="number" min="0" max="100" step="0.5" className="min-w-0 flex-1 bg-transparent text-sm text-portal-ink outline-none" value={bpsToPercent(plan[key])} onChange={event => setPlan(current => ({ ...current, [key]: percentToBps(event.target.value) }))} /><span className="text-xs text-portal-soft">%</span></div></label>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={savePlan} disabled={savingPlan || totalBps > 10_000} className="portal-button-primary disabled:opacity-50">{savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan target</button><span className={`text-xs font-bold ${totalBps > 10_000 ? 'text-red-700' : 'text-portal-soft'}`}>{(totalBps / 100).toLocaleString('id-ID')}% direncanakan · {Math.max(0, (10_000 - totalBps) / 100).toLocaleString('id-ID')}% bebas</span></div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5"><div><p className="font-bold text-portal-ink">Tagihan rutin</p><p className="mt-0.5 text-xs text-portal-soft">Listrik, kios, gaji, bensin, internet, dan biaya berulang lain.</p></div><span className="shrink-0 text-xs font-bold text-portal-soft">{activeObligations.length} aktif</span></div>
        <div className="divide-y divide-portal-line">{sortedObligations.length ? sortedObligations.map(item => { const urgency = obligationUrgency(item.next_due_on, todayValue); return <div key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-portal-ink">{item.label}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyClass(urgency)}`}>{urgencyLabel(urgency)}</span></div><p className="mt-1 text-xs text-portal-soft">{money.format(item.amount)} · tiap {item.interval_days} hari · {item.next_due_on}</p></div><button type="button" onClick={() => payBill(item.id)} disabled={payingId === item.id} className="portal-button-secondary shrink-0 disabled:opacity-50">{payingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Tandai dibayar</button></div>; }) : <div className="p-5 text-sm text-portal-soft">Belum ada tagihan rutin.</div>}</div>
      </section>

      <details className="portal-panel group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 sm:p-5"><span className="font-bold text-portal-ink">Tambah tagihan rutin</span><Plus className="h-4 w-4 text-portal-soft" /></summary>
        <div className="border-t border-portal-line p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-semibold text-portal-soft">Nama tagihan<input value={label} onChange={event => setLabel(event.target.value)} placeholder="Contoh: Sewa kios" className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Kategori<select value={billType} onChange={event => setBillType(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3"><option value="payroll_expense">Gaji</option><option value="rent_expense">Sewa</option><option value="utilities_expense">Utilitas</option><option value="transport_expense">Transport</option><option value="marketing_expense">Promosi</option><option value="other_expense">Lainnya</option></select></label><label className="text-xs font-semibold text-portal-soft">Nominal<input type="number" min="1" value={billAmount} onChange={event => setBillAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Tiap berapa hari<input type="number" min="1" value={intervalDays} onChange={event => setIntervalDays(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Jatuh tempo berikutnya<input type="date" value={nextDueOn} onChange={event => setNextDueOn(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3" /></label><label className="text-xs font-semibold text-portal-soft">Bayar lewat<select value={accountKey} onChange={event => setAccountKey(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-portal-line bg-white px-3"><option value="cash">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option></select></label></div><button type="button" onClick={addBill} disabled={savingBill} className="portal-button-primary mt-3 disabled:opacity-50">{savingBill ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah tagihan</button></div>
      </details>

      {message ? <div role="status" className="rounded-xl border border-portal-line bg-white px-4 py-3 text-xs font-semibold text-portal-soft">{message}</div> : null}
    </div>
  );
}
