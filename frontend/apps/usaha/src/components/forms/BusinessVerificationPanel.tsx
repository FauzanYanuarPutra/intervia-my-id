'use client';

import { useState } from 'react';
import { BadgeCheck, CheckCircle2, ShieldCheck } from 'lucide-react';

type Props = {
  businessId: string;
  ready: boolean;
  checks: {
    profile: boolean;
    image: boolean;
    contact: boolean;
    location: boolean;
  };
  status: string;
  reviewReason: string | null;
};

export function BusinessVerificationPanel({
  businessId,
  ready,
  checks,
  status,
  reviewReason,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(status === 'pending');
  const [error, setError] = useState('');

  async function requestVerification() {
    if (!ready || busy || requested) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/verification/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || payload.message || 'Pengajuan verifikasi gagal.'));
      setRequested(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Pengajuan verifikasi gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="merchant-surface-bordered border-sky-200 bg-sky-50/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="portal-icon-tile bg-white text-sky-700">
          <BadgeCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-portal-ink">Verifikasi Lajukan</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">
            Setelah profil, foto/logo, kontak, dan lokasi lengkap, kamu bisa mengajukan verifikasi untuk diperiksa tim Lajukan.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ['Profil', checks.profile],
          ['Foto/logo', checks.image],
          ['Kontak', checks.contact],
          ['Lokasi', checks.location],
        ].map(([label, done]) => (
          <div key={String(label)} className="rounded-xl border border-sky-100 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <CheckCircle2 className={done ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-slate-300'} />
              {String(label)}
            </div>
          </div>
        ))}
      </div>

      {!ready ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Lengkapi profil dan foto/logo terlebih dahulu. Setelah lengkap, tombol pengajuan akan aktif.
        </div>
      ) : null}

      {status === 'verified' ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-800">
          Usaha sudah terverifikasi oleh tim Lajukan.
        </div>
      ) : requested || status === 'pending' ? (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-800">
          Pengajuan verifikasi sedang menunggu pemeriksaan tim Lajukan.
        </div>
      ) : status === 'rejected' ? (
        <>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
            Verifikasi sebelumnya belum disetujui. Perbaiki data atau bukti yang diminta, lalu ajukan kembali.
            {reviewReason ? <span className="mt-1 block font-medium">Catatan pemeriksaan: {reviewReason}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => void requestVerification()}
            disabled={!ready || busy}
            className="portal-button-primary mt-4 w-full sm:w-fit disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShieldCheck className="h-4 w-4" />
            {busy ? 'Mengirim pengajuan...' : 'Ajukan ulang verifikasi'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void requestVerification()}
          disabled={!ready || busy}
          className="portal-button-primary mt-4 w-full sm:w-fit disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ShieldCheck className="h-4 w-4" />
          {busy ? 'Mengirim pengajuan...' : 'Ajukan verifikasi usaha'}
        </button>
      )}

      {error ? <p role="alert" className="mt-3 text-xs font-semibold text-portal-ember">{error}</p> : null}
    </section>
  );
}
