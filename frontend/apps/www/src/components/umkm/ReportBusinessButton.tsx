'use client';

import { Flag, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const REASONS = [
  ['inaccurate_information', 'Informasi usaha tidak akurat'],
  ['not_found', 'Usaha/lokasi sudah tidak ditemukan'],
  ['duplicate_business', 'Data usaha duplikat'],
  ['fraud_misleading', 'Informasi berpotensi menyesatkan'],
  ['policy_violation', 'Tidak sesuai kebijakan Lajukan'],
  ['privacy_personal_data', 'Mengandung data pribadi yang tidak perlu'],
  ['copyright', 'Masalah hak cipta pada media'],
  ['other', 'Lainnya'],
] as const;

type Props = {
  locale: string;
  storeRef: string;
};

export function ReportBusinessButton({ locale, storeRef }: Props) {
  const { isAuthenticated } = useAuth();
  const isId = locale === 'id';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>('inaccurate_information');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setStatus('');
  }

  async function submit() {
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/umkm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_ref: storeRef,
          reason_code: reason,
          details: details.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setStatus(
            isId
              ? 'Silakan masuk dulu untuk mengirim laporan.'
              : 'Please sign in before sending a report.',
          );
        } else {
          setStatus(payload.error || (isId ? 'Laporan belum berhasil dikirim.' : 'The report could not be submitted.'));
        }
        return;
      }
      setStatus(
        isId
          ? 'Laporan sudah diterima. Tim Lajukan akan meninjaunya.'
          : 'Your report was received. The Lajukan team will review it.',
      );
      setDetails('');
    } catch {
      setStatus(
        isId
          ? 'Koneksi bermasalah. Coba lagi.'
          : 'Connection problem. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <a
        href={`/${locale}/login?next=/${locale}/toko/${encodeURIComponent(storeRef)}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Flag className="h-3.5 w-3.5" />
        {isId ? 'Laporkan' : 'Report'}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Flag className="h-3.5 w-3.5" />
        {isId ? 'Laporkan' : 'Report'}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">
                  {isId ? 'Laporkan usaha' : 'Report business'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                  {isId ? 'Apa yang perlu diperiksa?' : 'What should we review?'}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={isId ? 'Tutup' : 'Close'}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {REASONS.map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <input
                    type="radio"
                    name="business-report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="mt-1"
                  />
                  <span>{isId ? label : label === 'Informasi usaha tidak akurat' ? 'Business information is inaccurate' : label}</span>
                </label>
              ))}
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-900 dark:text-white">
              {isId ? 'Detail tambahan (opsional)' : 'Additional details (optional)'}
              <textarea
                value={details}
                onChange={event => setDetails(event.target.value)}
                rows={4}
                maxLength={4000}
                className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-400 dark:border-slate-700 dark:bg-slate-950"
                placeholder={isId ? 'Jelaskan singkat agar tim mudah memeriksa.' : 'Add a short explanation to help the review.'}
              />
            </label>

            {status ? (
              <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {status}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {isId ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                {isId ? 'Kirim laporan' : 'Send report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
