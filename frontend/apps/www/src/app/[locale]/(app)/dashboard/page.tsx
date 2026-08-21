'use client';

import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth, type User } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';

type DashboardStats = {
  total_content: number;
  active_transactions: number;
  unread_messages: number;
  user_rating: number;
};

type CardTone = 'emerald' | 'sky' | 'amber' | 'violet' | 'teal' | 'slate';

type MetricItem = {
  id: 'listing' | 'chat' | 'transaction' | 'rating' | 'profile';
  label: string;
  value: string;
  helper: string;
  href: string;
  icon: LucideIcon;
  tone: CardTone;
  attention?: boolean;
};

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
  icon: LucideIcon;
  tone: CardTone;
  urgent?: boolean;
};

type ShortcutItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: CardTone;
  badge?: string;
};

const EMPTY_STATS: DashboardStats = {
  total_content: 0,
  active_transactions: 0,
  unread_messages: 0,
  user_rating: 0,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toInt(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function toRating(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 0;
}

function normalizeStats(payload: unknown): DashboardStats {
  const root = asRecord(payload);
  const data = asRecord(root?.data) || root;
  const stats = asRecord(data?.stats) || data;

  if (!stats) return EMPTY_STATS;

  return {
    total_content: toInt(
      stats.total_content ?? stats.active_content ?? stats.active_listings,
    ),
    active_transactions: toInt(stats.active_transactions),
    unread_messages: toInt(stats.unread_messages ?? stats.unread_chats),
    user_rating: toRating(stats.user_rating ?? stats.rating),
  };
}

function getDisplayName(user: User | null): string {
  if (!user) return '';
  return (
    user.full_name ||
    user.fullName ||
    user.username ||
    user.email ||
    'User'
  );
}

function getProfileCompletion(user: User | null): number {
  if (!user) return 0;

  const checks = [
    Boolean(user.full_name || user.fullName || user.name || user.username),
    Boolean(user.avatarUrl || user.avatar_url || user.metadata?.avatar_url),
    typeof user.bio === 'string' && user.bio.trim().length >= 24,
    typeof user.location === 'string' && user.location.trim().length >= 2,
    Boolean(user.phone || user.phoneVerified || user.email),
  ];

  return Math.round(
    (checks.filter(Boolean).length / Math.max(1, checks.length)) * 100,
  );
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.max(0, value));
}


function cardTone(tone: CardTone) {
  return {
    emerald: {
      border: 'border-emerald-200/80 dark:border-emerald-900/60',
      surface: 'bg-emerald-50/55 dark:bg-emerald-500/[0.055]',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      accent: 'bg-emerald-500',
      hover: 'hover:border-emerald-300 hover:bg-emerald-50/80 dark:hover:border-emerald-800 dark:hover:bg-emerald-500/[0.08]',
      action: 'text-emerald-700 dark:text-emerald-300',
    },
    sky: {
      border: 'border-sky-200/80 dark:border-sky-900/60',
      surface: 'bg-sky-50/60 dark:bg-sky-500/[0.055]',
      icon: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
      accent: 'bg-sky-500',
      hover: 'hover:border-sky-300 hover:bg-sky-50/85 dark:hover:border-sky-800 dark:hover:bg-sky-500/[0.08]',
      action: 'text-sky-700 dark:text-sky-300',
    },
    amber: {
      border: 'border-amber-200/90 dark:border-amber-900/60',
      surface: 'bg-amber-50/65 dark:bg-amber-500/[0.06]',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      accent: 'bg-amber-500',
      hover: 'hover:border-amber-300 hover:bg-amber-50/90 dark:hover:border-amber-800 dark:hover:bg-amber-500/[0.09]',
      action: 'text-amber-700 dark:text-amber-300',
    },
    violet: {
      border: 'border-violet-200/80 dark:border-violet-900/60',
      surface: 'bg-violet-50/55 dark:bg-violet-500/[0.055]',
      icon: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
      accent: 'bg-violet-500',
      hover: 'hover:border-violet-300 hover:bg-violet-50/80 dark:hover:border-violet-800 dark:hover:bg-violet-500/[0.08]',
      action: 'text-violet-700 dark:text-violet-300',
    },
    teal: {
      border: 'border-teal-200/80 dark:border-teal-900/60',
      surface: 'bg-teal-50/55 dark:bg-teal-500/[0.055]',
      icon: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
      accent: 'bg-teal-500',
      hover: 'hover:border-teal-300 hover:bg-teal-50/80 dark:hover:border-teal-800 dark:hover:bg-teal-500/[0.08]',
      action: 'text-teal-700 dark:text-teal-300',
    },
    slate: {
      border: 'border-slate-200 dark:border-slate-700',
      surface: 'bg-slate-50/80 dark:bg-slate-800/55',
      icon: 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      accent: 'bg-slate-500',
      hover: 'hover:border-slate-300 hover:bg-slate-100/80 dark:hover:border-slate-600 dark:hover:bg-slate-800/80',
      action: 'text-slate-700 dark:text-slate-300',
    },
  }[tone];
}

function MetricCard({ item }: { item: MetricItem }) {
  const Icon = item.icon;
  const tone = cardTone(item.tone);

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-sm sm:p-4',
        tone.border,
        tone.surface,
        tone.hover,
        item.attention && 'ring-1 ring-inset ring-amber-200/45 dark:ring-amber-500/10',
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', tone.accent)} />

      <div className="flex items-start justify-between gap-3 pt-0.5">
        <div className="min-w-0">
          <p className="text-xl font-black leading-none text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
            {item.value}
          </p>
          <p className="mt-2 truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
            {item.label}
          </p>
        </div>

        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
            tone.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
        {item.helper}
      </p>
    </Link>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  const tone = cardTone(item.tone);

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex min-w-0 items-center gap-3 border-b border-[color:var(--app-border)] px-3.5 py-3.5 transition last:border-b-0 sm:px-4',
        tone.hover,
      )}
    >
      <span className={cn('absolute bottom-2 left-0 top-2 w-1 rounded-r-full', tone.accent)} />
      <span
        className={cn(
          'ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone.icon,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
          {item.description}
        </p>
      </div>

      <span className={cn('hidden shrink-0 items-center gap-1 text-xs font-black transition group-hover:translate-x-0.5 sm:inline-flex', tone.action)}>
        {item.action}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
      <ArrowRight className={cn('h-4 w-4 shrink-0 sm:hidden', tone.action)} />
    </Link>
  );
}

