'use client';

import type { ChangeEvent, ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { usePathname } from 'next/navigation';
import { Modal } from '@/components/common/Modal';
import { IdentityVerificationPanel } from '@/components/profile/IdentityVerificationPanel';
import { LocalizedLink } from '@/components/ui-kit';
import { readIdentityVerification } from '@/lib/identityVerification';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import {
  buildPublicProfileHref,
  normalizePublicProfileHandleInput,
} from '@/lib/profile/publicProfileLink';
import {
  getProfileContentTabDefinition,
  getProfileContentTabLabel,
  normalizeProfileContentTab,
  PROFILE_CONTENT_TABS,
  type ProfileContentTab,
} from '@/lib/profile/profileContentTabs';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  ExternalLink,
  Heart,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Phone,
  Repeat2,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  User2,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

type ProfessionalEntry = {
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
};

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

type ListingItem = {
  id: string;
  title?: string;
  content_type?: string;
  content_status?: string;
  status?: string;
  created_at?: string;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TransactionItem = {
  id: string;
  status?: string;
  amount_cents?: number;
  currency?: string;
  created_at?: string;
};

type StatItem = {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
};

type SetupCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  progress: number;
  total: number;
};

type DetailLike = {
  id?: string | null;
  email?: string;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  verification?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

type UserLike = {
  id?: string;
  email: string;
  username?: string;
  full_name?: string;
  phone?: string | null;
};

export type ProfileHubViewProps = {
  detail: DetailLike | null;
  user: UserLike;
  effectiveCoverUrl: string;
  effectiveAvatarUrl: string;
  avatarBuilder?: ReactNode;
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
  formatMoneyFromCents: (
    cents: number | undefined,
    currency?: string,
  ) => string;
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

type HubTab =
  | 'ringkas'
  | 'aktivitas'
  | 'etalase'
  | 'cv'
  | 'reels'
  | 'komunitas'
  | 'trust';
type SocialModalTab = 'followers' | 'following';

type DiscoverUser = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  avatar_style?: unknown;
  avatarStyle?: unknown;
  metadata?: unknown;
  location?: string | null;
  headline?: string | null;
  bio?: string | null;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
};

type SocialUser = {
  id: string;
  name: string;
  handle: string;
  href: string;
  avatarUrl: string;
  subtitle: string;
  meta: string;
};

const PAGE_CLASS =
  'min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f5fbf7_0%,#eef7f1_34%,#f8fafc_100%)] pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-0 dark:bg-[linear-gradient(180deg,#07120f_0%,#07111d_44%,#020617_100%)] sm:pb-8 sm:pt-2';
const CARD_CLASS =
  'rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%)] shadow-[0_18px_38px_-34px_rgba(15,23,42,0.34)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,black_6%)]';
const MUTED_ROW_CLASS =
  'rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]';
type SectionTone =
  | 'plain'
  | 'profile'
  | 'activity'
  | 'insight'
  | 'market'
  | 'work'
  | 'social'
  | 'trust';

const SECTION_TONE_CLASS: Record<SectionTone, string> = {
  plain: '',
  profile:
    'border-emerald-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_58%,#ecfdf5_100%)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_62%,#10251e_100%)]',
  activity:
    'border-sky-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#eff6ff_100%)] dark:border-sky-900/70 dark:bg-[linear-gradient(135deg,#07111d_0%,#0b1726_62%,#102033_100%)]',
  insight:
    'border-teal-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f6fffd_56%,#ccfbf1_100%)] dark:border-teal-900/70 dark:bg-[linear-gradient(135deg,#071311_0%,#0b1f1c_62%,#102823_100%)]',
  market:
    'border-lime-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#fbfff4_58%,#ecfccb_100%)] dark:border-lime-900/70 dark:bg-[linear-gradient(135deg,#0d1207_0%,#18240d_62%,#1f2c12_100%)]',
  work: 'border-amber-200/85 bg-[linear-gradient(135deg,#ffffff_0%,#fffdf5_56%,#fef3c7_100%)] dark:border-amber-900/70 dark:bg-[linear-gradient(135deg,#151007_0%,#241a09_62%,#2b210f_100%)]',
  social:
    'border-rose-200/75 bg-[linear-gradient(135deg,#ffffff_0%,#fff7fb_58%,#ffe4e6_100%)] dark:border-rose-900/70 dark:bg-[linear-gradient(135deg,#16090f_0%,#25101a_62%,#2b1320_100%)]',
  trust:
    'border-orange-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#fff8ed_54%,#ecfdf5_100%)] dark:border-orange-900/70 dark:bg-[linear-gradient(135deg,#160f07_0%,#1f170b_56%,#092017_100%)]',
};

const STAT_TONE_CLASSES = [
  'border-emerald-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_62%,#ecfdf5_100%)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_100%)]',
  'border-sky-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_62%,#e0f2fe_100%)] dark:border-sky-900/70 dark:bg-[linear-gradient(135deg,#07111d_0%,#0b1726_100%)]',
  'border-amber-200/85 bg-[linear-gradient(135deg,#ffffff_0%,#fffdf5_62%,#fef3c7_100%)] dark:border-amber-900/70 dark:bg-[linear-gradient(135deg,#151007_0%,#241a09_100%)]',
  'border-rose-200/75 bg-[linear-gradient(135deg,#ffffff_0%,#fff7fb_62%,#ffe4e6_100%)] dark:border-rose-900/70 dark:bg-[linear-gradient(135deg,#16090f_0%,#25101a_100%)]',
];
const PRIMARY_ACTION_CLASS =
  'inline-flex min-h-[42px] max-w-full items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-strong)] px-3.5 text-xs font-black text-[color:var(--app-text-inverse)] shadow-[0_16px_28px_-22px_rgba(4,120,87,0.65)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65 sm:min-h-[44px] sm:px-4';
const SECONDARY_ACTION_CLASS =
  'inline-flex min-h-[42px] max-w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] sm:min-h-[44px] sm:px-4';
const TONAL_ACTION_CLASS =
  'inline-flex min-h-[40px] max-w-full items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-black text-[color:var(--app-accent)] transition hover:brightness-105 sm:min-h-[42px] sm:px-3.5';
const INPUT_CLASS =
  'w-full rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-2.5 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]';
const REELS_PROFILE_STORAGE_KEY = 'lajukan.reels.preference.v1';
const PROFILE_SOCIAL_STORAGE_KEY = 'lajukan.profile.following.v1';

function SectionBlock({
  title,
  subtitle,
  action,
  tone = 'plain',
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: SectionTone;
  children: ReactNode;
}) {
  return (
    <section className={cn(CARD_CLASS, SECTION_TONE_CLASS[tone], 'p-3 sm:p-4')}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface)]">
      <div
        className="h-full rounded-full bg-[color:var(--app-accent-strong)] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function IconPill({
  icon: Icon,
  children,
  muted = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[30px] max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold sm:min-h-[32px] sm:px-3 sm:text-xs',
        muted
          ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]'
          : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
      )}
    >
      <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function readSocialText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function readSocialNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
}

function asSocialRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapDiscoverUserToSocialUser(
  item: DiscoverUser,
  isId: boolean,
): SocialUser | null {
  const id = readSocialText(item.id);
  if (!id) return null;

  const username = readSocialText(item.username);
  const name =
    readSocialText(item.full_name) ||
    readSocialText(item.fullName) ||
    username ||
    (isId ? 'Pengguna Lajukan' : 'Lajukan user');
  const subtitle =
    readSocialText(item.headline) ||
    readSocialText(item.bio) ||
    readSocialText(item.location) ||
    (isId ? 'Profil Lajukan' : 'Lajukan profile');
  const meta = [
    readSocialText(item.location),
    item.rating ? `${item.rating.toFixed(1)} rating` : '',
    item.completed_jobs ? `${item.completed_jobs} deal` : '',
    readSocialText(item.level),
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(' - ');

  return {
    id,
    name,
    handle: username,
    href: buildSocialUserProfileHref({ id, username, name }),
    avatarUrl: profileAvatarSrc(
      readSocialText(item.avatar_url) || readSocialText(item.avatarUrl),
      readProfileAvatarStyle(item),
      name,
    ),
    subtitle,
    meta,
  };
}

function mapRecordToSocialUser(
  value: unknown,
  isId: boolean,
): SocialUser | null {
  const record = asSocialRecord(value);
  if (!record) return null;
  return mapDiscoverUserToSocialUser(
    {
      id: readSocialText(record.id) || readSocialText(record.user_id),
      username:
        readSocialText(record.username) || readSocialText(record.handle),
      full_name:
        readSocialText(record.full_name) ||
        readSocialText(record.fullName) ||
        readSocialText(record.name),
      avatar_url: profileAvatarSrc(
        readSocialText(record.avatar_url) ||
          readSocialText(record.avatarUrl) ||
          readSocialText(record.avatar),
        readProfileAvatarStyle(record),
        readSocialText(record.full_name) ||
          readSocialText(record.fullName) ||
          readSocialText(record.name),
      ),
      avatar_style: record.avatar_style,
      avatarStyle: record.avatarStyle,
      metadata: record.metadata,
      location: readSocialText(record.location),
      headline:
        readSocialText(record.headline) || readSocialText(record.subtitle),
      bio: readSocialText(record.bio),
      level: readSocialText(record.level),
      rating: readSocialNumber(record.rating) || null,
      completed_jobs: readSocialNumber(record.completed_jobs) || null,
    },
    isId,
  );
}

function readSocialList(value: unknown, isId: boolean): SocialUser[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => mapRecordToSocialUser(item, isId))
    .filter((item): item is SocialUser => Boolean(item));
}

