'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
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

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink';

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
      setMessage('Isi kas awal minimal Rp0.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = await post({ action: 'open_cash_shift', opening_cash: amount, note });
      setShift(payload?.data?.shift ?? null);
      setLastClosed(null);
      setActualCash('');
      setMessage('Kas dibuka.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuka kas.');
    } finally {
      setSaving(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    const amount = Math.round(Number(actualCash));
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Isi jumlah uang fisik di laci.');
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
      setMessage('Kas ditutup.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menutup kas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="portal-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-bold text-portal-ink">Kas shift</h2>
          <p className="mt-0.5 text-xs text-portal-soft">{shift ? 'Shift sedang berjalan' : 'Buka kas sebelum mulai jualan'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${shift ? 'bg-portal-mist text-portal-forest' : 'bg-[#f5f6f4] text-portal-soft'}`}>
          {shift ? 'Aktif' : 'Belum aktif'}
        </span>
      </div>

      {shift ? (
        <div className="p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4 rounded-xl bg-[#fafbf9] p-3">
            <div>
              <p className="text-xs text-portal-soft">Kas awal</p>
              <p className="mt-1 text-xl font-black text-portal-ink">{money.format(shift.opening_cash)}</p>
            </div>
            <p className="text-right text-[11px] text-portal-soft">Mulai<br /><strong className="text-portal-ink">{new Date(shift.opened_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong></p>
          </div>

          <label className="mt-4 block text-xs font-semibold text-portal-soft">
            Kas fisik saat tutup
            <input type="number" min="0" inputMode="numeric" value={actualCash} onChange={event => setActualCash(event.target.value)} className={`${inputClass} text-base font-bold`} placeholder="Hitung uang di laci" />
          </label>

          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-portal-soft">
              Detail shift <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </summary>
            <label className="mt-3 block text-xs font-semibold text-portal-soft">
              Catatan <span className="font-normal">(opsional)</span>
              <input value={note} onChange={event => setNote(event.target.value)} className={inputClass} placeholder="Misal: uang receh kurang" />
            </label>
          </details>

          <button type="button" onClick={closeShift} disabled={saving} className="portal-button-primary mt-4 w-full justify-center py-3 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Tutup kas
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <label className="block text-xs font-semibold text-portal-soft">
            Kas awal
            <input type="number" min="0" inputMode="numeric" value={openingCash} onChange={event => setOpeningCash(event.target.value)} className={`${inputClass} text-base font-bold`} placeholder="Contoh: 200000" />
          </label>
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-portal-soft">
              Detail shift <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </summary>
            <label className="mt-3 block text-xs font-semibold text-portal-soft">
              Catatan <span className="font-normal">(opsional)</span>
              <input value={note} onChange={event => setNote(event.target.value)} className={inputClass} placeholder="Shift pagi" />
            </label>
          </details>
          <button type="button" onClick={openShift} disabled={saving} className="portal-button-primary mt-4 w-full justify-center py-3 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UnlockKeyhole className="h-4 w-4" />} Buka kas
          </button>
        </div>
      )}

      {lastClosed ? (
        <div className="border-t border-portal-line bg-[#fafbf9] p-4 sm:p-5">
          <p className="text-xs font-bold text-portal-ink">Hasil shift terakhir</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[11px] text-portal-soft">Seharusnya</p><p className="mt-1 text-sm font-bold">{money.format(lastClosed.expected_cash ?? 0)}</p></div>
            <div><p className="text-[11px] text-portal-soft">Fisik</p><p className="mt-1 text-sm font-bold">{money.format(lastClosed.actual_cash ?? 0)}</p></div>
            <div><p className="text-[11px] text-portal-soft">Selisih</p><p className={`mt-1 text-sm font-black ${(lastClosed.variance ?? 0) === 0 ? 'text-portal-forest' : 'text-red-700'}`}>{money.format(lastClosed.variance ?? 0)}</p></div>
          </div>
        </div>
      ) : null}

      {message ? <p role="status" aria-live="polite" className="border-t border-portal-line px-4 py-3 text-xs text-portal-soft sm:px-5">{message}</p> : null}
    </section>
  );
}