function ShortcutCard({ item }: { item: ShortcutItem }) {
  const Icon = item.icon;
  const tone = cardTone(item.tone);

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-3 transition',
        tone.border,
        tone.surface,
        tone.hover,
      )}
    >
      <span className={cn('absolute bottom-0 left-0 top-0 w-1', tone.accent)} />
      <span className={cn('ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone.icon)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.label}
          </p>
          {item.badge ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20">
              {item.badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-[color:var(--app-text-soft)] sm:text-[11px]">
          {item.description}
        </p>
      </div>

      <ArrowRight className={cn('h-4 w-4 shrink-0 transition group-hover:translate-x-0.5', tone.action)} />
    </Link>
  );
}

export default function DashboardPage() {
  const locale = useLocale();
  const isId = locale === 'id';
  const numberLocale = isId ? 'id-ID' : 'en-US';
  const { user, loading, authFetch } = useAuth();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    setStatsError('');

    try {
      const response = await authFetch('/api/dashboard/stats', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          isId ? 'Ringkasan belum berhasil dimuat.' : 'Overview failed to load.',
        );
      }

      setStats(normalizeStats(payload));
      setLastLoadedAt(new Date());
    } catch (error) {
      setStatsError(
        error instanceof Error
          ? error.message
          : isId
            ? 'Ringkasan belum berhasil dimuat.'
            : 'Overview failed to load.',
      );
    } finally {
      setStatsLoading(false);
    }
  }, [authFetch, isId, user]);

  useEffect(() => {
    if (loading || !user) return;
    void loadStats();
  }, [loadStats, loading, user]);

  const displayName = getDisplayName(user);
  const profileCompletion = getProfileCompletion(user);

  const metrics = useMemo<MetricItem[]>(() => {
    const items: MetricItem[] = [
      {
        id: 'listing',
        label: isId ? 'Listing tayang' : 'Live listings',
        value: formatNumber(stats.total_content, numberLocale),
        helper: isId ? 'Yang bisa ditemukan orang' : 'Visible to customers',
        href: '/my-listings?status=active',
        icon: FileText,
        tone: 'emerald',
        attention: stats.total_content === 0,
      },
      {
        id: 'chat',
        label: isId ? 'Chat belum dibalas' : 'Unread chats',
        value: formatNumber(stats.unread_messages, numberLocale),
        helper:
          stats.unread_messages > 0
            ? isId
              ? 'Perlu perhatian'
              : 'Needs attention'
            : isId
              ? 'Inbox aman'
              : 'Inbox clear',
        href: '/chat',
        icon: MessageCircle,
        tone: 'sky',
        attention: stats.unread_messages > 0,
      },
    ];

    if (!PROMO_ONLY_MODE) {
      items.push({
        id: 'transaction',
        label: isId ? 'Transaksi berjalan' : 'Active transactions',
        value: formatNumber(stats.active_transactions, numberLocale),
        helper: isId ? 'Masih dalam proses' : 'Still in progress',
        href: '/transactions',
        icon: BriefcaseBusiness,
        tone: 'amber',
        attention: stats.active_transactions > 0,
      });
    }

    items.push(
      stats.user_rating > 0
        ? {
            id: 'rating',
            label: isId ? 'Rating' : 'Rating',
            value: stats.user_rating.toFixed(1),
            helper: isId ? 'Dari aktivitas akun' : 'From account activity',
            href: '/profile',
            icon: Star,
            tone: 'violet',
          }
        : {
            id: 'profile',
            label: isId ? 'Profil lengkap' : 'Profile complete',
            value: `${profileCompletion}%`,
            helper:
              profileCompletion >= 80
                ? isId
                  ? 'Sudah cukup rapi'
                  : 'Looking good'
                : isId
                  ? 'Masih bisa dilengkapi'
                  : 'Can be improved',
            href: '/profile?edit=main',
            icon: UserRound,
            tone: 'slate',
            attention: profileCompletion < 80,
          },
    );

    return items.slice(0, 4);
  }, [isId, numberLocale, profileCompletion, stats]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (stats.unread_messages > 0) {
      items.push({
        id: 'chat',
        title: isId ? 'Balas chat yang masuk' : 'Reply to incoming chats',
        description: isId
          ? `${formatNumber(stats.unread_messages, numberLocale)} pesan belum dibalas.`
          : `${formatNumber(stats.unread_messages, numberLocale)} messages need replies.`,
        href: '/chat',
        action: isId ? 'Balas' : 'Reply',
        icon: MessageCircle,
        tone: 'sky',
        urgent: true,
      });
    }

    if (!PROMO_ONLY_MODE && stats.active_transactions > 0) {
      items.push({
        id: 'transactions',
        title: isId ? 'Cek transaksi berjalan' : 'Review active transactions',
        description: isId
          ? `${formatNumber(stats.active_transactions, numberLocale)} transaksi masih diproses.`
          : `${formatNumber(stats.active_transactions, numberLocale)} transactions are still active.`,
        href: '/transactions',
        action: isId ? 'Cek' : 'Review',
        icon: BriefcaseBusiness,
        tone: 'amber',
        urgent: true,
      });
    }

    if (stats.total_content === 0) {
      items.push({
        id: 'listing',
        title: isId ? 'Buat listing pertama' : 'Create your first listing',
        description: isId
          ? 'Mulai dari judul, foto, lokasi, dan kontak.'
          : 'Start with a title, photo, location, and contact.',
        href: '/create?mode=quick',
        action: isId ? 'Buat' : 'Create',
        icon: Plus,
        tone: 'emerald',
      });
    }

    if (profileCompletion < 80) {
      items.push({
        id: 'profile',
        title: isId ? 'Lengkapi profil' : 'Complete your profile',
        description: isId
          ? 'Nama, foto, bio, lokasi, dan kontak membantu orang lebih percaya.'
          : 'Name, photo, bio, location, and contact help build trust.',
        href: '/profile?edit=main',
        action: isId ? 'Lengkapi' : 'Complete',
        icon: UserRound,
        tone: 'slate',
      });
    }

    return items.slice(0, 4);
  }, [isId, numberLocale, profileCompletion, stats]);

  const shortcuts = useMemo<ShortcutItem[]>(
    () => [
      {
        id: 'create',
        label: isId ? 'Buat baru' : 'Create new',
        description: isId ? 'Produk, jasa, atau kebutuhan' : 'Product, service, or need',
        href: '/create?mode=quick',
        icon: Plus,
        tone: 'emerald',
      },
      {
        id: 'manage',
        label: isId ? 'Kelola usaha' : 'Manage',
        description: isId ? 'Semua aktivitas usaha' : 'All business activity',
        href: '/manage',
        icon: Store,
        tone: 'teal',
      },
      {
        id: 'listings',
        label: isId ? 'Postingan' : 'Listings',
        description: isId ? 'Tayang, draft, dan arsip' : 'Live, drafts, and archive',
        href: '/my-listings',
        icon: FileText,
        tone: 'emerald',
      },
      {
        id: 'chat',
        label: 'Chat',
        description: isId ? 'Prospek dan pelanggan' : 'Prospects and customers',
        href: '/chat',
        icon: MessageCircle,
        tone: 'sky',
        badge:
          stats.unread_messages > 0
            ? stats.unread_messages > 99
              ? '99+'
              : String(stats.unread_messages)
            : undefined,
      },
      {
        id: 'explore',
        label: isId ? 'Cari peluang' : 'Explore',
        description: isId ? 'Supplier, jasa, dan kebutuhan' : 'Suppliers, services, and needs',
        href: '/explore',
        icon: Search,
        tone: 'violet',
      },
      {
        id: 'profile',
        label: isId ? 'Profil' : 'Profile',
        description: isId ? 'Identitas dan kepercayaan' : 'Identity and trust',
        href: '/profile',
        icon: UserRound,
        tone: 'slate',
      },
    ],
    [isId, stats.unread_messages],
  );

  if (loading) {
    return (
      <main className="page-shell py-4">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 text-sm text-[color:var(--app-text-soft)]">
          {isId ? 'Memuat dashboard...' : 'Loading dashboard...'}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell py-4">
        <section className="mx-auto max-w-lg rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:p-6">
          <h1 className="text-xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId ? 'Masuk untuk melihat dashboard' : 'Sign in to view dashboard'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Dashboard berisi ringkasan aktivitas akun dan hal yang perlu ditangani.'
              : 'Your dashboard shows account activity and items that need attention.'}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            {isId ? 'Masuk' : 'Sign in'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell min-w-0 space-y-3 overflow-x-clip pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-3 sm:space-y-4 sm:pb-8 lg:pt-5">
      <header className="flex min-w-0 flex-col gap-3 border-b border-[color:var(--app-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[color:var(--app-text-soft)]">
            {isId ? `Halo, ${displayName}` : `Hi, ${displayName}`}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
            {isId ? 'Dashboard' : 'Dashboard'}
          </h1>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
            {isId
              ? 'Lihat ringkasan penting dan kerjakan yang perlu ditangani.'
              : 'See the important numbers and handle what needs attention.'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {lastLoadedAt ? (
            <span className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:inline">
              {isId ? 'Diperbarui' : 'Updated'}{' '}
              {lastLoadedAt.toLocaleTimeString(numberLocale, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={statsLoading}
            aria-label={isId ? 'Perbarui dashboard' : 'Refresh dashboard'}
            title={isId ? 'Perbarui' : 'Refresh'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', statsLoading && 'animate-spin')} />
          </button>

          <Link
            href="/create?mode=quick"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white transition hover:bg-emerald-800 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            {isId ? 'Buat baru' : 'Create'}
          </Link>
        </div>
      </header>

      {statsError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-500/10 dark:text-amber-100 sm:text-sm">
          {statsError}
        </div>
      ) : null}

      <section aria-labelledby="dashboard-summary-title">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-emerald-500" />
          <h2
            id="dashboard-summary-title"
            className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base"
          >
            {isId ? 'Ringkasan' : 'Overview'}
          </h2>
        </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {metrics.map(item => (
            <MetricCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="dashboard-attention-title"
        className="overflow-hidden rounded-2xl border border-amber-200/70 bg-amber-50/25 dark:border-amber-900/50 dark:bg-amber-500/[0.025]"
      >
        <div className="flex items-center justify-between gap-3 bg-amber-50/60 px-3.5 py-3 dark:bg-amber-500/[0.05] sm:px-4">
          <div className="min-w-0">
            <h2
              id="dashboard-attention-title"
              className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base"
            >
              {isId ? 'Perlu ditangani' : 'Needs attention'}
            </h2>
            <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
              {attentionItems.length > 0
                ? isId
                  ? 'Kerjakan yang paling penting dulu.'
                  : 'Handle the most important items first.'
                : isId
                  ? 'Tidak ada hal penting yang tertunda.'
                  : 'Nothing important is pending.'}
            </p>
          </div>
        </div>

        {attentionItems.length > 0 ? (
          <div className="border-t border-[color:var(--app-border)]">
            {attentionItems.map(item => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 border-t border-[color:var(--app-border)] px-3.5 py-4 sm:px-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId ? 'Semua aman' : 'All clear'}
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Lanjutkan jualan atau cari peluang baru.'
                  : 'Keep selling or look for new opportunities.'}
              </p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="dashboard-shortcuts-title">
        <div className="mb-2.5">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-teal-500" />
            <h2
            id="dashboard-shortcuts-title"
            className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base"
          >
            {isId ? 'Akses cepat' : 'Quick access'}
          </h2>
          </div>
          <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
            {isId ? 'Buka fitur yang sering dipakai.' : 'Open frequently used tools.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(item => (
            <ShortcutCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}