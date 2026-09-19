'use client';

import { useMemo, useState } from 'react';

type ModerationAction = 'restore' | 'review' | 'hide' | 'ban';

type Draft = {
  listing: { id: string; title: string; reportCount: number };
  action: ModerationAction;
} | null;

const REASONS = [
  ['legal_violation', 'Melanggar hukum/peraturan'],
  ['fraud_misleading', 'Penipuan atau informasi menyesatkan'],
  ['spam', 'Spam'],
  ['unverifiable_information', 'Informasi tidak dapat diverifikasi'],
  ['copyright', 'Hak cipta'],
  ['prohibited_goods_services', 'Barang/jasa terlarang'],
  ['privacy_personal_data', 'Privasi/data pribadi'],
  ['child_safety', 'Keamanan anak'],
  ['harassment_discrimination', 'Pelecehan/diskriminasi'],
  ['sexual_pornographic', 'Konten seksual/pornografi'],
  ['violence_threat', 'Kekerasan/ancaman'],
  ['quality', 'Kualitas/tidak sesuai kategori'],
  ['other', 'Lainnya'],
] as const;

const ACTIONS: Record<ModerationAction, { title: string; backend: string; destructive: boolean }> = {
  restore: { title: 'Pulihkan listing', backend: 'restore', destructive: false },
  review: { title: 'Minta revisi', backend: 'needs_revision', destructive: false },
  hide: { title: 'Sembunyikan sementara', backend: 'restrict', destructive: true },
  ban: { title: 'Hapus dari publik', backend: 'remove', destructive: true },
};

export default function ModerationDecisionDialog({
  draft,
  onClose,
  onConfirm,
  busy,
}: {
  draft: Draft;
  onClose: () => void;
  onConfirm: (input: {
    action: string;
    reasonCode: string;
    reasonNote: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }) => void;
  busy: boolean;
}) {
  const [reasonCode, setReasonCode] = useState('quality');
  const [reasonNote, setReasonNote] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const reasonRequired = useMemo(
    () => draft?.action !== 'restore' || reasonCode === 'other',
    [draft?.action, reasonCode],
  );

  if (!draft) return null;
  const action = ACTIONS[draft.action];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Keputusan moderasi</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{action.title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{draft.listing.title}</p>
            <p className="mt-1 text-xs text-slate-500">{draft.listing.reportCount} laporan terkait.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
            Tutup
          </button>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-950">Alasan keputusan</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {REASONS.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 p-3 text-xs font-semibold">
                <input type="radio" name="moderation-reason" checked={reasonCode === value} onChange={() => setReasonCode(value)} className="mt-0.5" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-bold text-slate-950">
            Catatan {reasonRequired ? '(wajib)' : '(opsional)'}
            <textarea
              value={reasonNote}
              onChange={event => setReasonNote(event.target.value)}
              maxLength={4000}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-400"
              placeholder="Jelaskan keputusan secara singkat, faktual, dan dapat diaudit."
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">Hindari menuliskan data pribadi yang tidak diperlukan.</p>
        </div>

        <div className="mt-4">
          <p className="text-sm font-bold text-slate-950">Severity</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['low', 'medium', 'high', 'critical'] as const).map(value => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">
                <input type="radio" name="moderation-severity" checked={severity === value} onChange={() => setSeverity(value)} />
                {value}
              </label>
            ))}
          </div>
        </div>

        {action.destructive ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold leading-5 text-amber-800">
            Tindakan ini membatasi atau menghapus konten dari publik. Ini bukan pemblokiran akun pengguna.
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
            Batal
          </button>
          <button
            type="button"
            disabled={busy || (reasonRequired && !reasonNote.trim())}
            onClick={() =>
              onConfirm({
                action: action.backend,
                reasonCode,
                reasonNote: reasonNote.trim(),
                severity,
              })
            }
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Menyimpan...' : 'Simpan keputusan'}
          </button>
        </div>
      </div>
    </div>
  );
}
