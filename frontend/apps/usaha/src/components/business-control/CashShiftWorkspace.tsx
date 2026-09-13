'use client';

import { useState } from 'react';
import { Loader2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import type { Wave2CashShift } from '@/lib/business-wave2-server';

type Props = {
  businessId: string;
  initialShift: Wave2CashShift | null;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function CashShiftWorkspace({ businessId, initialShift }: Props) {
  const [shift, setShift] = useState(initialShift);
  const [lastClosed, setLastClosed] = useState<Wave2CashShift | null>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function post(input: Record<string, unknown>) {
    const response = await fetch(`/api/businesses/${businessId}/wave2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan shift kas.');
    return payload;
  }

  async function openShift() {
    const amount = Math.round(Number(openingCash));
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Isi modal kas awal minimal Rp0.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = await post({ action: 'open_cash_shift', opening_cash: amount, note });
      setShift(payload?.data?.shift ?? null);
      setLastClosed(null);
      setActualCash('');
      setMessage('Shift kas dibuka. Penjualan tunai setelah waktu ini masuk perhitungan penutupan kas.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuka shift kas.');
    } finally {
      setSaving(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    const amount = Math.round(Number(actualCash));
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Hitung uang fisik lalu isi jumlah aktual minimal Rp0.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = await post({
        action: 'close_cash_shift',
        shift_id: shift.id,
        actual_cash: amount,
        note,
      });
      const closed = (payload?.data?.shift ?? null) as Wave2CashShift | null;
      setLastClosed(closed);
      setShift(null);
      setOpeningCash('');
      setActualCash('');
      setNote('');
      setMessage('Shift kas ditutup. Selisih disimpan sebagai hasil rekonsiliasi, bukan disembunyikan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menutup shift kas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-portal-ink">Kas shift</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Kasir tidak melihat HPP/laba. Yang dicek hanya kas awal, kas seharusnya, kas fisik, dan selisih.</p>
        </div>
        <span className="rounded-full border border-portal-line px-3 py-1 text-xs font-semibold text-portal-soft">{shift ? 'Shift aktif' : 'Belum aktif'}</span>
      </div>

      {shift ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-portal-line p-3"><p className="text-xs text-portal-soft">Kas awal</p><p className="mt-1 font-bold text-portal-ink">{money.format(shift.opening_cash)}</p></div>
          <div className="rounded-xl border border-portal-line p-3 sm:col-span-1 xl:col-span-3"><p className="text-xs text-portal-soft">Dibuka</p><p className="mt-1 text-sm font-bold text-portal-ink">{new Date(shift.opened_at).toLocaleString('id-ID')}</p></div>
          <label className="text-xs font-semibold text-portal-soft sm:col-span-1 xl:col-span-2">Kas fisik saat tutup
            <input type="number" min="0" value={actualCash} onChange={event => setActualCash(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Hitung uang di laci" />
          </label>
          <label className="text-xs font-semibold text-portal-soft sm:col-span-1 xl:col-span-2">Catatan <span className="font-normal">(opsional)</span>
            <input value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Misal: uang receh kurang" />
          </label>
          <div className="sm:col-span-2 xl:col-span-4"><button type="button" onClick={closeShift} disabled={saving} className="portal-button-primary disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Tutup kas</button></div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-portal-soft">Kas awal
            <input type="number" min="0" value={openingCash} onChange={event => setOpeningCash(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Contoh: 200000" />
          </label>
          <label className="text-xs font-semibold text-portal-soft">Catatan <span className="font-normal">(opsional)</span>
            <input value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" placeholder="Shift pagi" />
          </label>
          <div className="sm:col-span-2"><button type="button" onClick={openShift} disabled={saving} className="portal-button-secondary disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UnlockKeyhole className="h-4 w-4" />} Buka kas</button></div>
        </div>
      )}

      {lastClosed ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-portal-line p-3"><p className="text-xs text-portal-soft">Seharusnya</p><p className="mt-1 font-bold text-portal-ink">{money.format(lastClosed.expected_cash ?? 0)}</p></div>
          <div className="rounded-xl border border-portal-line p-3"><p className="text-xs text-portal-soft">Fisik</p><p className="mt-1 font-bold text-portal-ink">{money.format(lastClosed.actual_cash ?? 0)}</p></div>
          <div className="rounded-xl border border-portal-line p-3"><p className="text-xs text-portal-soft">Selisih</p><p className={`mt-1 font-bold ${(lastClosed.variance ?? 0) === 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(lastClosed.variance ?? 0)}</p></div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs leading-5 text-portal-soft">{message}</p> : null}
    </div>
  );
}
