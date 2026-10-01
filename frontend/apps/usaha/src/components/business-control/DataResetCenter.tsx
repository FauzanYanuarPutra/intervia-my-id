'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, DatabaseBackup, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import type { BusinessResetPreview, BusinessResetScope, BusinessResetBatch } from '@/lib/business-reset-types';
import type { BusinessRecord } from '@/lib/portal-types';
import { idempotencyFingerprint, resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';

type Props = {
  business: BusinessRecord;
};

type ScopeCard = {
  id: BusinessResetScope;
  title: string;
  description: string;
  countKey: keyof BusinessResetPreview['counts'];
  allowed: boolean;
};

class BusinessResetClientError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function canByRole(business: BusinessRecord, scope: BusinessResetScope) {
  switch (scope) {
    case 'finance_activity':
    case 'owner_capital':
      return ['owner', 'manager', 'accounting'].includes(business.currentRole);
    case 'sales_transactions':
    case 'products':
      return ['owner', 'manager'].includes(business.currentRole);
    case 'inventory':
      return ['owner', 'manager', 'inventory'].includes(business.currentRole);
    default:
      return false;
  }
}

function canStartFresh(business: BusinessRecord) {
  return business.currentRole === 'owner';
}

export function DataResetCenter({ business }: Props) {
  const [selected, setSelected] = useState<BusinessResetScope[]>([]);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const router = useRouter();
  const [effectiveOn, setEffectiveOn] = useState('');
  const [preview, setPreview] = useState<BusinessResetPreview | null>(null);
  const [lastResult, setLastResult] = useState<BusinessResetBatch | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const attemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  const scopes = useMemo<ScopeCard[]>(
    () => [
      {
        id: 'finance_activity',
        title: 'Aktivitas uang',
        description: 'Batalkan dampak catatan pemasukan/pengeluaran manual yang boleh dikoreksi. Histori tetap tersimpan.',
        countKey: 'finance_activity',
        allowed: canByRole(business, 'finance_activity'),
      },
      {
        id: 'owner_capital',
        title: 'Modal pemilik',
        description: 'Balikkan catatan modal masuk dan pengambilan pemilik. Ini tidak menghapus profil usaha.',
        countKey: 'owner_capital',
        allowed: canByRole(business, 'owner_capital'),
      },
      {
        id: 'sales_transactions',
        title: 'Transaksi penjualan manual',
        description: 'Void transaksi penjualan manual yang masih bisa dikoreksi. Stok dan uang ikut dibalik lewat flow transaksi.',
        countKey: 'sales_transactions',
        allowed: canByRole(business, 'sales_transactions'),
      },
      {
        id: 'inventory',
        title: 'Stok & bahan',
        description: 'Set stok aktif menjadi 0 sambil menulis bukti penyesuaian stok. Histori mutasi tidak dihapus.',
        countKey: 'inventory_product_records',
        allowed: canByRole(business, 'inventory'),
      },
      {
        id: 'products',
        title: 'Produk & resep',
        description: 'Arsipkan produk aktif dan pensiunkan resep aktif. Histori produk lama tetap aman.',
        countKey: 'active_products',
        allowed: canByRole(business, 'products'),
      },
    ],
    [business],
  );

  const allAvailableSelected =
    scopes.every(scope => !scope.allowed || selected.includes(scope.id)) &&
    scopes.some(scope => scope.allowed) &&
    scopes.filter(scope => scope.allowed).every(scope => selected.includes(scope.id));

  const fullResetAvailable =
    canStartFresh(business) && scopes.every(scope => scope.allowed);

  function toggleScope(scope: BusinessResetScope) {
    setPreview(null);
    setPreviewFingerprint(null);
    setLastResult(null);
    setError(null);
    setSelected(current =>
      current.includes(scope)
        ? current.filter(item => item !== scope)
        : [...current, scope],
    );
  }

  function selectAll() {
    setPreview(null);
    setPreviewFingerprint(null);
    setLastResult(null);
    setError(null);
    setSelected(scopes.filter(scope => scope.allowed).map(scope => scope.id));
  }

  function clearSelection() {
    setPreview(null);
    setPreviewFingerprint(null);
    setLastResult(null);
    setError(null);
    setSelected([]);
    setConfirmation('');
  }

  function buildPayload() {
    return {
      scopes: selected,
      reason: reason.trim(),
      confirmation: confirmation.trim(),
      effective_on: effectiveOn || undefined,
    };
  }

  const resetMaterialFingerprint = idempotencyFingerprint({
    scopes: selected,
    reason: reason.trim(),
    effective_on: effectiveOn || null,
  });

  async function doPreview() {
    setBusy('preview');
    setError(null);
    try {
      const materialPayload = {
        scopes: selected,
        reason: reason.trim(),
        effective_on: effectiveOn || undefined,
      };
      const attempt = resolveIdempotencyAttempt(attemptRef.current, materialPayload);
      attemptRef.current = attempt;
      const result = await fetch('/api/businesses/' + encodeURIComponent(business.id) + '/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', ...buildPayload() }),
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok) throw new BusinessResetClientError(payload?.error || 'preview_failed');
      setPreview(payload.data as BusinessResetPreview);
      setPreviewFingerprint(resetMaterialFingerprint);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak bisa memuat preview reset.');
    } finally {
      setBusy(null);
    }
  }

  async function applyReset() {
    if (!preview?.can_apply || !selected.length) return;
    if (previewFingerprint !== resetMaterialFingerprint) {
      setPreview(null);
      setPreviewFingerprint(null);
      setError('Data reset berubah sejak preview terakhir. Tinjau ulang sebelum menjalankan reset.');
      return;
    }
    setBusy('apply');
    setError(null);
    try {
      const materialPayload = {
        scopes: selected,
        reason: reason.trim(),
        effective_on: effectiveOn || undefined,
      };
      const attempt = resolveIdempotencyAttempt(attemptRef.current, materialPayload);
      attemptRef.current = attempt;
      const result = await fetch('/api/businesses/' + encodeURIComponent(business.id) + '/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': attempt.key,
        },
        body: JSON.stringify({ action: 'apply', ...buildPayload() }),
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok) throw new BusinessResetClientError(payload?.error || 'reset_failed');
      setLastResult(payload.data as BusinessResetBatch);
      setPreview(null);
      setPreviewFingerprint(null);
      attemptRef.current = null;
      router.refresh();
    } catch (cause) {
      const code = cause instanceof BusinessResetClientError ? cause.code : 'reset_failed';
      const messages: Record<string, string> = {
        sales_in_closed_period: 'Ada transaksi pada hari/periode yang sudah ditutup. Buka periode tersebut dulu.',
        business_data_reset_permission_denied: 'Peranmu tidak punya izin untuk salah satu reset yang dipilih.',
        business_start_fresh_permission_denied: 'Mulai dari nol hanya boleh dilakukan pemilik usaha.',
        reset_full_confirmation_required: 'Untuk reset lengkap, ketik persis: MULAI DARI NOL.',
        reset_confirmation_required: 'Isi konfirmasi sebelum menjalankan reset.',
        reset_confirmation_invalid: 'Untuk reset sebagian, ketik persis: RESET.',
        reset_idempotency_conflict: 'Permintaan reset dengan kunci yang sama tetapi isi berbeda ditolak.',
      };
      setError(messages[code] ?? (cause instanceof Error ? cause.message : 'Reset gagal.'));
    } finally {
      setBusy(null);
    }
  }

  const selectedCount = selected.length;
  const blocked = scopes.filter(scope => selected.includes(scope.id) && !scope.allowed);
  const isFull = scopes.length > 0 && scopes.every(scope => selected.includes(scope.id));
  const fullPhraseRequired = isFull;
  const effectiveReason = reason.trim().length >= 3;
  const canPreview = selectedCount > 0 && effectiveReason && blocked.length === 0 && !(isFull && !fullResetAvailable);
  const requiredConfirmation = fullPhraseRequired ? 'MULAI DARI NOL' : 'RESET';
  const fullResetBlocked = isFull && !fullResetAvailable;
  const canApply = Boolean(preview?.can_apply) && canPreview && !fullResetBlocked && previewFingerprint === resetMaterialFingerprint && confirmation.trim() === requiredConfirmation;

  return (
    <div className="space-y-4">
      <section className="merchant-surface-bordered overflow-hidden">
        <div className="border-b border-portal-line/70 bg-[#f8faf7] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <DatabaseBackup className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Pemulihan data usaha</p>
              <h1 className="mt-1 text-lg font-black tracking-tight text-portal-ink sm:text-xl">Reset sebagian atau mulai dari nol</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-portal-soft">
                Reset di sini tidak menghapus audit, profil usaha, atau histori. Sistem membuat koreksi/penyesuaian supaya angka operasional kembali bersih.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {scopes.map(scope => {
              const selectedItem = selected.includes(scope.id);
              const count = preview?.counts?.[scope.countKey] ?? null;
              return (
                <button
                  key={scope.id}
                  type="button"
                  disabled={!scope.allowed || busy !== null}
                  onClick={() => scope.allowed && toggleScope(scope.id)}
                  className={[
                    'text-left rounded-xl border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/25',
                    selectedItem ? 'border-portal-forest bg-portal-mist/40' : 'border-portal-line bg-white hover:bg-[#f7f9f6]',
                    !scope.allowed ? 'cursor-not-allowed opacity-45' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <span className={'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ' + (selectedItem ? 'border-portal-forest bg-portal-forest text-white' : 'border-slate-300 bg-white')}>
                      {selectedItem ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-portal-ink">{scope.title}</p>
                        {count !== null ? <span className="text-xs font-black text-portal-forest">{count.toLocaleString('id-ID')}</span> : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-portal-soft">{scope.description}</p>
                      {!scope.allowed ? (
                        <p className="mt-2 text-[11px] font-semibold text-rose-600">Tidak tersedia untuk peran ini.</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="portal-button-secondary" onClick={selectAll} disabled={busy !== null || !scopes.some(scope => scope.allowed)}>
              {allAvailableSelected ? 'Semua dipilih' : 'Pilih semua yang boleh'}
            </button>
            {fullResetAvailable ? (
              <button type="button" className="portal-button-ghost" onClick={selectAll} disabled={busy !== null}>
                <RotateCcw className="h-4 w-4" /> Mulai dari nol
              </button>
            ) : null}
            <button type="button" className="portal-button-ghost" onClick={clearSelection} disabled={busy !== null || !selected.length}>
              Bersihkan pilihan
            </button>
          </div>
        </div>
      </section>

      {selectedCount ? (
        <section className="merchant-surface-bordered p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_0.7fr]">
            <label className="block">
              <span className="text-xs font-black text-portal-ink">Kenapa perlu di-reset?</span>
              <textarea
                value={reason}
                onChange={event => {
                  setReason(event.target.value);
                  setLastResult(null);
                  setPreview(null);
                  setPreviewFingerprint(null);
                }}
                disabled={busy !== null}
                rows={4}
                maxLength={2000}
                placeholder="Contoh: data latihan selesai dan usaha mau mulai pencatatan resmi."
                className="portal-input mt-2 min-h-28 w-full resize-y"
              />
            </label>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-black text-portal-ink">Mulai berlaku sejak</span>
                <input
                  type="date"
                  value={effectiveOn}
                  onChange={event => {
                    setEffectiveOn(event.target.value);
                    setLastResult(null);
                    setPreview(null);
                    setPreviewFingerprint(null);
                  }}
                  disabled={busy !== null}
                  className="portal-input mt-2 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black text-portal-ink">
                  {fullPhraseRequired ? 'Konfirmasi reset lengkap' : 'Konfirmasi reset'}
                </span>
                <input
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  disabled={busy !== null}
                  placeholder={fullPhraseRequired ? 'Ketik: MULAI DARI NOL' : 'Ketik: RESET'}
                  className="portal-input mt-2 w-full"
                />
              </label>
            </div>
          </div>

          {fullResetBlocked ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
              <strong>Reset semua bagian sekaligus hanya boleh dilakukan Owner.</strong> Kurangi pilihan scope atau minta Owner menjalankan “Mulai dari nol”.
            </div>
          ) : null}

          {fullPhraseRequired && fullResetAvailable ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <div className="flex gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                <p><strong>Reset lengkap bersifat sensitif.</strong> Hanya Owner yang boleh menjalankan semua lingkup sekaligus. Ketik <strong>MULAI DARI NOL</strong> persis.</p>
              </div>
            </div>
          ) : null}

          {preview ? (
            <div className="mt-4 rounded-xl border border-portal-line bg-[#f8faf7] p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />
                <div>
                  <p className="font-black text-portal-ink">Preview reset</p>
                  <p className="mt-0.5 text-xs text-portal-soft">{preview.labels.join(' · ')}</p>
                </div>
              </div>
              {preview.warnings.length ? (
                <div className="mt-3 space-y-2">
                  {preview.warnings.map((warning, index) => (
                    <p key={index} className="flex gap-2 text-xs leading-5 text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{warning}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-portal-soft">Tidak ada peringatan tambahan dari data saat ini.</p>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">
              {error}
            </div>
          ) : null}

          {lastResult ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-black">Reset tercatat</p>
                  <p className="mt-0.5">ID batch: {lastResult.id}</p>
                  <p>Status: {lastResult.status}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="portal-button-secondary" disabled={!canPreview || busy !== null} onClick={() => void doPreview()}>
              {busy === 'preview' ? 'Memeriksa…' : 'Tinjau dulu'}
            </button>
            <button type="button" className="portal-button-primary" disabled={!canApply || busy !== null} onClick={() => void applyReset()}>
              {busy === 'apply' ? 'Menjalankan…' : 'Jalankan reset'}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-portal-soft">
            Reset tidak menghapus histori. Transaksi manual memakai flow void/koreksi yang sudah ada; order terhubung dan periode yang sudah ditutup tetap dilindungi.
          </p>
        </section>
      ) : (
        <section className="merchant-surface-bordered p-4 sm:p-5">
          <p className="text-sm font-black text-portal-ink">Pilih apa yang memang perlu dimulai ulang.</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">
            Kamu bisa mereset hanya modal, hanya stok, hanya transaksi, atau beberapa bagian sekaligus. Tidak perlu mengulang seluruh usaha kalau masalahnya cuma satu area.
          </p>
        </section>
      )}

      <section className="merchant-surface-bordered p-4 sm:p-5">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-portal-mist text-portal-forest">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="font-black text-portal-ink">Yang tidak disentuh</p>
            <p className="mt-1 text-xs leading-5 text-portal-soft">
              Profil usaha, anggota tim, hak akses, audit trail, histori koreksi, data publik, order/pesanan terhubung, settlement, dan bukti transaksi lama tetap dipertahankan. Tujuannya merapikan keadaan operasional, bukan menghilangkan jejak.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
