'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react';
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Loader2,
  Megaphone,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type ManageHubClientProps = {
  isId: boolean;
};

type CountState = {
  activeListings: number;
  draftListings: number;
  archivedListings: number;
  communityPosts: number;
  reels: number;
  activeTransactions: number;
  unreadChats: number;
  businesses: number;
};

type AttentionPriority = 'high' | 'medium' | 'normal';

type AttentionItem = {
  id: string;
  href: string;
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  priority: AttentionPriority;
};

type ManageItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  value?: number;
  valueLabel?: string;
  helper?: string;
};

type ShortcutItem = {
  id: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const EMPTY_COUNTS: CountState = {
  activeListings: 0,
  draftListings: 0,
  archivedListings: 0,
  communityPosts: 0,
  reels: 0,
  activeTransactions: 0,
  unreadChats: 0,
  businesses: 0,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNumberish(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }

  return 0;
}

function listFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(item => asRecord(item)) as Record<string, unknown>[];
  }

  const root = asRecord(payload);
  if (!root) return [];

  for (const key of [
    'items',
    'results',
    'data',
    'rooms',
    'stores',
    'transactions',
    'listings',
    'threads',
    'reels',
  ]) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.filter(item => asRecord(item)) as Record<string, unknown>[];
    }

    const nested = asRecord(value);
    if (!nested) continue;

    for (const nestedKey of [
      'items',
      'results',
      'data',
      'rooms',
      'stores',
      'transactions',
      'listings',
      'threads',
      'reels',
    ]) {
      const nestedValue = nested[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue.filter(item => asRecord(item)) as Record<
          string,
          unknown
        >[];
      }
    }
  }

  return [];
}

function countPayload(payload: unknown): number {
  const root = asRecord(payload);

  for (const key of ['total', 'count', 'total_count', 'totalCount']) {
    const value = readNumberish(root?.[key]);
    if (value > 0) return value;
  }

  return listFromPayload(payload).length;
}