function mergeSocialUsers(...groups: SocialUser[][]): SocialUser[] {
  const seen = new Set<string>();
  const result: SocialUser[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function buildSocialUserProfileHref({
  id,
  username,
  name,
}: {
  id: string;
  username: string;
  name: string;
}): string {
  const slugBase =
    normalizePublicProfileHandleInput(username) ||
    normalizePublicProfileHandleInput(name) ||
    'member';
  return `/profile/${slugBase}--${encodeURIComponent(id)}`;
}

function SocialUserRow({
  item,
  isId,
  following,
  onToggle,
}: {
  item: SocialUser;
  isId: boolean;
  following: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        MUTED_ROW_CLASS,
        'flex min-w-0 items-center gap-3 p-3 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
      )}
    >
      <LocalizedLink
        href={item.href}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-border)]"
      >
        <Image
          src={profileAvatarSrc(item.avatarUrl)}
          alt={item.name}
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
        />
      </LocalizedLink>

      <LocalizedLink href={item.href} className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {item.name}
        </p>
        {item.handle ? (
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            @{item.handle}
          </p>
        ) : null}
        <p className="mt-0.5 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
          {item.meta || item.subtitle}
        </p>
      </LocalizedLink>

      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn(
          'inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[11px] font-black transition sm:text-xs',
          following
            ? 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-rose-200 hover:text-rose-600'
            : 'bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] hover:brightness-105',
        )}
      >
        {following ? (
          <UserMinus className="h-3.5 w-3.5" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        {following ? (isId ? 'Unfollow' : 'Unfollow') : 'Follow'}
      </button>
    </div>
  );
}

function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              CARD_CLASS,
              STAT_TONE_CLASSES[index % STAT_TONE_CLASSES.length],
              'min-w-0 p-3',
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/90 text-[color:var(--app-accent)] shadow-sm ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-black leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.value}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-bold text-[color:var(--app-text-soft)] sm:text-xs">
                  {item.label}
                </span>
              </span>
            </div>
            {item.hint ? (
              <p className="mt-2 truncate rounded-full bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)] dark:bg-white/10">
                {item.hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-center dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
      <p className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-4 text-[color:var(--app-text-soft)]">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function ProfileTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition sm:min-h-[36px] sm:px-3.5',
        active
          ? 'bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] shadow-[0_14px_24px_-20px_rgba(4,120,87,0.7)]'
          : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-soft)] dark:ring-[color:var(--app-border-strong)]',
      )}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function EntryList({
  items,
  empty,
}: {
  items: ProfessionalEntry[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--app-text-soft)]">{empty}</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.slice(0, 4).map(item => (
        <div
          key={`${item.title}-${item.subtitle || ''}-${item.meta || ''}`}
          className={cn(MUTED_ROW_CLASS, 'p-2.5')}
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p className="break-words text-[13px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {item.title}
              </p>
              {item.subtitle || item.meta ? (
                <p className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                  {[item.subtitle, item.meta].filter(Boolean).join(' - ')}
                </p>
              ) : null}
            </div>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-muted)]"
                aria-label="Buka link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function classifyListing(item: ListingItem) {
  return normalizeProfileContentTab({
    type: item.content_type || item.status,
    category: item.category,
    metadata: item.metadata,
  });
}

function shortenUrl(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function ActivityActionCard({
  title,
  description,
  href,
  icon: Icon,
  metric,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  metric: string;
  actionLabel: string;
}) {
  return (
    <LocalizedLink
      href={href}
      className={cn(
        MUTED_ROW_CLASS,
        'group flex min-h-[108px] min-w-0 flex-col justify-between p-2.5 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)] sm:min-h-[116px]',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate rounded-full bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-muted)]">
          {metric}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-[color:var(--app-accent)]">
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </LocalizedLink>
  );
}

function ActivityMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className={cn(MUTED_ROW_CLASS, 'min-w-0 p-2.5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
          {hint}
        </span>
      </div>
      <p className="mt-2 truncate text-lg font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
        {label}
      </p>
    </div>
  );
}

function ActivityTimelineRow({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <LocalizedLink
      href={href}
      className={cn(
        MUTED_ROW_CLASS,
        'group flex min-w-0 items-center gap-2.5 p-2.5 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
      )}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)]" />
    </LocalizedLink>
  );
}

function clampProfileProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProfileGameProgress({
  isId,
  setupPercent,
  listingsCount,
  txCount,
  reelsSignalCount,
  trustReady,
}: {
  isId: boolean;
  setupPercent: number;
  listingsCount: number;
  txCount: number;
  reelsSignalCount: number;
  trustReady: boolean;
}) {
  const totalXp =
    360 +
    setupPercent * 6 +
    listingsCount * 140 +
    txCount * 180 +
    reelsSignalCount * 28 +
    (trustReady ? 320 : 0);
  const xpGoal = 500;
  const level = Math.max(1, Math.floor(totalXp / xpGoal) + 1);
  const xp = totalXp % xpGoal;
  const xpPercent = clampProfileProgress((xp / xpGoal) * 100);
  const rank =
    level >= 12
      ? isId
        ? 'Pro Seller'
        : 'Pro Seller'
      : level >= 7
        ? isId
          ? 'Builder'
          : 'Builder'
        : isId
          ? 'Starter'
          : 'Starter';
  const streak = Math.max(
    1,
    Math.min(
      21,
      2 + listingsCount + txCount + Math.floor(reelsSignalCount / 2),
    ),
  );
  const quest = !trustReady
    ? isId
      ? 'Verifikasi profil'
      : 'Verify profile'
    : listingsCount === 0
      ? isId
        ? 'Upload listing pertama'
        : 'Upload first listing'
      : reelsSignalCount === 0
        ? isId
          ? 'Buat Reels singkat'
          : 'Upload a short reel'
        : isId
          ? PROMO_ONLY_MODE
            ? 'Balas chat dan rapikan listing'
            : 'Balas chat dan transaksi'
          : PROMO_ONLY_MODE
            ? 'Reply to chats and polish listings'
            : 'Reply to chats and deals';

  return (
    <section className="relative overflow-hidden rounded-[20px] border border-emerald-200/85 bg-[linear-gradient(135deg,#ffffff_0%,#f7fff9_48%,#ecfdf5_100%)] p-3.5 text-[color:var(--app-text)] shadow-[0_18px_38px_-34px_rgba(15,23,42,0.3)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,#07120f_0%,#0b1b16_58%,#10251e_100%)] sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-emerald-600 text-white shadow-[0_14px_24px_-20px_rgba(4,120,87,0.9)]">
          <BadgeCheck className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/82 px-2.5 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-100 dark:ring-white/10">
              {rank}
            </span>
            <span className="rounded-full bg-white/82 px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text-soft)] ring-1 ring-emerald-100 dark:bg-white/10 dark:ring-white/10">
              Level {level}
            </span>
          </div>
          <h3 className="mt-2 text-base font-black leading-5 sm:text-[17px]">
            {isId ? 'Profil makin siap dipakai' : 'Profile is getting ready'}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Fokus ke satu misi berikutnya. Tidak perlu isi semuanya sekaligus.'
              : 'Focus on the next mission. No need to complete everything at once.'}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-[16px] border border-emerald-100 bg-white/78 p-3 dark:border-white/10 dark:bg-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs font-black text-[color:var(--app-text)] dark:text-white">
            {isId ? `Misi: ${quest}` : `Mission: ${quest}`}
          </span>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/15">
            {xp}/{xpGoal} XP
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-white/12">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#047857,#22c55e,#facc15)]"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          {
            label: isId ? 'Kelengkapan' : 'Ready',
            value: `${setupPercent}%`,
            icon: Sparkles,
          },
          {
            label: isId ? 'Listing' : 'Listings',
            value: listingsCount.toLocaleString(),
            icon: BriefcaseBusiness,
          },
          {
            label: isId ? 'Aktif' : 'Active',
            value: `${streak}x`,
            icon: Repeat2,
          },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="min-w-0 rounded-[15px] border border-emerald-100 bg-white/72 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.06]"
            >
              <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-200" />
              <p className="mt-1 truncate text-sm font-black leading-4 text-[color:var(--app-text)] dark:text-white">
                {item.value}
              </p>
              <p className="truncate text-[10px] font-bold text-[color:var(--app-text-soft)]">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileHubView(props: ProfileHubViewProps) {
  const pathname = usePathname();
  const [activeHubTab, setActiveHubTab] = useState<HubTab>('ringkas');
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [socialModal, setSocialModal] = useState<SocialModalTab | null>(null);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [reelsSignalCount, setReelsSignalCount] = useState(0);
  const [reelsPreferenceTags, setReelsPreferenceTags] = useState<string[]>([]);
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
    avatarBuilder,
    coverUploading,
    avatarUploading,
    saving,
    saveMessage,
    profileError,
    professionalData,
    statItems,
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
    listings,
    activeMarketplaceTab,
    onActiveMarketplaceTabChange,
    txPreview,
    formatDate,
    formatMoneyFromCents,
    verificationSource,
    onRefreshVerification,
    setupCards,
    qaResumeUrl,
    qaSaving,
    qaMessage,
    onQuickApplyResumeChange,
    onSaveQuickApply,
    dialPhone,
  } = props;

  useEffect(() => {
    if (!copyMessage) return;
    const timeout = window.setTimeout(() => setCopyMessage(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readReelsPreference = () => {
      try {
        const raw = window.localStorage.getItem(REELS_PROFILE_STORAGE_KEY);
        if (!raw) {
          setReelsSignalCount(0);
          setReelsPreferenceTags([]);
          return;
        }

        const parsed = JSON.parse(raw) as {
          signals?: unknown;
          terms?: Record<string, unknown>;
        };
        const signals = Number(parsed.signals);
        const terms =
          parsed.terms && typeof parsed.terms === 'object'
            ? Object.entries(parsed.terms)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([key]) => key)
                .filter(Boolean)
                .slice(0, 8)
            : [];

        setReelsSignalCount(
          Number.isFinite(signals) ? Math.max(0, signals) : 0,
        );
        setReelsPreferenceTags(terms);
      } catch {
        setReelsSignalCount(0);
        setReelsPreferenceTags([]);
      }
    };

    readReelsPreference();
    window.addEventListener('focus', readReelsPreference);
    window.addEventListener('storage', readReelsPreference);
    return () => {
      window.removeEventListener('focus', readReelsPreference);
      window.removeEventListener('storage', readReelsPreference);
    };
  }, []);

  const locale = useMemo(() => resolveLocaleFromPathname(pathname), [pathname]);
  const isId = locale === 'id';

  const followingStorageKey = `${PROFILE_SOCIAL_STORAGE_KEY}:${user.id || 'me'}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(followingStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        setFollowedIds(
          Array.isArray(parsed)
            ? parsed.map(item => String(item)).filter(Boolean)
            : [],
        );
      } catch {
        setFollowedIds([]);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [followingStorageKey]);

  const persistFollowedIds = useCallback(
    (next: string[]) => {
      const unique = Array.from(new Set(next.filter(Boolean)));
      setFollowedIds(unique);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          followingStorageKey,
          JSON.stringify(unique),
        );
      } catch {
        // local follow state is best-effort until backend social graph exists.
      }
    },
    [followingStorageKey],
  );

  const toggleFollow = useCallback(
    (targetId: string) => {
      if (!targetId || targetId === user.id) return;
      const following = followedIds.includes(targetId);
      persistFollowedIds(
        following
          ? followedIds.filter(item => item !== targetId)
          : [...followedIds, targetId],
      );
    },
    [followedIds, persistFollowedIds, user.id],
  );

  const copy = useMemo(
    () =>
      isId
        ? {
            editQuick: 'Edit cepat',
            openPublic: 'Buka publik',
            copyLink: 'Salin link',
            copied: 'Link tersalin',
            copyFailed: 'Gagal menyalin',
            call: 'Telepon',
            chat: 'Chat',
            noPhone: 'No HP',
            overview: 'Ringkas',
            activity: 'Aktivitas',
            showcase: 'Etalase',
            cv: 'CV & Link',
            trust: 'Trust',
            activityTitle: 'Aktivitas Lajukan',
            activitySubtitle: PROMO_ONLY_MODE
              ? 'Reels, komunitas, listing, chat, dan data profil dibuat kelihatan dari satu profil.'
              : 'Reels, komunitas, listing, chat, dan transaksi dibuat kelihatan dari satu profil.',
            quickMoves: 'Satset dari profil',
            footprint: 'Jejak terbaru',
            signalMap: 'Sinyal minat',
            uploadReel: 'Buat Reels',
            reelsAction: 'Reels',
            reelsDesc: 'Buka Reels untuk upload, like, komentar, dan simpan.',
            communityAction: 'Komunitas',
            communityDesc:
              'Posting diskusi, foto/video, polling, dan ikut grup.',
            listingAction: 'Upload listing',
            listingDesc: 'Produk, jasa, properti, talent, rental, sampai UMKM.',
            dealAction: PROMO_ONLY_MODE ? 'Chat & minat' : 'Deal & chat',
            dealDesc: PROMO_ONLY_MODE
              ? 'Lanjut chat, simpan sinyal kebutuhan, dan rapikan listing dari pertanyaan user.'
              : 'Lanjut chat, negosiasi, transaksi, wallet, dan riwayat.',
            storeAction: 'Toko UMKM',
            storeDesc: PROMO_ONLY_MODE
              ? 'Kelola storefront, katalog, profil, dan chat usaha.'
              : 'Kelola storefront, katalog, order, QR, dan operasional.',
            profileAction: 'CV / Trust',
            profileDesc: 'Lengkapi skill, link, dokumen, dan verifikasi.',
            open: 'Buka',
            upload: 'Upload',
            create: 'Buat',
            manage: 'Kelola',
            noActivity: 'Belum ada jejak aktivitas',
            noActivityDesc:
              'Buat Reels, posting komunitas, atau buat listing. Nanti aktivitas penting tampil di sini.',
            completeProfile: 'Lengkapi profil',
            mainData: 'Data utama',
            publicProfile: 'Profil publik',
            setup: 'Setup satset',
            listings: 'Listing aktif',
            transactions: PROMO_ONLY_MODE ? 'Chat & minat' : 'Transaksi',
            professional: 'Profesional',
            skills: 'Skill',
            experience: 'Pengalaman',
            education: 'Pendidikan',
            links: 'Link',
            quickApply: 'Quick Apply',
            saveQuickApply: 'Simpan Quick Apply',
            uploadCv: 'Upload CV',
            verification: 'Verifikasi',
            social: 'Koneksi',
            followers: 'Pengikut',
            following: 'Mengikuti',
            findPeople: 'Cari orang',
            socialTitle: 'Koneksi profil',
            socialSubtitle:
              'Pengikut dan akun yang kamu ikuti akan tampil di sini saat sudah ada data.',
            emptyConnections: 'Belum ada koneksi',
            emptyFollowers: 'Belum ada pengikut yang tercatat.',
            emptyFollowing: 'Belum mengikuti siapa pun.',
            editFull: 'Edit lengkap',
            close: 'Tutup',
            save: 'Simpan',
          }
        : {
            editQuick: 'Quick edit',
            openPublic: 'Open public',
            copyLink: 'Copy link',
            copied: 'Link copied',
            copyFailed: 'Copy failed',
            call: 'Call',
            chat: 'Chat',
            noPhone: 'No phone',
            overview: 'Overview',
            activity: 'Activity',
            showcase: 'Showcase',
            cv: 'CV & Links',
            trust: 'Trust',
            activityTitle: 'Lajukan activity',
            activitySubtitle: PROMO_ONLY_MODE
              ? 'Reels, community, listings, chats, and profile data are visible from one profile.'
              : 'Reels, community, listings, chat, and transactions are visible from one profile.',
            quickMoves: 'Fast moves',
            footprint: 'Latest footprint',
            signalMap: 'Interest signals',
            uploadReel: 'Create Reels',
            reelsAction: 'Reels',
            reelsDesc: 'Open Reels to upload, like, comment, and save.',
            communityAction: 'Community',
            communityDesc:
              'Post discussions, photos/videos, polls, and join groups.',
            listingAction: 'Upload listing',
            listingDesc:
              'Products, services, property, talent, rental, and UMKM.',
            dealAction: PROMO_ONLY_MODE ? 'Chats & interest' : 'Deals & chat',
            dealDesc: PROMO_ONLY_MODE
              ? 'Continue chats, save demand signals, and improve listings from user questions.'
              : 'Continue chats, negotiations, transactions, wallet, and history.',
            storeAction: 'UMKM store',
            storeDesc: PROMO_ONLY_MODE
              ? 'Manage storefront, catalog, profile, and business chats.'
              : 'Manage storefront, catalog, orders, QR, and operations.',
            profileAction: 'CV / Trust',
            profileDesc: 'Complete skills, links, documents, and verification.',
            open: 'Open',
            upload: 'Upload',
            create: 'Create',
            manage: 'Manage',
            noActivity: 'No activity footprint yet',
            noActivityDesc:
              'Upload reels, post in community, or create a listing. Important activity will appear here.',
            completeProfile: 'Complete profile',
            mainData: 'Main data',
            publicProfile: 'Public profile',
            setup: 'Fast setup',
            listings: 'Active listings',
            transactions: PROMO_ONLY_MODE ? 'Chats' : 'Transactions',
            professional: 'Professional',
            skills: 'Skills',
            experience: 'Experience',
            education: 'Education',
            links: 'Links',
            quickApply: 'Quick Apply',
            saveQuickApply: 'Save Quick Apply',
            uploadCv: 'Upload CV',
            verification: 'Verification',
            social: 'Connections',
            followers: 'Followers',
            following: 'Following',
            findPeople: 'Find people',
            socialTitle: 'Profile connections',
            socialSubtitle:
              'Followers and accounts you follow will appear here once data exists.',
            emptyConnections: 'No connections yet',
            emptyFollowers: 'No recorded followers yet.',
            emptyFollowing: 'Not following anyone yet.',
            editFull: 'Full edit',
            close: 'Close',
            save: 'Save',
          },
    [isId],
  );

  const displayName =
    detail?.full_name ||
    detail?.fullName ||
    fullNameInput ||
    user.full_name ||
    user.phone ||
    user.email ||
    'Pengguna';
  const publicHandle = (
    usernameInput ||
    detail?.username ||
    user.username ||
    ''
  )
    .trim()
    .toLowerCase();
  const emailValue = String(detail?.email || user.email || '').trim();
  const phoneValue = String(
    phoneInput || detail?.phone || user.phone || '',
  ).trim();
  const locationValue = String(locationInput || detail?.location || '').trim();
  const headlineValue =
    professionalData.headline?.trim() ||
    (isId
      ? 'Profil siap dilihat. Tinggal dibuat makin jelas.'
      : 'Profile ready to view.');
  const summaryValue =
    bioInput.trim() ||
    professionalData.summary.trim() ||
    (isId
      ? 'Tambah ringkasan singkat supaya orang cepat paham.'
      : 'Add a short summary so people understand faster.');

  const metadataRecord = detail?.metadata || null;
  const profileRecord = detail?.profile || null;
  const metadataSocial = asSocialRecord(metadataRecord?.social);
  const profileSocial = asSocialRecord(profileRecord?.social);
  const metadataFollowerUsers = useMemo(
    () =>
      mergeSocialUsers(
        readSocialList(metadataRecord?.followers, isId),
        readSocialList(metadataSocial?.followers, isId),
        readSocialList(profileSocial?.followers, isId),
      ),
    [isId, metadataRecord, metadataSocial, profileSocial],
  );
  const metadataFollowingUsers = useMemo(
    () =>
      mergeSocialUsers(
        readSocialList(metadataRecord?.following, isId),
        readSocialList(metadataSocial?.following, isId),
        readSocialList(profileSocial?.following, isId),
      ),
    [isId, metadataRecord, metadataSocial, profileSocial],
  );
  const followingUsers = useMemo(
    () => metadataFollowingUsers,
    [metadataFollowingUsers],
  );
  const followerUsers = metadataFollowerUsers;
  const followerCount = Math.max(
    followerUsers.length,
    readSocialNumber(metadataRecord?.followers_count),
    readSocialNumber(metadataRecord?.follower_count),
    readSocialNumber(metadataSocial?.followers_count),
    readSocialNumber(profileSocial?.followers_count),
  );
  const followingCount = Math.max(
    followingUsers.length,
    readSocialNumber(metadataRecord?.following_count),
    readSocialNumber(metadataSocial?.following_count),
    readSocialNumber(profileSocial?.following_count),
  );
  const socialModalUsers =
    socialModal === 'followers' ? followerUsers : followingUsers;
  const socialModalTitle =
    socialModal === 'followers' ? copy.followers : copy.following;
  const socialModalEmpty =
    socialModal === 'followers' ? copy.emptyFollowers : copy.emptyFollowing;

  const publicProfilePath = useMemo(
    () =>
      buildPublicProfileHref(
        {
          id: detail?.id || user.id,
          username: publicHandle,
          full_name: fullNameInput || displayName,
        },
        `/${locale}/profile`,
      ),
    [detail?.id, displayName, fullNameInput, locale, publicHandle, user.id],
  );
  const publicProfileUrl = `${originBase}${publicProfilePath}`;

  const setupPercent = useMemo(() => {
    const total = setupCards.reduce((sum, item) => sum + item.total, 0);
    const progress = setupCards.reduce((sum, item) => sum + item.progress, 0);
    return total > 0 ? Math.round((progress / total) * 100) : 0;
  }, [setupCards]);

  const verificationRecord = useMemo(
    () => readIdentityVerification(verificationSource),
    [verificationSource],
  );
  const trustReady =
    verificationRecord?.status === 'approved' ||
    Boolean(verificationRecord?.phone_verified);

  const listingCounts = useMemo(() => {
    const counts: Record<ProfileContentTab, number> = {
      all: listings.length,
      job: 0,
      freelancer: 0,
      product: 0,
      service: 0,
      tool_rental: 0,
      business_transfer: 0,
      property: 0,
      umkm: 0,
    };
    for (const item of listings) {
      counts[classifyListing(item)] += 1;
    }
    return counts;
  }, [listings]);

  const filteredListings = useMemo(
    () =>
      activeMarketplaceTab === 'all'
        ? listings
        : listings.filter(
            item => classifyListing(item) === activeMarketplaceTab,
          ),
    [activeMarketplaceTab, listings],
  );

  const visibleContentTabs = useMemo(
    () =>
      PROFILE_CONTENT_TABS.filter(
        item => item.key === 'all' || listingCounts[item.key] > 0,
      ),
    [listingCounts],
  );

  const activityActions = useMemo(
    () => [
      {
        key: 'upload-reels',
        title: copy.uploadReel,
        description: copy.reelsDesc,
        href: '/reels',
        icon: Clapperboard,
        metric:
          reelsSignalCount > 0
            ? `${reelsSignalCount.toLocaleString(locale)} ${isId ? 'sinyal' : 'signals'}`
            : isId
              ? 'Like / repost'
              : 'Like / repost',
        actionLabel: copy.upload,
      },
      {
        key: 'reels',
        title: copy.reelsAction,
        description: isId
          ? 'Lihat FYP, like, simpan, share, dan DM creator dari reels.'
          : 'Open FYP, like, save, share, and DM creators from reels.',
        href: '/reels',
        icon: Heart,
        metric: isId ? 'Like + share' : 'Like + share',
        actionLabel: copy.open,
      },
      {
        key: 'community',
        title: copy.communityAction,
        description: copy.communityDesc,
        href: '/community?compose=post',
        icon: Users,
        metric: isId ? 'Post / grup' : 'Post / groups',
        actionLabel: copy.create,
      },
      {
        key: 'listing',
        title: copy.listingAction,
        description: copy.listingDesc,
        href: '/create',
        icon: Upload,
        metric: `${listings.length.toLocaleString(locale)} ${isId ? 'aktif' : 'active'}`,
        actionLabel: copy.create,
      },
      {
        key: 'deal',
        title: copy.dealAction,
        description: copy.dealDesc,
        href: PROMO_ONLY_MODE ? '/chat' : '/transactions',
        icon: MessageCircle,
        metric: PROMO_ONLY_MODE
          ? isId
            ? 'Inbox aktif'
            : 'Active inbox'
          : `${txPreview.length.toLocaleString(locale)} ${isId ? 'terbaru' : 'latest'}`,
        actionLabel: copy.open,
      },
      {
        key: 'umkm',
        title: copy.storeAction,
        description: copy.storeDesc,
        href: '/home',
        icon: Store,
        metric: PROMO_ONLY_MODE
          ? isId
            ? 'Toko + chat'
            : 'Store + chats'
          : isId
            ? 'Toko + order'
            : 'Store + orders',
        actionLabel: copy.manage,
      },
      {
        key: 'profile',
        title: copy.profileAction,
        description: copy.profileDesc,
        href: '/profile/edit?focus=talent',
        icon: ShieldCheck,
        metric: `${setupPercent}% ${isId ? 'siap' : 'ready'}`,
        actionLabel: copy.open,
      },
    ],
    [
      copy,
      isId,
      listings.length,
      locale,
      reelsSignalCount,
      setupPercent,
      txPreview.length,
    ],
  );

  const activityMetrics = useMemo(
    () => [
      {
        label: isId ? 'Interaksi reels' : 'Reels interactions',
        value: reelsSignalCount.toLocaleString(locale),
        hint: isId ? 'like/share/save' : 'like/share/save',
        icon: Clapperboard,
      },
      {
        label: isId ? 'Listing aktif' : 'Active listings',
        value: listings.length.toLocaleString(locale),
        hint: isId ? 'etalase' : 'showcase',
        icon: Upload,
      },
      ...(!PROMO_ONLY_MODE
        ? [
            {
              label: isId ? 'Transaksi terbaru' : 'Latest deals',
              value: txPreview.length.toLocaleString(locale),
              hint: isId ? 'deal' : 'deals',
              icon: BarChart3,
            },
          ]
        : []),
      {
        label: isId ? 'Profil siap' : 'Profile ready',
        value: `${setupPercent}%`,
        hint: isId ? 'trust' : 'trust',
        icon: ShieldCheck,
      },
    ],
    [
      isId,
      listings.length,
      locale,
      reelsSignalCount,
      setupPercent,
      txPreview.length,
    ],
  );

  const activityTimeline = useMemo(() => {
    const rows: Array<{
      key: string;
      title: string;
      description: string;
      href: string;
      icon: LucideIcon;
    }> = [];

    if (reelsSignalCount > 0) {
      rows.push({
        key: 'reels-signal',
        title: isId ? 'Reels mulai kebaca' : 'Reels signals learned',
        description: isId
          ? `${reelsSignalCount.toLocaleString(locale)} aksi watch/like/share/save`
          : `${reelsSignalCount.toLocaleString(locale)} watch/like/share/save actions`,
        href: '/reels',
        icon: Heart,
      });
    }

    for (const item of listings.slice(0, 3)) {
      rows.push({
        key: `listing-${item.id}`,
        title: item.title || (isId ? 'Listing aktif' : 'Active listing'),
        description: `${getProfileContentTabLabel(classifyListing(item), locale)} - ${formatDate(item.created_at)}`,
        href: '/my-listings',
        icon: Upload,
      });
    }

    if (!PROMO_ONLY_MODE) {
      for (const item of txPreview.slice(0, 2)) {
        rows.push({
          key: `tx-${item.id}`,
          title: formatMoneyFromCents(
            item.amount_cents,
            item.currency || 'IDR',
          ),
          description: `${item.status || 'pending'} - ${formatDate(item.created_at)}`,
          href: '/transactions',
          icon: MessageCircle,
        });
      }
    }

    if (setupPercent > 0) {
      rows.push({
        key: 'profile-setup',
        title: isId ? 'Profil makin siap' : 'Profile getting ready',
        description: `${setupPercent}% ${isId ? 'kelengkapan profil' : 'profile completion'}`,
        href: '/profile/edit?focus=identity',
        icon: Sparkles,
      });
    }

    return rows.slice(0, 6);
  }, [
    formatDate,
    formatMoneyFromCents,
    isId,
    listings,
    locale,
    reelsSignalCount,
    setupPercent,
    txPreview,
  ]);

  const hubTabs: Array<{ key: HubTab; label: string; icon: LucideIcon }> = [
    { key: 'ringkas', label: copy.overview, icon: Sparkles },
    { key: 'aktivitas', label: copy.activity, icon: BarChart3 },
    { key: 'etalase', label: copy.showcase, icon: BriefcaseBusiness },
    { key: 'cv', label: copy.cv, icon: ClipboardList },
    { key: 'reels', label: 'Reels', icon: Clapperboard },
    { key: 'komunitas', label: copy.communityAction, icon: Users },
    { key: 'trust', label: copy.trust, icon: ShieldCheck },
  ];

  const copyPublicProfileUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setCopyMessage(copy.copied);
    } catch {
      setCopyMessage(copy.copyFailed);
    }
  };

  const importantSetup = [
    {
      label: isId ? 'Nama' : 'Name',
      done: Boolean(fullNameInput.trim() || displayName),
    },
    {
      label: isId ? 'Foto' : 'Photo',
      done: Boolean(effectiveAvatarUrl),
    },
    {
      label: isId ? 'Lokasi' : 'Location',
      done: Boolean(locationValue),
    },
    {
      label: isId ? 'Cerita singkat' : 'Short intro',
      done: Boolean(bioInput.trim() || professionalData.summary.trim()),
    },
  ];
  const previewListings = listings.slice(0, 3);
  const simpleProfileIntro = isId
    ? 'Layar awal cukup jawab 3 hal: siapa kamu, ada postingan apa, dan bisa dihubungi lewat mana.'
    : 'The first screen should answer 3 things: who you are, what you show, and how people can reach you.';
  const simpleProfileTitle = isId
    ? 'Profil promosi kamu'
    : 'Your promo profile';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f3ec] pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-slate-950 dark:bg-slate-950 dark:text-white sm:pb-10">
      <div className="page-shell page-shell-inset py-3 sm:py-5">
        <div className="mx-auto grid w-full max-w-[1040px] gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#fffdf7_0%,#f2fff7_56%,#fff7e7_100%)] p-4 shadow-[0_20px_52px_-44px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0f172a_0%,#06281d_60%,#1c1917_100%)] sm:p-5 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                  {isId ? 'Profil sederhana' : 'Simple profile'}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.055em] text-slate-950 dark:text-white sm:text-3xl">
                  {simpleProfileTitle}
                </h1>
                <p className="mt-2 line-clamp-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  {simpleProfileIntro}
                </p>
              </div>
              <LocalizedLink
                href="/create"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Upload className="h-4 w-4" />
                {isId ? 'Buat postingan' : 'Create post'}
              </LocalizedLink>
            </div>
          </section>

          <main className="min-w-0 space-y-3">
            <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_54px_-42px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-900">
              <div className="relative h-32 bg-emerald-100 sm:h-44">
                {effectiveCoverUrl ? (
                  <Image
                    src={effectiveCoverUrl}
                    alt="Sampul profil"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(135deg,#d9f99d_0%,#99f6e4_48%,#fed7aa_100%)] dark:bg-[linear-gradient(135deg,#064e3b_0%,#0f172a_58%,#78350f_100%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/28" />
                <label
                  htmlFor="simple-profile-cover-upload"
                  className="absolute right-3 top-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white/92 px-3 text-xs font-black text-slate-800 shadow-sm backdrop-blur transition hover:bg-white dark:bg-slate-950/82 dark:text-white"
                >
                  {coverUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {isId ? 'Ganti sampul' : 'Change cover'}
                  <input
                    id="simple-profile-cover-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onCoverFileChange}
                  />
                </label>
              </div>

              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="-mt-10 relative h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border-4 border-white bg-slate-100 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.6)] dark:border-slate-900 dark:bg-slate-800 sm:-mt-12 sm:h-24 sm:w-24 lg:h-28 lg:w-28">
                      <Image
                        src={profileAvatarSrc(effectiveAvatarUrl)}
                        alt={displayName}
                        fill
                        sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 80px"
                        className="object-cover"
                        unoptimized
                      />
                      <label
                        htmlFor="simple-profile-avatar-upload"
                        className="absolute inset-x-1.5 bottom-1.5 inline-flex min-h-7 cursor-pointer items-center justify-center rounded-full bg-slate-950/72 px-2 text-[10px] font-black text-white backdrop-blur transition hover:bg-slate-950/86 sm:inset-x-2 sm:bottom-2 sm:px-2.5"
                      >
                        {avatarUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isId ? (
                          'Foto'
                        ) : (
                          'Photo'
                        )}
                        <input
                          id="simple-profile-avatar-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={onAvatarFileChange}
                        />
                      </label>
                    </div>
                    <div className="min-w-0 pb-0 sm:pb-1">
                      <h1 className="truncate text-2xl font-black tracking-[-0.05em] text-slate-950 dark:text-white sm:text-3xl">
                        {displayName}
                      </h1>
                      {publicHandle ? (
                        <p className="mt-0.5 truncate text-xs font-black text-emerald-700 dark:text-emerald-300">
                          @{publicHandle}
                        </p>
                      ) : null}
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
                        {headlineValue}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {phoneValue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 dark:bg-orange-400/12 dark:text-orange-200">
                            <Phone className="h-3 w-3" />
                            {phoneValue}
                          </span>
                        ) : null}
                        {locationValue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                            <MapPin className="h-3 w-3" />
                            {locationValue}
                          </span>
                        ) : null}
                        {trustReady ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:bg-sky-400/12 dark:text-sky-200">
                            <BadgeCheck className="h-3 w-3" />
                            {isId ? 'Terverifikasi' : 'Verified'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end md:pt-0">
                    {avatarBuilder ? (
                      <button
                        type="button"
                        onClick={() => setQuickEditOpen(true)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {isId ? 'Avatar 2D' : '2D avatar'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={copyPublicProfileUrl}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {copyMessage || copy.copyLink}
                    </button>
                    <LocalizedLink
                      href={publicProfilePath}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {isId ? 'Lihat publik' : 'Public'}
                    </LocalizedLink>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] bg-[#f7f4ed] p-3 dark:bg-white/[0.04]">
                  <p className="line-clamp-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">
                    {summaryValue}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  {isId ? 'Edit profil' : 'Edit profile'}
                </p>
                <h2 className="text-lg font-black tracking-[-0.03em]">
                  {isId
                    ? 'Cukup isi yang orang perlu tahu.'
                    : 'Only fill what people need to know.'}
                </h2>
                <p className="text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                  {isId
                    ? 'Tidak perlu ribet. Nama, lokasi, nomor, dan cerita singkat sudah cukup untuk mulai promosi.'
                    : 'No need to complete everything. Name, location, phone, and a short intro are enough to start.'}
                </p>
              </div>

              {avatarBuilder ? (
                <div className="mt-4">{avatarBuilder}</div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-black">
                    {isId ? 'Nama tampil' : 'Display name'}
                  </span>
                  <input
                    value={fullNameInput}
                    onChange={event => onFullNameChange(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder={
                      isId ? 'Contoh: Warung Bu Sari' : 'Example: Sari Store'
                    }
                    autoComplete="name"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-black">
                    {isId ? 'Nomor HP' : 'Phone number'}
                  </span>
                  <input
                    value={phoneInput}
                    onChange={event => onPhoneChange(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder="08xxxxxxxxxx"
                    autoComplete="tel"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-black">
                    {isId ? 'Lokasi' : 'Location'}
                  </span>
                  <input
                    value={locationInput}
                    onChange={event => onLocationChange(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder={isId ? 'Kota / Kecamatan' : 'City / district'}
                    autoComplete="address-level2"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-black">
                    {isId ? 'Link profil' : 'Profile link'}
                  </span>
                  <input
                    value={usernameInput}
                    onChange={event => onUsernameChange(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder="nama-usaha"
                    autoComplete="username"
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-black">
                    {isId ? 'Cerita singkat' : 'Short intro'}
                  </span>
                  <textarea
                    value={bioInput}
                    onChange={event => onBioChange(event.target.value)}
                    rows={4}
                    className={INPUT_CLASS}
                    placeholder={
                      isId
                        ? 'Contoh: Jual snack rumahan, katering harian, dan bisa pesan untuk acara kecil.'
                        : 'Example: Home-made snacks, daily catering, and small event orders.'
                    }
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onSaveProfile}
                  disabled={saving || avatarUploading || coverUploading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isId ? 'Simpan profil' : 'Save profile'}
                </button>
                {saveMessage ? (
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {saveMessage}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                    {isId ? 'Postingan' : 'Posts'}
                  </p>
                  <h2 className="text-lg font-black tracking-[-0.03em]">
                    {isId
                      ? 'Yang sedang kamu tampilkan.'
                      : 'What you are showing.'}
                  </h2>
                </div>
                <LocalizedLink
                  href="/create"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 text-xs font-black text-white dark:bg-white dark:text-slate-950"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isId ? 'Posting' : 'Post'}
                </LocalizedLink>
              </div>

              {previewListings.length === 0 ? (
                <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-[#f7f4ed] p-4 text-center dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-sm font-black">
                    {isId
                      ? 'Belum ada postingan aktif.'
                      : 'No active posts yet.'}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    {isId
                      ? 'Buat satu postingan produk, jasa, atau kebutuhan agar orang bisa menemukan kamu.'
                      : 'Create one product, service, or need post so people can find you.'}
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {previewListings.map(item => (
                    <LocalizedLink
                      key={item.id}
                      href="/my-listings"
                      className="flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-[#f7f4ed] px-3 py-3 transition hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          {item.title ||
                            (isId ? 'Postingan tanpa judul' : 'Untitled post')}
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {(item.content_type || 'post').toUpperCase()} -{' '}
                          {formatDate(item.created_at)}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </LocalizedLink>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-3 lg:sticky lg:top-[calc(88px+env(safe-area-inset-top))] lg:self-start">
            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {isId ? 'Profil siap' : 'Profile ready'}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {setupPercent}% {isId ? 'terisi' : 'complete'}
                  </p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-[18px] bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
                  <Sparkles className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={setupPercent} />
              </div>
              <div className="mt-3 grid gap-2">
                {importantSetup.map(item => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-[15px] bg-[#f7f4ed] px-3 py-2 dark:bg-white/[0.04]"
                  >
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        {isId ? 'Belum' : 'Missing'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm font-black">
                {isId ? 'Butuh apa sekarang?' : 'What do you need now?'}
              </p>
              <div className="mt-3 grid gap-2">
                <LocalizedLink
                  href="/chat"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isId ? 'Buka chat' : 'Open chat'}
                </LocalizedLink>
                <LocalizedLink
                  href="/my-listings"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white"
                >
                  <Store className="h-4 w-4" />
                  {isId ? 'Kelola postingan' : 'Manage posts'}
                </LocalizedLink>
                {dialPhone ? (
                  <a
                    href={`tel:${dialPhone}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white"
                  >
                    <Phone className="h-4 w-4" />
                    {isId ? 'Telepon' : 'Call'}
                  </a>
                ) : null}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm font-black">
                {isId ? 'Kontak' : 'Contact'}
              </p>
              <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex min-w-0 items-center gap-2 rounded-[15px] bg-[#f7f4ed] px-3 py-2 dark:bg-white/[0.04]">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span className="truncate">{emailValue || '-'}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-[15px] bg-[#f7f4ed] px-3 py-2 dark:bg-white/[0.04]">
                  <Phone className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span className="truncate">{phoneValue || '-'}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-[15px] bg-[#f7f4ed] px-3 py-2 dark:bg-white/[0.04]">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span className="truncate">{locationValue || '-'}</span>
                </div>
              </div>
            </section>

            {profileError ? (
              <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                {profileError}
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );

  return (
    <div className={PAGE_CLASS}>
      <div className="page-shell overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-1 sm:gap-4 sm:px-2 lg:px-0">
          <section className={cn(CARD_CLASS, 'overflow-hidden rounded-[24px]')}>
            <div className="relative h-32 bg-[color:var(--app-surface-muted)] sm:h-40 lg:h-44">
              {effectiveCoverUrl ? (
                <Image
                  src={effectiveCoverUrl}
                  alt="Profile cover"
                  fill
                  sizes="100vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(135deg,#f8fafc_0%,#e0f2fe_45%,#dcfce7_100%)] dark:bg-[linear-gradient(135deg,#0f172a_0%,#164e63_48%,#14532d_100%)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.18)_48%,rgba(15,23,42,0.58)_100%)]" />
              <label
                htmlFor="profile-cover-upload"
                className="absolute right-2 top-2 inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-2.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-950/90 dark:text-slate-100 sm:right-3 sm:top-3 sm:min-h-[34px] sm:px-3"
                title={isId ? 'Ganti sampul' : 'Change cover'}
              >
                {coverUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isId ? 'Sampul' : 'Cover'}
                </span>
              </label>
              <input
                id="profile-cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onCoverFileChange}
                disabled={coverUploading || saving}
              />
            </div>

            <div className="px-3 pb-4 sm:px-4 sm:pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start lg:flex-1">
                  <div className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border-[4px] border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-[0_18px_34px_-24px_rgba(15,23,42,0.55)] sm:-mt-12 sm:h-24 sm:w-24">
                    <Image
                      src={profileAvatarSrc(effectiveAvatarUrl)}
                      alt={displayName}
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                    <label
                      htmlFor="profile-avatar-upload"
                      className="absolute bottom-1 right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] shadow ring-1 ring-[color:var(--app-border)]"
                      title={isId ? 'Ganti foto' : 'Change photo'}
                    >
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </label>
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onAvatarFileChange}
                      disabled={avatarUploading || saving}
                    />
                  </div>

                  <div className="min-w-0 flex-1 pt-0 sm:pt-1 lg:pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h1 className="min-w-0 max-w-full break-words text-2xl font-black leading-tight text-[color:var(--app-text)] [overflow-wrap:anywhere] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                        {displayName}
                      </h1>
                      <span className="inline-flex max-w-full items-center rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-accent)] sm:text-xs">
                        <span className="min-w-0 truncate">
                          @{publicHandle || 'profil'}
                        </span>
                      </span>
                      {trustReady ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-success)] sm:text-xs">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {isId ? 'Trusted' : 'Trusted'}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 max-w-2xl break-words text-sm font-semibold leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-[15px]">
                      {headlineValue}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {locationValue ? (
                        <IconPill icon={MapPin} muted>
                          {locationValue}
                        </IconPill>
                      ) : null}
                      {phoneValue ? (
                        <IconPill icon={Phone} muted>
                          {phoneValue}
                        </IconPill>
                      ) : null}
                    </div>
                    <div className="mt-3 grid max-w-[320px] grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSocialModal('followers')}
                        className={cn(
                          MUTED_ROW_CLASS,
                          'min-w-0 px-3 py-2 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
                        )}
                      >
                        <span className="block truncate text-sm font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                          {followerCount.toLocaleString(locale)}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                          {copy.followers}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSocialModal('following')}
                        className={cn(
                          MUTED_ROW_CLASS,
                          'min-w-0 px-3 py-2 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
                        )}
                      >
                        <span className="block truncate text-sm font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                          {followingCount.toLocaleString(locale)}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                          {copy.following}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid w-full shrink-0 grid-cols-2 gap-2 lg:w-[330px] xl:w-[370px]">
                  <button
                    type="button"
                    onClick={() => setQuickEditOpen(true)}
                    className={PRIMARY_ACTION_CLASS}
                  >
                    <User2 className="h-4 w-4" />
                    {isId ? 'Edit profil' : 'Edit profile'}
                  </button>
                  <a
                    href={publicProfileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {copy.openPublic}
                  </a>
                  <LocalizedLink href="/home" className={TONAL_ACTION_CLASS}>
                    <Upload className="h-4 w-4" />
                    {copy.listingAction}
                  </LocalizedLink>
                  {/* <LocalizedLink
                    href="/reels"
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <Clapperboard className="h-4 w-4" />
                    {copy.uploadReel}
                  </LocalizedLink> */}
                </div>
              </div>
            </div>
          </section>

          {saveMessage ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-accent)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          ) : null}

          {profileError ? (
            <div className="rounded-lg bg-[color:var(--app-warning-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-warning)]">
              {profileError}
            </div>
          ) : null}

          <StatStrip items={statItems} />

          <ProfileGameProgress
            isId={isId}
            setupPercent={setupPercent}
            listingsCount={listings.length}
            txCount={txPreview.length}
            reelsSignalCount={reelsSignalCount}
            trustReady={trustReady}
          />

          <div
            className={cn(
              CARD_CLASS,
              'sticky top-[calc(52px+env(safe-area-inset-top))] z-20 overflow-x-auto px-2 py-1.5 sm:top-[calc(60px+env(safe-area-inset-top))] sm:px-2.5',
            )}
          >
            <div className="flex min-w-max gap-1.5 sm:gap-2">
              {hubTabs.map(item => (
                <ProfileTabButton
                  key={item.key}
                  active={activeHubTab === item.key}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => setActiveHubTab(item.key)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-2.5">
              {activeHubTab === 'ringkas' ? (
                <>
                  <SectionBlock
                    title={copy.mainData}
                    tone="profile"
                    action={
                      <LocalizedLink
                        href="/profile/edit?focus=identity"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {copy.editFull}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={cn(MUTED_ROW_CLASS, 'p-2.5')}>
                        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                          {isId ? 'Ringkasan' : 'Summary'}
                        </p>
                        <p className="mt-1 text-[13px] font-semibold leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {summaryValue}
                        </p>
                      </div>
                      <div className={cn(MUTED_ROW_CLASS, 'p-2.5')}>
                        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                          {isId ? 'Kontak' : 'Contact'}
                        </p>
                        <div className="mt-1.5 space-y-1.5 text-[13px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          <div className="flex min-w-0 items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                            <span className="min-w-0 truncate">
                              {emailValue || '-'}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                            <span className="min-w-0 truncate">
                              {phoneValue || '-'}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                            <span className="min-w-0 truncate">
                              {locationValue || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionBlock>
                </>
              ) : null}

              {activeHubTab === 'aktivitas' ? (
                <>
                  <SectionBlock
                    title={copy.activityTitle}
                    subtitle={copy.activitySubtitle}
                    tone="activity"
                    action={
                      <LocalizedLink
                        href="/community?compose=post"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {copy.create}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {activityActions.map(item => (
                        <ActivityActionCard
                          key={item.key}
                          title={item.title}
                          description={item.description}
                          href={item.href}
                          icon={item.icon}
                          metric={item.metric}
                          actionLabel={item.actionLabel}
                        />
                      ))}
                    </div>
                  </SectionBlock>

                  <SectionBlock
                    title={copy.signalMap}
                    tone="insight"
                    subtitle={
                      isId
                        ? 'Yang pernah kamu buka, like, save, share, listing, dan deal.'
                        : 'What you open, like, save, share, list, and deal with.'
                    }
                  >
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {activityMetrics.map(item => (
                        <ActivityMetricCard
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          hint={item.hint}
                          icon={item.icon}
                        />
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                        <Repeat2 className="h-3.5 w-3.5" />
                        {isId ? 'Share / repost reels' : 'Share / repost reels'}
                      </span>
                      <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        {isId ? 'Komentar komunitas' : 'Community comments'}
                      </span>
                      {reelsPreferenceTags.length > 0
                        ? reelsPreferenceTags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex min-h-[30px] items-center rounded-full bg-[color:var(--app-accent-soft)] px-2.5 text-[11px] font-semibold text-[color:var(--app-accent)]"
                            >
                              #{tag}
                            </span>
                          ))
                        : null}
                    </div>
                  </SectionBlock>

                  <SectionBlock
                    title={copy.footprint}
                    tone="social"
                    subtitle={
                      isId
                        ? 'Ringkas saja, biar orang langsung tahu aktivitas pentingmu.'
                        : 'Compact, so people quickly understand important activity.'
                    }
                  >
                    {activityTimeline.length === 0 ? (
                      <EmptyState
                        title={copy.noActivity}
                        description={copy.noActivityDesc}
                        action={
                          <div className="flex flex-wrap justify-center gap-2">
                            <LocalizedLink
                              href="/reels"
                              className={TONAL_ACTION_CLASS}
                            >
                              <Clapperboard className="h-4 w-4" />
                              {copy.uploadReel}
                            </LocalizedLink>
                            <LocalizedLink
                              href="/create"
                              className={TONAL_ACTION_CLASS}
                            >
                              <Upload className="h-4 w-4" />
                              {copy.listingAction}
                            </LocalizedLink>
                          </div>
                        }
                      />
                    ) : (
                      <div className="space-y-2">
                        {activityTimeline.map(item => (
                          <ActivityTimelineRow
                            key={item.key}
                            title={item.title}
                            description={item.description}
                            href={item.href}
                            icon={item.icon}
                          />
                        ))}
                      </div>
                    )}
                  </SectionBlock>
                </>
              ) : null}

              {activeHubTab === 'reels' ? (
                <>
                  <SectionBlock
                    title={copy.reelsAction}
                    subtitle={copy.reelsDesc}
                    tone="activity"
                    action={
                      <LocalizedLink
                        href="/reels"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {copy.uploadReel}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activityActions
                        .filter(item =>
                          ['upload-reels', 'reels'].includes(item.key),
                        )
                        .map(item => (
                          <ActivityActionCard
                            key={item.key}
                            title={item.title}
                            description={item.description}
                            href={item.href}
                            icon={item.icon}
                            metric={item.metric}
                            actionLabel={item.actionLabel}
                          />
                        ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {activityMetrics
                        .filter(item =>
                          [
                            copy.reelsAction,
                            isId ? 'Interaksi reels' : 'Reels interactions',
                          ].includes(item.label),
                        )
                        .map(item => (
                          <ActivityMetricCard
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            hint={item.hint}
                            icon={item.icon}
                          />
                        ))}
                      <ActivityMetricCard
                        label={isId ? 'Minat terbaca' : 'Known interests'}
                        value={reelsPreferenceTags.length.toLocaleString(
                          locale,
                        )}
                        hint={isId ? 'tag reels' : 'reels tags'}
                        icon={Heart}
                      />
                    </div>
                    {reelsPreferenceTags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {reelsPreferenceTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex min-h-[32px] items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-semibold text-[color:var(--app-accent)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </SectionBlock>
                </>
              ) : null}

              {activeHubTab === 'komunitas' ? (
                <>
                  <SectionBlock
                    title={copy.communityAction}
                    subtitle={copy.communityDesc}
                    tone="social"
                    action={
                      <LocalizedLink
                        href="/community?compose=post"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {copy.create}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activityActions
                        .filter(item => item.key === 'community')
                        .map(item => (
                          <ActivityActionCard
                            key={item.key}
                            title={item.title}
                            description={item.description}
                            href={item.href}
                            icon={item.icon}
                            metric={item.metric}
                            actionLabel={item.actionLabel}
                          />
                        ))}
                      <ActivityActionCard
                        title={isId ? 'Cari grup' : 'Find groups'}
                        description={
                          isId
                            ? 'Masuk grup yang sesuai minat usaha.'
                            : 'Join groups that match your business interests.'
                        }
                        href="/community"
                        icon={Users}
                        metric={isId ? 'Diskusi aktif' : 'Active talks'}
                        actionLabel={copy.open}
                      />
                    </div>
                  </SectionBlock>

                  <SectionBlock
                    title={copy.footprint}
                    tone="social"
                    subtitle={
                      isId
                        ? 'Postingan dan diskusi penting akan muncul di sini.'
                        : 'Important posts and discussions will appear here.'
                    }
                  >
                    {activityTimeline.length === 0 ? (
                      <EmptyState
                        title={copy.noActivity}
                        description={copy.noActivityDesc}
                        action={
                          <LocalizedLink
                            href="/community?compose=post"
                            className={TONAL_ACTION_CLASS}
                          >
                            <MessageSquareText className="h-4 w-4" />
                            {copy.create}
                          </LocalizedLink>
                        }
                      />
                    ) : (
                      <div className="space-y-2">
                        {activityTimeline.slice(0, 4).map(item => (
                          <ActivityTimelineRow
                            key={item.key}
                            title={item.title}
                            description={item.description}
                            href={item.href}
                            icon={item.icon}
                          />
                        ))}
                      </div>
                    )}
                  </SectionBlock>
                </>
              ) : null}

              {activeHubTab === 'etalase' ? (
                <>
                  <SectionBlock
                    title={copy.listings}
                    tone="market"
                    subtitle={
                      isId
                        ? 'Produk, jasa, talent, jobs, dan kebutuhan aktif.'
                        : 'Products, services, talent, jobs, and active needs.'
                    }
                    action={
                      <LocalizedLink
                        href="/my-listings"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {isId ? 'Lihat semua' : 'View all'}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="mb-3 overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        {visibleContentTabs.map(item => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              onActiveMarketplaceTabChange(item.key)
                            }
                            className={cn(
                              'inline-flex min-h-[36px] items-center gap-2 rounded-full px-3 text-xs font-semibold transition',
                              activeMarketplaceTab === item.key
                                ? 'bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)]'
                                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]',
                            )}
                          >
                            {getProfileContentTabLabel(item.key, locale)}
                            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">
                              {listingCounts[item.key]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredListings.length === 0 ? (
                      <EmptyState
                        title={
                          getProfileContentTabDefinition(activeMarketplaceTab)
                            .emptyTitleId
                        }
                        description={
                          getProfileContentTabDefinition(activeMarketplaceTab)
                            .emptyDescriptionId
                        }
                        action={
                          <LocalizedLink
                            href={
                              getProfileContentTabDefinition(
                                activeMarketplaceTab,
                              ).createHref
                            }
                            className={TONAL_ACTION_CLASS}
                          >
                            <ClipboardList className="h-4 w-4" />
                            {
                              getProfileContentTabDefinition(
                                activeMarketplaceTab,
                              ).addLabelId
                            }
                          </LocalizedLink>
                        }
                      />
                    ) : (
                      <div className="space-y-2">
                        {filteredListings.slice(0, 6).map(item => (
                          <div
                            key={item.id}
                            className={cn(MUTED_ROW_CLASS, 'p-2.5')}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                  {item.title ||
                                    (isId
                                      ? 'Listing tanpa judul'
                                      : 'Untitled listing')}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                                  {getProfileContentTabLabel(
                                    classifyListing(item),
                                    locale,
                                  )}{' '}
                                  - {formatDate(item.created_at)}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-muted)]">
                                {item.content_status || item.status || 'active'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionBlock>

                  {!PROMO_ONLY_MODE ? (
                    <SectionBlock
                      title={copy.transactions}
                      tone="trust"
                      subtitle={
                        isId
                          ? 'Riwayat paling baru, cukup yang penting.'
                          : 'Latest history, only the important bits.'
                      }
                      action={
                        <LocalizedLink
                          href="/transactions"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                        >
                          {isId ? 'Buka' : 'Open'}
                          <ChevronRight className="h-4 w-4" />
                        </LocalizedLink>
                      }
                    >
                      {txPreview.length === 0 ? (
                        <EmptyState
                          title={
                            isId ? 'Belum ada transaksi' : 'No transactions yet'
                          }
                          description={
                            isId
                              ? 'Transaksi baru akan muncul di sini.'
                              : 'New transactions will appear here.'
                          }
                        />
                      ) : (
                        <div className="space-y-2">
                          {txPreview.map(item => (
                            <div
                              key={item.id}
                              className={cn(MUTED_ROW_CLASS, 'p-2.5')}
                            >
                              <div className="flex items-center justify-between gap-2.5">
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                    {formatMoneyFromCents(
                                      item.amount_cents,
                                      item.currency || 'IDR',
                                    )}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                                    {formatDate(item.created_at)}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-muted)]">
                                  {item.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionBlock>
                  ) : null}
                </>
              ) : null}

              {activeHubTab === 'cv' ? (
                <>
                  <SectionBlock
                    title={copy.professional}
                    tone="work"
                    subtitle={
                      isId
                        ? 'Dibaca seperti LinkedIn/Upwork, tapi tetap pendek.'
                        : 'Reads like LinkedIn/Upwork, but compact.'
                    }
                    action={
                      <LocalizedLink
                        href="/profile/edit?focus=talent"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--app-accent)]"
                      >
                        {copy.editFull}
                        <ChevronRight className="h-4 w-4" />
                      </LocalizedLink>
                    }
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-[13px] font-semibold leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-sm">
                          {summaryValue}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1.5 text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {copy.skills}
                        </p>
                        {professionalData.skills.length === 0 ? (
                          <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                            {isId ? 'Belum ada skill.' : 'No skills yet.'}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {professionalData.skills.slice(0, 12).map(skill => (
                              <span
                                key={skill}
                                className="rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] sm:text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2.5 lg:grid-cols-2">
                        <div>
                          <p className="mb-1.5 text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {copy.experience}
                          </p>
                          <EntryList
                            items={professionalData.experiences}
                            empty={
                              isId
                                ? 'Belum ada pengalaman.'
                                : 'No experience yet.'
                            }
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {copy.education}
                          </p>
                          <EntryList
                            items={[
                              ...professionalData.education,
                              ...professionalData.certifications,
                            ]}
                            empty={
                              isId
                                ? 'Belum ada pendidikan/sertifikat.'
                                : 'No education or certificates yet.'
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </SectionBlock>

                  <SectionBlock
                    title={copy.quickApply}
                    tone="work"
                    subtitle={
                      isId
                        ? 'Simpan data lamaran biar daftar kerja lebih cepat.'
                        : 'Save application data for faster job apply.'
                    }
                  >
                    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <label className="block min-w-0 space-y-1.5">
                        <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {copy.uploadCv}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={event =>
                            onQuickApplyResumeChange(
                              event.target.files?.[0] || null,
                            )
                          }
                          className="block w-full text-xs text-[color:var(--app-text)] file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--app-accent-soft)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                        />
                        {qaResumeUrl ? (
                          <a
                            href={qaResumeUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-[color:var(--app-accent)]"
                          >
                            <span className="min-w-0 truncate">
                              {shortenUrl(qaResumeUrl)}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : null}
                      </label>
                      <button
                        type="button"
                        onClick={onSaveQuickApply}
                        disabled={qaSaving}
                        className={PRIMARY_ACTION_CLASS}
                      >
                        {qaSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {copy.saveQuickApply}
                      </button>
                    </div>
                    {qaMessage ? (
                      <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                        {qaMessage}
                      </p>
                    ) : null}
                  </SectionBlock>

                  <SectionBlock title={copy.links} tone="social">
                    {professionalData.links.length === 0 ? (
                      <EmptyState
                        title={isId ? 'Belum ada link' : 'No links yet'}
                        description={
                          isId
                            ? 'Tambah portfolio, website, LinkedIn, atau katalog.'
                            : 'Add portfolio, website, LinkedIn, or catalog.'
                        }
                      />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {professionalData.links.slice(0, 8).map(item => (
                          <a
                            key={`${item.label}-${item.url}`}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={cn(
                              MUTED_ROW_CLASS,
                              'flex min-h-[42px] items-center justify-between gap-2.5 px-2.5 text-[13px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]',
                            )}
                          >
                            <span className="min-w-0 truncate">
                              {item.label}
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </SectionBlock>
                </>
              ) : null}

              {activeHubTab === 'trust' ? (
                <IdentityVerificationPanel
                  verificationSource={verificationSource}
                  onRefresh={onRefreshVerification}
                />
              ) : null}
            </main>

            <aside className="min-w-0 space-y-2.5 lg:sticky lg:top-[calc(102px+env(safe-area-inset-top))] lg:self-start">
              <section
                className={cn(
                  CARD_CLASS,
                  SECTION_TONE_CLASS.profile,
                  'p-2.5 sm:p-3',
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <p className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {copy.completeProfile}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {setupPercent}% {isId ? 'siap' : 'ready'}
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2.5">
                  <ProgressBar value={setupPercent} />
                </div>
                <div className="mt-2.5 grid gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickEditOpen(true)}
                    className={PRIMARY_ACTION_CLASS}
                  >
                    <User2 className="h-4 w-4" />
                    {copy.editQuick}
                  </button>
                  <button
                    type="button"
                    onClick={copyPublicProfileUrl}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <Link2 className="h-4 w-4" />
                    {copyMessage || copy.copyLink}
                  </button>
                </div>
              </section>

              <section
                className={cn(
                  CARD_CLASS,
                  SECTION_TONE_CLASS.social,
                  'p-2.5 sm:p-3',
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {copy.social}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                      {copy.socialSubtitle}
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Users className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSocialModal('followers')}
                    className={cn(MUTED_ROW_CLASS, 'px-2.5 py-1.5 text-left')}
                  >
                    <span className="block text-base font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {followerCount.toLocaleString(locale)}
                    </span>
                    <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {copy.followers}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocialModal('following')}
                    className={cn(MUTED_ROW_CLASS, 'px-2.5 py-1.5 text-left')}
                  >
                    <span className="block text-base font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {followingCount.toLocaleString(locale)}
                    </span>
                    <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {copy.following}
                    </span>
                  </button>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  {followingUsers.slice(0, 3).map(item => (
                    <SocialUserRow
                      key={item.id}
                      item={item}
                      isId={isId}
                      following
                      onToggle={toggleFollow}
                    />
                  ))}
                  {followingUsers.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-[color:var(--app-border)] bg-white/70 px-3 py-3 text-center dark:border-white/10 dark:bg-white/[0.06]">
                      <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Users className="h-4 w-4" />
                      </span>
                      <p className="mt-2 text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {copy.emptyConnections}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Belum ada data pengikut atau akun yang kamu ikuti.'
                          : 'No follower or following data is available yet.'}
                      </p>
                    </div>
                  ) : null}
                </div>

                <LocalizedLink
                  href="/search?type=people"
                  className={cn(TONAL_ACTION_CLASS, 'mt-2.5 w-full')}
                >
                  <UserPlus className="h-4 w-4" />
                  {copy.findPeople}
                </LocalizedLink>
              </section>
            </aside>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(socialModal)}
        title={socialModalTitle}
        onClose={() => setSocialModal(null)}
        className="sm:max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSocialModal(null)}
              className={SECONDARY_ACTION_CLASS}
            >
              {copy.close}
            </button>
            <LocalizedLink
              href="/search?type=people"
              className={PRIMARY_ACTION_CLASS}
            >
              <Users className="h-4 w-4" />
              {copy.findPeople}
            </LocalizedLink>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 rounded-[16px] bg-[color:var(--app-surface-muted)] p-1">
            {[
              {
                key: 'followers' as const,
                label: copy.followers,
                value: followerCount,
              },
              {
                key: 'following' as const,
                label: copy.following,
                value: followingCount,
              },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSocialModal(item.key)}
                className={cn(
                  'min-h-[42px] rounded-[13px] px-2 text-center text-xs font-black transition',
                  socialModal === item.key
                    ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] shadow-sm'
                    : 'text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]',
                )}
              >
                <span className="block text-sm leading-4">
                  {item.value.toLocaleString(locale)}
                </span>
                <span className="block truncate text-[10px] font-semibold">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {socialModalUsers.length === 0 ? (
            <EmptyState
              title={socialModalEmpty}
              description={
                socialModal === 'followers'
                  ? isId
                    ? 'Detail pengikut akan tampil setelah data koneksi tersedia.'
                    : 'Follower details will appear once connection data is available.'
                  : isId
                    ? 'Mulai follow orang yang relevan biar koneksimu kebaca.'
                    : 'Start following relevant people so your network becomes useful.'
              }
              action={
                <LocalizedLink
                  href="/search?type=people"
                  className={TONAL_ACTION_CLASS}
                >
                  <UserPlus className="h-4 w-4" />
                  {copy.findPeople}
                </LocalizedLink>
              }
            />
          ) : (
            <div className="space-y-2">
              {socialModalUsers.map(item => (
                <SocialUserRow
                  key={item.id}
                  item={item}
                  isId={isId}
                  following={
                    socialModal === 'following' || followedIds.includes(item.id)
                  }
                  onToggle={toggleFollow}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={quickEditOpen}
        title={isId ? 'Edit profil singkat' : 'Quick profile edit'}
        onClose={() => setQuickEditOpen(false)}
        footer={
          <>
            <LocalizedLink
              href="/profile/edit?focus=identity"
              className={SECONDARY_ACTION_CLASS}
            >
              {copy.editFull}
              <ChevronRight className="h-4 w-4" />
            </LocalizedLink>
            <button
              type="button"
              onClick={() => setQuickEditOpen(false)}
              className={SECONDARY_ACTION_CLASS}
            >
              {copy.close}
            </button>
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={saving}
              className={PRIMARY_ACTION_CLASS}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {copy.save}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {avatarBuilder ? avatarBuilder : null}

          <label className="block space-y-1.5">
            <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId ? 'Nama tampil' : 'Display name'}
            </span>
            <input
              value={fullNameInput}
              onChange={event => onFullNameChange(event.target.value)}
              className={INPUT_CLASS}
              placeholder={
                isId ? 'Nama yang ingin ditampilkan' : 'Name shown publicly'
              }
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId ? 'URL profil publik' : 'Public profile URL'}
            </span>
            <input
              value={usernameInput}
              onChange={event => onUsernameChange(event.target.value)}
              className={INPUT_CLASS}
              placeholder="nama-profil"
            />
            <p className="break-all text-xs text-[color:var(--app-text-soft)]">
              {publicProfileUrl}
            </p>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {isId ? 'Nomor telepon' : 'Phone'}
              </span>
              <input
                value={phoneInput}
                onChange={event => onPhoneChange(event.target.value)}
                className={INPUT_CLASS}
                placeholder="08xxxxxxxxxx"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {isId ? 'Lokasi' : 'Location'}
              </span>
              <input
                value={locationInput}
                onChange={event => onLocationChange(event.target.value)}
                className={INPUT_CLASS}
                placeholder="Jakarta, Bandung, Surabaya"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId ? 'Ringkasan singkat' : 'Short summary'}
            </span>
            <textarea
              value={bioInput}
              onChange={event => onBioChange(event.target.value)}
              rows={3}
              className={INPUT_CLASS}
              placeholder={
                isId
                  ? 'Siapa kamu atau usaha kamu?'
                  : 'Who are you or what is your business?'
              }
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
