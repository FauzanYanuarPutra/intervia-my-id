'use client';

import { type ChangeEvent, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  type IdentityVerificationRecord,
  readIdentityVerification,
} from '@/lib/identityVerification';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import {
  IMAGE_UPLOAD_RAW_MAX_BYTES,
  IMAGE_UPLOAD_RAW_MAX_MB,
} from '@/lib/media/uploadStandard';

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

function validateKycImage(file: File): string {
  if (!file.type.startsWith('image/')) return 'File harus berupa gambar.';
  if (file.size <= 0) return 'File tidak boleh kosong.';
  if (file.size > IMAGE_UPLOAD_RAW_MAX_BYTES) {
    return `Ukuran maksimal ${IMAGE_UPLOAD_RAW_MAX_MB}MB per file.`;
  }
  return '';
}

function kycLabel(
  status: IdentityVerificationRecord['kyc_status'] | undefined,
) {
  if (status === 'enhanced') return 'Enhanced';
  if (status === 'full') return 'Full';
  if (status === 'basic') return 'Basic';
  return 'None';
}

function statusText(record: IdentityVerificationRecord | null) {
  if (!record) return 'Mulai dari upload KTP dan selfie. Prosesnya sebentar.';
  if (record.status === 'approved') {
    return 'Identitas sudah siap untuk trust badge, transaksi, dan review.';
  }
  if (record.status === 'manual_review') {
    return 'Dokumen sudah masuk. Tim perlu cek sebentar lagi.';
  }
  return 'Foto sebelumnya kurang jelas. Upload ulang dengan cahaya terang.';
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
  const [documentPreview, setDocumentPreview] =
    useState<DocumentPreview | null>(null);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeRecord = currentRecord || existingRecord;
  const isApproved = activeRecord?.status === 'approved';
  const verificationSteps = [
    {
      label: 'Nomor HP',
      hint: 'Biar akun mudah dihubungi',
      ok: activeRecord?.phone_verified,
      icon: MessageCircle,
    },
    {
      label: 'Foto KTP',
      hint: 'Untuk cek nama dan identitas',
      ok: activeRecord?.document_verified,
      icon: FileText,
    },
    {
      label: 'Selfie',
      hint: 'Pastikan akun dipakai orang asli',
      ok: activeRecord?.liveness_verified,
      icon: Camera,
    },
  ];
  const completedSteps = verificationSteps.filter(item => item.ok).length;
  const canSubmit = Boolean(ktpFile && selfieFile);
  const benefitCards = [
    {
      title: 'Lebih dipercaya',
      text: 'Badge trust lebih kuat saat orang lihat profil atau chat.',
      icon: BadgeCheck,
    },
    {
      title: 'Transaksi lebih aman',
      text: 'Bantu naikkan limit dan proteksi saat order bernilai besar.',
      icon: WalletCards,
    },
    {
      title: 'Bantuan lebih cepat',
      text: 'Kalau ada sengketa, tim punya sinyal verifikasi yang jelas.',
      icon: ShieldCheck,
    },
  ];
  const technicalBenefits =
    activeRecord?.benefits && activeRecord.benefits.length > 0
      ? activeRecord.benefits
      : benefitCards.map(item => item.text);
  const summaryRows = [
    {
      label: 'Nama dokumen',
      value:
        documentPreview?.document_name || activeRecord?.document_name || '-',
    },
    {
      label: 'NIK',
      value: documentPreview?.nik_masked || activeRecord?.nik_masked || '-',
    },
    {
      label: 'Tipe dokumen',
      value:
        documentPreview?.document_type || activeRecord?.document_type || 'KTP',
    },
    {
      label: 'TTL',
      value: documentPreview?.ttl || '-',
    },
    {
      label: 'Review',
      value: activeRecord?.review_recommendation || '-',
    },
  ];

  const handleSubmit = async () => {
    if (!ktpFile || !selfieFile) {
      setMessage('Upload KTP dan selfie terlebih dulu.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const [optimizedKtp, optimizedSelfie] = await Promise.all([
        prepareUploadFile(ktpFile),
        prepareUploadFile(selfieFile),
      ]);
      const formData = new FormData();
      formData.set('ktp', optimizedKtp);
      formData.set('selfie', optimizedSelfie);

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
        ((data.ai as Record<string, unknown> | undefined)?.document_preview ||
          null) as DocumentPreview | null,
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

  const handleFileSelect =
    (setter: (file: File | null) => void) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        event.target.value = '';
        if (!file) {
          setter(null);
          return;
        }
        const error = validateKycImage(file);
        if (error) {
          setter(null);
          setMessage(error);
          return;
        }
        setMessage(null);
        setter(file);
      };

  return (
    <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm sm:p-4 sm:shadow-[0_18px_40px_-32px_rgba(15,23,42,0.34)] dark:border-[color:var(--app-border-strong)]">
      <div className="flex flex-col gap-3 rounded-[20px] bg-[linear-gradient(135deg,#f7fff9_0%,#ffffff_64%,#ecfdf5_100%)] p-3 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_62%,#10251e_100%)] sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent)] text-white">
              {isApproved ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                Trust
              </p>
              <h2 className="truncate text-base font-bold text-[color:var(--app-text)] dark:text-white sm:text-lg">
                {isApproved
                  ? 'Akun sudah terpercaya'
                  : 'Biar akun lebih dipercaya'}
              </h2>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--app-text-soft)] dark:text-white/68">
            {statusText(activeRecord)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full bg-white px-3 text-xs font-bold text-[color:var(--app-accent)] shadow-sm ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-100 dark:ring-white/10">
            KYC {kycLabel(activeRecord?.kyc_status)}
          </span>
          <span className="inline-flex min-h-8 items-center rounded-full bg-white px-3 text-xs font-bold text-[color:var(--app-text)] shadow-sm ring-1 ring-emerald-100 dark:bg-white/10 dark:text-white dark:ring-white/10">
            {completedSteps}/3 siap
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {benefitCards.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.05]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <p className="mt-2 text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[color:var(--app-text-soft)] dark:text-white/62">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-[20px] border border-[color:var(--app-border)] bg-white p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.05] sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                  3 langkah saja
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--app-text-soft)]">
                  Nomor HP, KTP, dan selfie. Detail teknis disimpan di belakang.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-xs font-bold text-[color:var(--app-accent)]">
                {completedSteps}/3
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {verificationSteps.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5 dark:border-[color:var(--app-border-strong)] dark:bg-black/10"
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${item.ok
                          ? 'bg-[color:var(--app-accent)] text-white'
                          : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]'
                        }`}
                    >
                      {item.ok ? (
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      ) : (
                        <Icon className="h-4.5 w-4.5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                        {item.label}
                      </span>
                      <span className="line-clamp-1 text-xs font-medium text-[color:var(--app-text-soft)]">
                        {item.ok ? 'Sudah siap' : item.hint}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]/40 p-3 dark:bg-emerald-400/5 sm:p-4">
            <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-white">
              Upload dokumen
            </p>
            <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">
              Cukup dua foto. NIK penuh tidak ditampilkan di profil.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="ui-pressable flex cursor-pointer items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 transition hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.07]">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect(setKtpFile)}
                  disabled={submitting}
                />
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                    KTP
                  </span>
                  <span className="block truncate text-xs font-medium text-[color:var(--app-text-soft)]">
                    {ktpFile ? ktpFile.name : 'Pilih foto KTP'}
                  </span>
                </span>
                {ktpFile ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
                ) : null}
              </label>

              <label className="ui-pressable flex cursor-pointer items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 transition hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.07]">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect(setSelfieFile)}
                  disabled={submitting}
                />
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Camera className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                    Selfie
                  </span>
                  <span className="block truncate text-xs font-medium text-[color:var(--app-text-soft)]">
                    {selfieFile ? selfieFile.name : 'Pilih foto selfie'}
                  </span>
                </span>
                {selfieFile ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
                ) : null}
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {submitting
                  ? 'Sedang dicek...'
                  : canSubmit
                    ? 'Kirim verifikasi'
                    : 'Upload KTP + selfie'}
              </button>

              {message ? (
                <p className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.05]">
            <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-white">
              Setelah aktif
            </p>
            <div className="mt-3 space-y-2">
              {technicalBenefits.slice(0, 3).map(item => (
                <div
                  key={item}
                  className="flex gap-2 rounded-[16px] bg-white px-3 py-2 text-sm font-medium leading-5 text-[color:var(--app-text)] dark:bg-white/[0.07] dark:text-white/72"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <details className="group rounded-[20px] border border-[color:var(--app-border)] bg-white p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.05]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[color:var(--app-text)] dark:text-white">
              Detail teknis
              <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Trust score', formatScore(activeRecord?.trust_score)],
                ['Kualitas', activeRecord?.capture_quality || '-'],
                ['Wajah', formatPercent(activeRecord?.face_coverage)],
                ['Terakhir', formatWhen(activeRecord?.verified_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[14px] bg-[color:var(--app-surface-muted)] p-2.5 dark:bg-black/10"
                >
                  <p className="text-[11px] font-bold text-[color:var(--app-text-soft)]">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-[color:var(--app-text)] dark:text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--app-text)] dark:text-white/72">
              {summaryRows.map(item => (
                <div
                  key={item.label}
                  className="flex flex-col gap-1 rounded-[14px] bg-[color:var(--app-surface-muted)] px-3 py-2 dark:bg-black/10"
                >
                  <span className="text-[11px] font-bold text-[color:var(--app-text-soft)]">
                    {item.label}
                  </span>
                  <span className="break-words font-semibold">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </details>

          <div className="rounded-[20px] border border-[color:var(--app-border)] bg-white p-3 dark:border-[color:var(--app-border-strong)] dark:bg-white/[0.05]">
            <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-white">
              Fitur yang kebuka
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
              <p className="mt-2 text-sm font-medium leading-5 text-[color:var(--app-text-soft)]">
                Akan muncul setelah verifikasi berhasil.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
