'use client';

import type { ChangeEvent, ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Modal } from '@/components/common/Modal';
import { LocalizedLink } from '@/components/ui-kit';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import type { ProfileContentTab } from '@/lib/profile/profileContentTabs';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User2,
  type LucideIcon,
} from 'lucide-react';

type ProfessionalEntry = { title: string; subtitle?: string; meta?: string; url?: string };
type ProfessionalData = {
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  education: ProfessionalEntry[];
  certifications: ProfessionalEntry[];
  experiences: ProfessionalEntry[];
  links: Array<{ label: string; url: string }>;
};
type ListingItem = { id: string; title?: string; content_type?: string; content_status?: string; status?: string; created_at?: string };
type TransactionItem = { id: string; status?: string; amount_cents?: number; currency?: string; created_at?: string };
type StatItem = { label: string; value: string | number; hint?: string; icon: ComponentType<{ className?: string }> };
type SetupCard = { key: string; title: string; description: string; href: string; progress: number; total: number };
type DetailLike = {
  id?: string | null;
  email?: string;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  location?: string | null;
  verification?: Record<string, unknown> | null;
};
type UserLike = { id?: string; email: string; username?: string; full_name?: string; phone?: string | null };

export type ProfileHubViewProps = {
  detail: DetailLike | null;
  user: UserLike;
  effectiveCoverUrl: string;
  effectiveAvatarUrl: string;
  coverUploading: boolean;
  avatarUploading: boolean;
  saving: boolean;
  saveMessage: string | null;
  profileError: string | null;
  roleList: string[];
  professionalData: ProfessionalData;
  statItems: StatItem[];
  fullNameInput: string;
  usernameInput: string;
  phoneInput: string;
  locationInput: string;
  bioInput: string;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onSaveProfile: () => void;
  onCoverFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  listings: ListingItem[];
  activeMarketplaceTab: ProfileContentTab;
  onActiveMarketplaceTabChange: (value: ProfileContentTab) => void;
  txPreview: TransactionItem[];
  formatDate: (value: string | undefined) => string;
  formatMoneyFromCents: (cents: number | undefined, currency?: string) => string;
  verificationSource: Record<string, unknown> | null | undefined;
  onRefreshVerification: () => Promise<void>;
  setupCards: SetupCard[];
  qaResumeUrl: string;
  qaSaving: boolean;
  qaMessage: string | null;
  onQuickApplyResumeChange: (file: File | null) => void;
  onSaveQuickApply: () => void;
  dialPhone: string;
};

const SHELL_CLASS = 'flex min-w-0 w-full flex-col gap-3 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3.5';
const HERO_CLASS = 'overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,var(--app-surface-muted)))] shadow-[0_22px_42px_-32px_rgba(15,23,42,0.16)] ring-1 ring-white/60 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:rounded-[30px] sm:shadow-[0_28px_54px_-38px_rgba(15,23,42,0.2)]';
const CARD_CLASS = 'relative overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_90%,white_10%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-4 py-4 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)] ring-1 ring-white/50 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:rounded-[28px] sm:p-5 sm:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]';
const ROW_CLASS = 'rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-3 py-3';
const PRIMARY_ACTION_CLASS = 'inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 py-2.5 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_18px_30px_-22px_color-mix(in_srgb,_var(--app-accent)_46%,_transparent)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70';
const SECONDARY_ACTION_CLASS = 'inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-4 py-2.5 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-sky-200';
const TONAL_ACTION_CLASS = 'inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,white)] px-3 py-2 text-xs font-semibold text-[color:var(--app-accent)] transition hover:brightness-105';
const SUCCESS_BANNER_CLASS = 'inline-flex w-full items-center gap-2 rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-accent-soft)_18%,var(--app-surface-strong)),color-mix(in_srgb,var(--app-accent-soft)_10%,var(--app-surface)))] px-4 py-3 text-sm text-[color:var(--app-accent)]';
const ERROR_BANNER_CLASS = 'inline-flex w-full items-center gap-2 rounded-[20px] bg-[color:var(--app-warning-soft)] px-4 py-3 text-sm text-[color:var(--app-warning)]';
const INLINE_META_CLASS = 'inline-flex min-h-[32px] max-w-full items-start gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-3 py-1.5 text-[11px] font-medium text-[color:var(--app-text-soft)]';
const INPUT_CLASS = 'w-full rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_90%,transparent))] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:bg-[color:var(--app-surface-strong)] focus:border-[color:var(--app-accent-border)] dark:text-[color:var(--app-text-soft)]';

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={CARD_CLASS}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">{title}</h2>
          {subtitle ? <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)] sm:text-sm">{subtitle}</p> : null}
        </div>
        {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ icon: Icon, label, value, valueClassName }: { icon: LucideIcon; label: string; value: string; valueClassName?: string }) {
  return (
    <div className={`${ROW_CLASS} flex items-start gap-3`}>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,white)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_16%,rgba(15,23,42,0.98))]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">{label}</p>
        <p className={`mt-1 break-words text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] ${valueClassName || ''}`}>{value}</p>
      </div>
    </div>
  );
}

