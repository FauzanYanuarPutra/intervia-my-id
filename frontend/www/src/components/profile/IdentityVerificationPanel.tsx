'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  type IdentityVerificationRecord,
  readIdentityVerification,
} from '@/lib/identityVerification';

type Props = {
  verificationSource?: unknown;
  onRefresh?: () => Promise<void> | void;
};

type DocumentPreview = {
  document_type?: string;
  document_country?: string;
  document_name?: string;
  nik_masked?: string;
  ttl?: string;
};

function kycLabel(status: IdentityVerificationRecord['kyc_status'] | undefined) {
  if (status === 'enhanced') return 'Enhanced';
  if (status === 'full') return 'Full';
  if (status === 'basic') return 'Basic';
  return 'None';
}

function statusText(record: IdentityVerificationRecord | null) {
  if (!record) return 'Belum ada verifikasi identitas.';
  if (record.status === 'approved') {
    return 'Identitas siap dipakai untuk trust badge, transaksi, dan review yang lebih cepat.';
  }
  if (record.status === 'manual_review') {
    return 'Bukti identitas sudah masuk, tetapi masih perlu review manual.';
  }
  return 'Capture terakhir belum cukup kuat. Silakan unggah ulang dengan foto lebih jelas.';
}

function formatWhen(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScore(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value)} / 100`;
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

export function IdentityVerificationPanel({
  verificationSource,
  onRefresh,
}: Props) {
  const { authFetch } = useAuth();
  const existingRecord = useMemo(
    () => readIdentityVerification(verificationSource),
    [verificationSource],
  );
  const [currentRecord, setCurrentRecord] =
    useState<IdentityVerificationRecord | null>(null);
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | null>(
    null,
  );
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeRecord = currentRecord || existingRecord;
  const proofItems = [
    {
      label: 'Phone',
      ok: activeRecord?.phone_verified,
    },
    {
      label: 'KTP OCR',
      ok: activeRecord?.document_verified,
    },
    {
      label: 'Liveness',
      ok: activeRecord?.liveness_verified,
    },
  ];

  const benefits =
    activeRecord?.benefits && activeRecord.benefits.length > 0
      ? activeRecord.benefits
      : [
          'Membantu akun lebih dipercaya di transaksi dan chat.',
          'Mempercepat review support saat sengketa atau high-risk order.',
          'Menjadi pondasi untuk onboarding usaha, driver flow, dan compliance trail.',
        ];

  const handleSubmit = async () => {
    if (!ktpFile || !selfieFile) {
      setMessage('Upload KTP dan selfie terlebih dulu.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set('ktp', ktpFile);
      formData.set('selfie', selfieFile);

      const res = await authFetch('/api/auth/identity-verification', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!res.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            'Verifikasi identitas gagal',
        );
      }

      setCurrentRecord(readIdentityVerification(data.verification) || null);
      setDocumentPreview(
        ((data.ai as Record<string, unknown> | undefined)
          ?.document_preview || null) as DocumentPreview | null,
      );
      setMessage(
        (typeof data.message === 'string' && data.message) ||
          'Verifikasi identitas berhasil diproses',
      );
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Verifikasi identitas gagal diproses',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="overflow-x-hidden rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm sm:shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] dark:border-[color:var(--app-border-strong)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            Trust & Verification
          </h2>
          <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
            Nomor HP terverifikasi jadi fondasi utama. Upload KTP + selfie liveness dipakai
            saat trust badge, limit transaksi, dan review sengketa perlu ditingkatkan.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_50%,_transparent)] dark:text-[color:var(--app-accent)]">
          KYC {kycLabel(activeRecord?.kyc_status)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[color:var(--app-surface-strong)] p-2 ui-accent-text">
                {activeRecord?.status === 'approved' ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {activeRecord?.status === 'approved'
                    ? 'Verified identity ready'
                    : activeRecord?.status === 'manual_review'
                      ? 'Manual review recommended'
                      : 'Verification not complete'}
                </p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {statusText(activeRecord)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {proofItems.map(item => (
                    <span
                      key={item.label}
                      className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        item.ok
                          ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-surface)] text-[color:var(--app-text-soft)]'
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="ui-panel-muted p-4">
              <div className="flex items-center gap-2 text-sm font-semibold ui-text">
                <Sparkles className="h-4 w-4 ui-accent-text" />
                Trust Score
              </div>
              <p className="mt-2 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {formatScore(activeRecord?.trust_score)}
              </p>
            </div>
            <div className="ui-panel-muted p-4">
              <div className="flex items-center gap-2 text-sm font-semibold ui-text">
                <BadgeCheck className="h-4 w-4 ui-accent-text" />
                Quality
              </div>
              <p className="mt-2 text-lg font-bold capitalize text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {activeRecord?.capture_quality || '-'}
              </p>
            </div>
            <div className="ui-panel-muted p-4">
              <div className="flex items-center gap-2 text-sm font-semibold ui-text">
                <Camera className="h-4 w-4 ui-accent-text" />
                Face Coverage
              </div>
              <p className="mt-2 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {formatPercent(activeRecord?.face_coverage)}
              </p>
            </div>
            <div className="ui-panel-muted p-4">
              <div className="flex items-center gap-2 text-sm font-semibold ui-text">
                <ShieldCheck className="h-4 w-4 ui-accent-text" />
                Last Verified
              </div>
              <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {formatWhen(activeRecord?.verified_at)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Upload files
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              Kami simpan ringkasan verifikasi, bukan raw NIK penuh sebagai
              data tampilan. Itu membantu user tetap aman sambil memberi sinyal
              trust untuk operasi, usaha, dan compliance.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  <FileText className="h-4 w-4 ui-accent-text" />
                  Foto KTP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="block min-w-0 w-full max-w-full text-xs text-[color:var(--app-text)] file:mr-3 file:rounded-xl file:border-0 file:bg-[color:var(--app-accent-soft)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)] dark:file:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_60%,_transparent)] dark:file:text-[color:var(--app-accent)]"
                  onChange={event =>
                    setKtpFile(event.target.files?.[0] || null)
                  }
                  disabled={submitting}
                />
                <p className="text-[11px] text-[color:var(--app-text-soft)]">
                  Pastikan semua sudut KTP terlihat dan tidak blur.
                </p>
              </label>

              <label className="space-y-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  <Camera className="h-4 w-4 ui-accent-text" />
                  Selfie Liveness
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="block min-w-0 w-full max-w-full text-xs text-[color:var(--app-text)] file:mr-3 file:rounded-xl file:border-0 file:bg-[color:var(--app-accent-soft)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)] dark:file:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_60%,_transparent)] dark:file:text-[color:var(--app-accent)]"
                  onChange={event =>
                    setSelfieFile(event.target.files?.[0] || null)
                  }
                  disabled={submitting}
                />
                <p className="text-[11px] text-[color:var(--app-text-soft)]">
                  Gunakan cahaya merata dan wajah memenuhi frame.
                </p>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {submitting ? 'Memproses verifikasi...' : 'Verifikasi identitas'}
              </button>

              {message ? (
                <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="ui-panel-muted p-4">
            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Verification summary
            </p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>Nama dokumen</span>
                <span className="break-words text-left font-semibold sm:text-right">
                  {documentPreview?.document_name || activeRecord?.document_name || '-'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>NIK</span>
                <span className="break-all text-left font-semibold sm:text-right">
                  {documentPreview?.nik_masked || activeRecord?.nik_masked || '-'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>Document type</span>
                <span className="break-words text-left font-semibold uppercase sm:text-right">
                  {documentPreview?.document_type || activeRecord?.document_type || 'KTP'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>TTL</span>
                <span className="break-words text-left font-semibold sm:text-right">
                  {documentPreview?.ttl || '-'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>Review mode</span>
                <span className="break-words text-left font-semibold capitalize sm:text-right">
                  {activeRecord?.review_recommendation || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="ui-panel-muted p-4">
            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Immediate product impact
            </p>
            <div className="mt-3 space-y-2">
              {benefits.map(item => (
                <div
                  key={item}
                  className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="ui-panel-muted p-4">
            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Use cases unlocked
            </p>
            {activeRecord?.use_cases && activeRecord.use_cases.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeRecord.use_cases.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-[color:var(--app-info-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_35%,_transparent)]"
                  >
                    {item.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
                Belum ada use case aktif sampai verifikasi dijalankan.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