function readStatus(record: Record<string, unknown>): string {
  for (const key of ['status', 'state', 'content_status']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return '';
}

function countUnreadInbox(payload: unknown): number {
  const root = asRecord(payload);

  for (const source of [root, asRecord(root?.data)]) {
    if (!source) continue;
    for (const key of [
      'unread_count',
      'unreadCount',
      'total_unread',
      'totalUnread',
    ]) {
      const value = readNumberish(source[key]);
      if (value > 0) return Math.floor(value);
    }
  }

  return listFromPayload(payload).reduce((total, room) => {
    for (const key of [
      'unread_count',
      'unreadCount',
      'unread_messages',
      'unreadMessages',
      'unread',
    ]) {
      const value = readNumberish(room[key]);
      if (value > 0) return total + Math.floor(value);
    }
    return total;
  }, 0);
}

function getUserDisplayName(user: unknown): string {
  const root = asRecord(user);
  if (!root) return '';

  for (const source of [root, asRecord(root.metadata)]) {
    if (!source) continue;
    for (const key of ['full_name', 'fullName', 'name', 'username']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return '';
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export default function ManageHubClient({ isId }: ManageHubClientProps) {
  const {
    user,
    authFetch,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const locale = isId ? 'id-ID' : 'en-US';
  const displayName = getUserDisplayName(user);

  const [counts, setCounts] = useState<CountState>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const copy = useMemo(
    () =>
      isId
        ? {
            title: 'Kelola usaha',
            subtitle: displayName
              ? `Halo, ${displayName}. Cek yang perlu ditangani lalu lanjutkan pekerjaanmu.`
              : 'Cek yang perlu ditangani lalu lanjutkan pekerjaanmu.',
            create: 'Buat baru',
            refresh: 'Perbarui',
            login: 'Masuk untuk mengelola usahamu.',
            loginCta: 'Masuk',
            loading: 'Menyiapkan halaman kelola...',
            partial: 'Sebagian data belum bisa dimuat. Kamu tetap bisa menggunakan menu di bawah.',
            today: 'Hari ini',
            allClear: 'Semua beres',
            allClearHint: 'Belum ada chat, transaksi, atau draft yang perlu segera ditangani.',
            manage: 'Kelola',
            manageHint: 'Pilih bagian yang ingin kamu urus.',
            tools: 'Alat bantu',
          }
        : {
            title: 'Manage business',
            subtitle: displayName
              ? `Hi, ${displayName}. Check what needs attention, then continue your work.`
              : 'Check what needs attention, then continue your work.',
            create: 'Create',
            refresh: 'Refresh',
            login: 'Sign in to manage your business.',
            loginCta: 'Sign in',
            loading: 'Preparing your management page...',
            partial: 'Some data could not be loaded. You can still use the menu below.',
            today: 'Today',
            allClear: 'All clear',
            allClearHint: 'No chats, transactions, or drafts need immediate attention.',
            manage: 'Manage',
            manageHint: 'Choose what you want to manage.',
            tools: 'Tools',
          },
    [displayName, isId],
  );

  const loadData = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      setPartialError(false);

      try {
        const results = await Promise.allSettled([
          authFetch('/api/my-listings?status=active&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/my-listings?status=draft&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/my-listings?status=archived&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/forum/threads?mine=true&sort=new&page_size=50', {
            cache: 'no-store',
          }),
          authFetch('/api/reels?mine=true&limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/transactions?limit=50', {
            cache: 'no-store',
          }),
          authFetch('/api/chat/inbox', {
            cache: 'no-store',
          }),
          authFetch('/api/super-app/umkm/stores?mine=1&limit=80', {
            cache: 'no-store',
          }),
        ]);

        const responses = results.map(result =>
          result.status === 'fulfilled' ? result.value : null,
        );

        const payloads = await Promise.all(
          responses.map(response => (response ? readJson(response) : {})),
        );

        const [
          activePayload,
          draftPayload,
          archivedPayload,
          communityPayload,
          reelsPayload,
          transactionPayload,
          inboxPayload,
          storesPayload,
        ] = payloads;

        const activeTransactions = listFromPayload(transactionPayload).filter(
          item => {
            const status = readStatus(item);
            return (
              status !== '' &&
              ![
                'completed',
                'cancelled',
                'canceled',
                'failed',
                'refunded',
                'closed',
              ].includes(status)
            );
          },
        ).length;

        setCounts({
          activeListings: countPayload(activePayload),
          draftListings: countPayload(draftPayload),
          archivedListings: countPayload(archivedPayload),
          communityPosts: countPayload(communityPayload),
          reels: countPayload(reelsPayload),
          activeTransactions,
          unreadChats: countUnreadInbox(inboxPayload),
          businesses: countPayload(storesPayload),
        });

        setPartialError(
          results.some(result => result.status === 'rejected') ||
            responses.some(response => response && !response.ok),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, isAuthenticated],
  );

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadData]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (counts.unreadChats > 0) {
      items.push({
        id: 'chat',
        href: '/chat',
        title: isId ? 'Balas chat' : 'Reply to chats',
        detail: isId
          ? `${formatCount(counts.unreadChats, locale)} pesan belum dibaca`
          : `${formatCount(counts.unreadChats, locale)} unread messages`,
        icon: MessageCircle,
        priority: 'high',
      });
    }

    if (counts.activeTransactions > 0) {
      items.push({
        id: 'transaction',
        href: '/transactions',
        title: isId ? 'Cek transaksi' : 'Check transactions',
        detail: isId
          ? `${formatCount(counts.activeTransactions, locale)} masih berjalan`
          : `${formatCount(counts.activeTransactions, locale)} still in progress`,
        icon: Package,
        priority: 'medium',
      });
    }

    if (counts.draftListings > 0) {
      items.push({
        id: 'draft',
        href: '/my-listings',
        title: isId ? 'Lanjutkan draft' : 'Continue drafts',
        detail: isId
          ? `${formatCount(counts.draftListings, locale)} belum ditayangkan`
          : `${formatCount(counts.draftListings, locale)} not published yet`,
        icon: ClipboardList,
        priority: 'normal',
      });
    }

    return items.slice(0, 3);
  }, [counts.activeTransactions, counts.draftListings, counts.unreadChats, isId, locale]);

  const manageItems = useMemo<ManageItem[]>(
    () => [
      {
        id: 'chat',
        href: '/chat',
        title: 'Chat',
        description: isId ? 'Balas calon pembeli.' : 'Reply to potential buyers.',
        icon: MessageCircle,
        value: counts.unreadChats,
        valueLabel: isId ? 'belum dibaca' : 'unread',
      },
      {
        id: 'listing',
        href: '/my-listings',
        title: isId ? 'Postingan' : 'Listings',
        description: isId ? 'Produk, jasa, dan kebutuhan.' : 'Products, services, and needs.',
        icon: ClipboardList,
        value: counts.activeListings + counts.draftListings + counts.archivedListings,
        valueLabel: isId ? 'total' : 'total',
        helper: isId
          ? `${formatCount(counts.activeListings, locale)} tayang · ${formatCount(counts.draftListings, locale)} draft · ${formatCount(counts.archivedListings, locale)} arsip`
          : `${formatCount(counts.activeListings, locale)} live · ${formatCount(counts.draftListings, locale)} draft · ${formatCount(counts.archivedListings, locale)} archived`,
      },
      {
        id: 'transaction',
        href: '/transactions',
        title: isId ? 'Transaksi' : 'Transactions',
        description: isId ? 'Pantau yang masih berjalan.' : 'Track ongoing transactions.',
        icon: Package,
        value: counts.activeTransactions,
        valueLabel: isId ? 'berjalan' : 'active',
      },
      {
        id: 'business',
        href: '/usaha/dashboard',
        title: isId ? 'Usaha' : 'Business',
        description: isId ? 'Profil, lokasi, dan katalog.' : 'Profile, location, and catalog.',
        icon: Store,
        value: counts.businesses,
        valueLabel: isId ? 'usaha' : 'businesses',
      },
      {
        id: 'reels',
        href: '/manage/reels',
        title: 'Reels',
        description: isId ? 'Kelola video usahamu.' : 'Manage your business videos.',
        icon: Clapperboard,
        value: counts.reels,
        valueLabel: 'reels',
      },
      {
        id: 'community',
        href: '/manage/community',
        title: isId ? 'Komunitas' : 'Community',
        description: isId ? 'Kelola diskusi dan postingan.' : 'Manage discussions and posts.',
        icon: Users,
        value: counts.communityPosts,
        valueLabel: isId ? 'postingan' : 'posts',
      },
    ],
    [
      counts.activeListings,
      counts.activeTransactions,
      counts.archivedListings,
      counts.businesses,
      counts.communityPosts,
      counts.draftListings,
      counts.reels,
      counts.unreadChats,
      isId,
      locale,
    ],
  );

  const shortcuts = useMemo<ShortcutItem[]>(
    () => [
      {
        id: 'promotion',
        href: '/create?mode=promotion',
        label: isId ? 'Promosi' : 'Promotion',
        icon: Megaphone,
      },
      {
        id: 'analytics',
        href: '/dashboard',
        label: isId ? 'Statistik' : 'Analytics',
        icon: BarChart3,
      },
      {
        id: 'ai',
        href: '/profile/ai',
        label: isId ? 'Bantuan AI' : 'AI help',
        icon: Bot,
      },
    ],
    [isId],
  );

  if (authLoading || loading) {
    return <ManageHubSkeleton label={copy.loading} />;
  }

  if (!isAuthenticated) {
    return (
      <main className="page-shell min-w-0 py-5 sm:py-7">
        <section className="mx-auto max-w-xl rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:p-6">
          <AlertCircle className="h-6 w-6 text-amber-600" />
          <h1 className="mt-4 text-xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {copy.login}
          </h1>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            {copy.loginCta}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main
      data-testid="manage-studio"
      className="page-shell min-w-0 max-w-full space-y-3 overflow-x-clip pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-2.5 sm:space-y-4 sm:py-4 lg:py-5"
    >
      <header className="flex min-w-0 items-start justify-between gap-3 border-b border-[color:var(--app-border)] pb-3 sm:items-center sm:pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
            {copy.subtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60"
            aria-label={copy.refresh}
            title={copy.refresh}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>

          <Link
            href="/create"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white transition hover:bg-emerald-800 sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden min-[390px]:inline">{copy.create}</span>
          </Link>
        </div>
      </header>

      {partialError ? (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{copy.partial}</span>
        </div>
      ) : null}

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            {copy.today}
          </h2>
          {attentionItems.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {attentionItems.length} {isId ? 'perlu aksi' : 'need action'}
            </span>
          ) : null}
        </div>

        {attentionItems.length > 0 ? (
          <div className="space-y-2">
            {attentionItems.map(item => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-3 sm:px-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {copy.allClear}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:text-xs">
                {copy.allClearHint}
              </p>
            </div>
          </div>
        )}
      </section>


      <section className="min-w-0">
        <div className="mb-2.5">
          <h2 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            {copy.manage}
          </h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
            {copy.manageHint}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
          <div className="grid min-w-0 sm:grid-cols-2">
            {manageItems.map((item, index) => (
              <ManageRow
                key={item.id}
                item={item}
                locale={locale}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="min-w-0 border-t border-[color:var(--app-border)] pt-3 sm:pt-4">
        <h2 className="text-xs font-black text-[color:var(--app-text-soft)]">
          {copy.tools}
        </h2>
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          {shortcuts.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-bold text-[color:var(--app-text-soft)] transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200 sm:text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  const isUrgent = item.priority === 'high';

  return (
    <Link
      href={item.href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/45 dark:hover:border-emerald-900 dark:hover:bg-emerald-500/[0.06]"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
            {item.title}
          </span>
          {isUrgent ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)] sm:text-xs">
          {item.detail}
        </span>
      </span>

      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
    </Link>
  );
}

function ManageRow({
  item,
  locale,
  index,
}: {
  item: ManageItem;
  locale: string;
  index: number;
}) {
  const Icon = item.icon;
  const hasAttention = item.id === 'chat' && (item.value ?? 0) > 0;
  const isSecondColumn = index % 2 === 1;

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex min-w-0 items-center gap-3 px-3.5 py-3.5 transition hover:bg-[color:var(--app-surface-muted)] sm:px-4',
        index > 0 && 'border-t border-[color:var(--app-border)]',
        index === 1 && 'sm:border-t-0',
        isSecondColumn && 'sm:border-l sm:border-[color:var(--app-border)]',
      )}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.title}
          </span>
          {hasAttention ? (
            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
              {item.value && item.value > 99 ? '99+' : item.value}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)] sm:text-[11px]">
          {item.description}
        </span>
        {item.helper ? (
          <span className="mt-0.5 block truncate text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:text-[10px]">
            {item.helper}
          </span>
        ) : null}
      </span>

      {typeof item.value === 'number' ? (
        <span className="shrink-0 text-right">
          <strong className="block text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {formatCount(item.value, locale)}
          </strong>
          <span className="block text-[9px] font-semibold text-[color:var(--app-text-soft)]">
            {item.valueLabel}
          </span>
        </span>
      ) : null}

      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
    </Link>
  );
}

function ManageHubSkeleton({ label }: { label: string }) {
  return (
    <main
      className="page-shell min-w-0 max-w-full space-y-3 overflow-x-clip pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-2.5 sm:space-y-4 sm:py-4"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] pb-4">
        <div className="min-w-0 flex-1">
          <SkeletonPulse className="h-7 w-40 rounded-lg" />
          <SkeletonPulse className="mt-2 h-4 w-full max-w-md rounded-full" />
        </div>
        <SkeletonPulse className="h-10 w-24 rounded-xl" />
      </div>

      <section>
        <SkeletonPulse className="h-5 w-20 rounded-full" />
        <div className="mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-[color:var(--app-border)] p-3 last:border-b-0"
            >
              <SkeletonPulse className="h-9 w-9 rounded-xl" />
              <div className="min-w-0 flex-1">
                <SkeletonPulse className="h-4 w-36 rounded-full" />
                <SkeletonPulse className="mt-2 h-3 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkeletonPulse className="h-5 w-20 rounded-full" />
        <div className="mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
          <div className="grid sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-3 p-3.5',
                  index > 0 && 'border-t border-[color:var(--app-border)]',
                  index === 1 && 'sm:border-t-0',
                  index % 2 === 1 && 'sm:border-l sm:border-[color:var(--app-border)]',
                )}
              >
                <SkeletonPulse className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <SkeletonPulse className="h-4 w-24 rounded-full" />
                  <SkeletonPulse className="mt-2 h-3 w-32 rounded-full" />
                </div>
                <SkeletonPulse className="h-6 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <span className="sr-only">{label}</span>
    </main>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-[color:var(--app-surface-muted)]',
        className,
      )}
    />
  );
}