function MetaPill({
  icon: Icon,
  value,
  breakAll = false,
}: {
  icon: LucideIcon;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <span className={INLINE_META_CLASS}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className={`min-w-0 ${breakAll ? 'break-all' : 'break-words'}`}>
        {value}
      </span>
    </span>
  );
}

export function ProfileHubView(props: ProfileHubViewProps) {
  const pathname = usePathname();
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [originBase] = useState(() =>
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.lajukan.com',
  );
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const {
    detail,
    user,
    effectiveCoverUrl,
    effectiveAvatarUrl,
    coverUploading,
    avatarUploading,
    saving,
    saveMessage,
    profileError,
    professionalData,
    fullNameInput,
    usernameInput,
    phoneInput,
    locationInput,
    bioInput,
    onFullNameChange,
    onUsernameChange,
    onPhoneChange,
    onLocationChange,
    onBioChange,
    onSaveProfile,
    onCoverFileChange,
    onAvatarFileChange,
  } = props;

  useEffect(() => {
    if (!copyMessage) return;
    const timeout = window.setTimeout(() => setCopyMessage(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyMessage]);

  const locale = useMemo(() => resolveLocaleFromPathname(pathname), [pathname]);
  const displayName = detail?.full_name || detail?.fullName || user.full_name || user.phone || user.email || 'Pengguna';
  const publicHandle = (usernameInput || detail?.username || user.username || '').trim().toLowerCase();
  const emailValue = String(detail?.email || user.email || '').trim();
  const phoneValue = String(phoneInput || detail?.phone || user.phone || '').trim();
  const locationValue = String(detail?.location || locationInput || '').trim();
  const headlineValue = professionalData.headline?.trim() || 'Profil singkat yang langsung menjelaskan siapa kamu.';
  const summaryValue = bioInput.trim() || professionalData.summary.trim() || 'Tambahkan satu dua kalimat supaya orang cepat paham dan lebih yakin.';
  const publicProfilePath = useMemo(() => buildPublicProfileHref({ id: detail?.id || user.id, username: publicHandle, full_name: fullNameInput || displayName }, `/${locale}/profile`), [detail?.id, displayName, fullNameInput, locale, publicHandle, user.id]);
  const publicProfileUrl = `${originBase}${publicProfilePath}`;

  const copyPublicProfileUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setCopyMessage('Link tersalin');
    } catch {
      setCopyMessage('Gagal menyalin link');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,transparent))] pb-[calc(6rem+env(safe-area-inset-bottom))] pt-0 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_96%,rgba(2,6,23,0.98)),color-mix(in_srgb,var(--app-surface)_94%,rgba(2,6,23,0.98)))] sm:pb-10 sm:pt-4">
      <div className="page-shell overflow-x-hidden">
        <div className={SHELL_CLASS}>
        <section className={HERO_CLASS}>
          <div className="relative h-40 sm:h-44 lg:h-48">
            {effectiveCoverUrl ? <Image src={effectiveCoverUrl} alt="Profile cover" fill sizes="100vw" className="object-cover" unoptimized /> : <div className="h-full w-full bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_48%,#e2e8f0_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))]" />}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(15,23,42,0.1)_42%,rgba(15,23,42,0.56)_100%)]" />
            <label htmlFor="profile-cover-upload" className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-950/86 dark:text-slate-200">
              {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Sampul
            </label>
            <input id="profile-cover-upload" type="file" accept="image/*" className="hidden" onChange={onCoverFileChange} disabled={coverUploading || saving} />
          </div>

          <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="-mt-12 sm:-mt-16">
              <div className="rounded-[22px] border border-white/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_92%,transparent))] p-4 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 sm:rounded-[24px] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border-4 border-white bg-[color:var(--app-surface-muted)] shadow-xl dark:border-slate-950 sm:h-28 sm:w-28 sm:rounded-[24px]">
                    <Image src={effectiveAvatarUrl} alt={displayName} fill sizes="112px" className="object-cover" unoptimized />
                    <label htmlFor="profile-avatar-upload" className="absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-[color:var(--app-accent)] shadow-lg dark:bg-slate-950">
                      {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </label>
                    <input id="profile-avatar-upload" type="file" accept="image/*" className="hidden" onChange={onAvatarFileChange} disabled={avatarUploading || saving} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="break-words text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:truncate sm:text-[2rem]">{displayName}</h1>
                      <span className="inline-flex max-w-full items-center rounded-full border border-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,var(--app-surface-strong))] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-accent)]">
                        <span className="min-w-0 truncate">@{publicHandle || 'profil'}</span>
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{headlineValue}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {locationValue ? <MetaPill icon={MapPin} value={locationValue} /> : null}
                      {emailValue ? <MetaPill icon={Mail} value={emailValue} breakAll /> : null}
                      {phoneValue ? <MetaPill icon={Phone} value={phoneValue} breakAll /> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={() => setQuickEditOpen(true)} className={`${PRIMARY_ACTION_CLASS} w-full sm:w-auto`}><User2 className="h-4 w-4" />Edit cepat</button>
                  <a href={publicProfileUrl} target="_blank" rel="noreferrer noopener" className={`${SECONDARY_ACTION_CLASS} w-full sm:w-auto`}><ExternalLink className="h-4 w-4" />Buka publik</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {saveMessage ? <div className={SUCCESS_BANNER_CLASS}><CheckCircle2 className="h-4 w-4" />{saveMessage}</div> : null}
        {profileError ? <div className={ERROR_BANNER_CLASS}>{profileError}</div> : null}

        <div className="grid gap-2.5 sm:gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
          <SectionCard title="Data utama" subtitle="Yang penting dulu supaya orang cepat paham dan cepat hubungi." action={<LocalizedLink href="/profile/edit?focus=identity" className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--app-accent)] sm:text-sm">Edit lengkap<ChevronRight className="h-4 w-4" /></LocalizedLink>}>
            <div className="space-y-2.5">
              <InfoRow icon={User2} label="Nama tampil" value={displayName} />
              <InfoRow icon={Mail} label="Email" value={emailValue || 'Belum ada email'} />
              <InfoRow icon={Phone} label="Nomor telepon" value={phoneValue || 'Belum diisi'} />
              <InfoRow icon={MapPin} label="Lokasi" value={locationValue || 'Belum diisi'} />
              <InfoRow icon={FileText} label="Ringkasan" value={summaryValue} valueClassName="leading-6" />
            </div>
          </SectionCard>

          <div className="grid gap-3">
            <SectionCard title="Profil publik" subtitle="Link pendek yang bisa langsung dibagikan.">
              <div className="space-y-2.5">
                <InfoRow icon={Link2} label={publicHandle.length >= 3 ? 'URL aktif' : 'URL default'} value={publicProfileUrl} valueClassName="break-all" />
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={copyPublicProfileUrl} className={`${TONAL_ACTION_CLASS} w-full sm:w-auto`}><Link2 className="h-3.5 w-3.5" />{copyMessage || 'Salin link'}</button>
                  <a href={publicProfileUrl} target="_blank" rel="noreferrer noopener" className={`${TONAL_ACTION_CLASS} w-full sm:w-auto`}><ExternalLink className="h-3.5 w-3.5" />Buka</a>
                  <LocalizedLink href="/profile/edit?focus=identity" className={`${TONAL_ACTION_CLASS} w-full sm:w-auto`}><ChevronRight className="h-3.5 w-3.5" />Atur URL</LocalizedLink>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <Modal open={quickEditOpen} title="Edit profil singkat" onClose={() => setQuickEditOpen(false)} footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <LocalizedLink href="/profile/edit?focus=identity" className={`${SECONDARY_ACTION_CLASS} w-full sm:w-auto`}>Edit lengkap<ChevronRight className="h-4 w-4" /></LocalizedLink>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" onClick={() => setQuickEditOpen(false)} className={`${SECONDARY_ACTION_CLASS} w-full sm:w-auto`}>Tutup</button>
              <button type="button" onClick={onSaveProfile} disabled={saving} className={`${PRIMARY_ACTION_CLASS} w-full sm:w-auto`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan</button>
            </div>
          </div>
        }>
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-accent-soft)_18%,var(--app-surface-strong)),color-mix(in_srgb,var(--app-accent-soft)_10%,var(--app-surface)))] p-3 text-sm text-[color:var(--app-accent)]">Ubah yang paling penting dulu: nama, URL, nomor, lokasi, dan ringkasan singkat.</div>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Nama tampil</span><input value={fullNameInput} onChange={event => onFullNameChange(event.target.value)} className={INPUT_CLASS} placeholder="Nama yang ingin ditampilkan" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">URL profil publik</span><input value={usernameInput} onChange={event => onUsernameChange(event.target.value)} className={INPUT_CLASS} placeholder="muhammad-fauzan-yanuar-putra" /><p className="break-all text-xs text-[color:var(--app-text-soft)]">{publicProfileUrl}</p></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Nomor telepon</span><input value={phoneInput} onChange={event => onPhoneChange(event.target.value)} className={INPUT_CLASS} placeholder="08xxxxxxxxxx" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Lokasi</span><input value={locationInput} onChange={event => onLocationChange(event.target.value)} className={INPUT_CLASS} placeholder="Jakarta, Bandung, Surabaya" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Ringkasan singkat</span><textarea value={bioInput} onChange={event => onBioChange(event.target.value)} rows={4} className={INPUT_CLASS} placeholder="Jelaskan singkat siapa kamu atau usaha kamu." /></label>
          </div>
        </Modal>
        </div>
      </div>
    </div>
  );
}
