'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clapperboard,
  ClipboardList,
  FileText,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
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
  inboxRooms: number;
  businesses: number;
};

type ManageCard = {
  id: keyof CountState | 'insight' | 'ai';
  href: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  count?: number;
  countLabel: string;
  priority?: boolean;
};

const EMPTY_COUNTS: CountState = {
  activeListings: 0,
  draftListings: 0,
  archivedListings: 0,
  communityPosts: 0,
  reels: 0,
  activeTransactions: 0,
  inboxRooms: 0,
  businesses: 0,
};

function countList(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== 'object') return 0;
  const record = payload as Record<string, unknown>;
  if (typeof record.total === 'number') return Math.max(0, record.total);
  for (const key of ['items', 'results', 'data', 'rooms', 'stores']) {
    const value = record[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (Array.isArray(nested.items)) return nested.items.length;
      if (Array.isArray(nested.stores)) return nested.stores.length;
    }
  }
  return 0;
}

function listFromPayload<T extends Record<string, unknown>>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['items', 'results', 'data', 'rooms', 'stores']) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (Array.isArray(nested.items)) return nested.items as T[];
      if (Array.isArray(nested.stores)) return nested.stores as T[];
    }
  }
  return [];
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function formatCount(value: number) {
  return new Intl.NumberFormat('id-ID').format(Math.max(0, value));
}

export default function ManageHubClient({ isId }: ManageHubClientProps) {
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const [counts, setCounts] = useState<CountState>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const copy = useMemo(
    () => ({
      eyebrow: isId ? 'Pusat kelola' : 'Manage hub',
      title: isId ? 'Kelola semua dari satu tempat' : 'Manage everything in one place',
      subtitle: isId
        ? 'Cek yang perlu dibereskan dulu: draft, postingan aktif, konten sosial, transaksi, chat, dan profil usaha.'
        : 'Start with what needs attention: drafts, live posts, social content, transactions, chats, and business profiles.',
      create: isId ? 'Buat postingan' : 'Create post',
      refresh: isId ? 'Muat ulang' : 'Refresh',
      login: isId ? 'Masuk dulu untuk melihat ringkasan kelola.' : 'Sign in to see your manage summary.',
      loginCta: isId ? 'Masuk' : 'Sign in',
      loading: isId ? 'Memuat ringkasan...' : 'Loading summary...',
      error: isId
        ? 'Sebagian count belum bisa dimuat. Aksi kelola tetap bisa dibuka.'
        : 'Some counts could not load. Manage actions are still available.',
      focus: isId ? 'Perlu dicek' : 'Needs attention',
      allGood: isId ? 'Tidak ada antrean mendesak.' : 'No urgent queue right now.',
      snapshot: isId ? 'Ringkasan cepat' : 'Quick snapshot',
    }),
    [isId],
  );

  const loadCounts = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const [
          activeListingsRes,
          draftListingsRes,
          archivedListingsRes,
          communityRes,
          reelsRes,
          transactionsRes,
          inboxRes,
          storesRes,
        ] = await Promise.all([
          authFetch('/api/my-listings?status=active', { cache: 'no-store' }),
          authFetch('/api/my-listings?status=draft', { cache: 'no-store' }),
          authFetch('/api/my-listings?status=archived', { cache: 'no-store' }),
          authFetch('/api/forum/threads?mine=true&sort=new&page_size=50', {
            cache: 'no-store',
          }),
          authFetch('/api/reels?mine=true&limit=50', { cache: 'no-store' }),
          authFetch('/api/transactions?limit=50', { cache: 'no-store' }),
          authFetch('/api/chat/inbox', { cache: 'no-store' }),
          authFetch('/api/super-app/umkm/stores?mine=1&limit=80', {
            cache: 'no-store',
          }),
        ]);

        const [
          activeListings,
          draftListings,
          archivedListings,
          community,
          reels,
          transactions,
          inbox,
          stores,
        ] = await Promise.all([
          readJson(activeListingsRes),
          readJson(draftListingsRes),
          readJson(archivedListingsRes),
          readJson(communityRes),
          readJson(reelsRes),
          readJson(transactionsRes),
          readJson(inboxRes),
          readJson(storesRes),
        ]);

        const transactionItems = listFromPayload(transactions);
        setCounts({
          activeListings: countList(activeListings),
          draftListings: countList(draftListings),
          archivedListings: countList(archivedListings),
          communityPosts: countList(community),
          reels: countList(reels),
          activeTransactions: transactionItems.filter(item => {
            const status = String(item.status || '').toLowerCase();
            return status && !['completed', 'cancelled', 'canceled'].includes(status);
          }).length,
          inboxRooms: countList(inbox),
          businesses: countList(stores),
        });

        if (
          [
            activeListingsRes,
            draftListingsRes,
            archivedListingsRes,
            communityRes,
            reelsRes,
            transactionsRes,
            inboxRes,
            storesRes,
          ].some(response => !response.ok)
        ) {
          setError(copy.error);
        }
      } catch {
        setError(copy.error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, copy.error, isAuthenticated],
  );

  useEffect(() => {
    if (!authLoading) void loadCounts();
  }, [authLoading, loadCounts]);

  const cards: ManageCard[] = [
    {
      id: 'draftListings',
      href: '/my-listings?status=draft',
      title: isId ? 'Draft' : 'Drafts',
      description: isId
        ? 'Lanjutkan draft yang belum siap tayang.'
        : 'Continue posts that are not ready yet.',
      action: isId ? 'Lanjutkan' : 'Continue',
      icon: FileText,
      count: counts.draftListings,
      countLabel: isId ? 'belum selesai' : 'unfinished',
      priority: counts.draftListings > 0,
    },
    {
      id: 'activeListings',
      href: '/my-listings?status=active',
      title: isId ? 'Postingan aktif' : 'Live posts',
      description: isId
        ? 'Edit, arsipkan, atau cek penawaran yang sedang tampil.'
        : 'Edit, archive, or review posts currently visible.',
      action: isId ? 'Kelola' : 'Manage',
      icon: ClipboardList,
      count: counts.activeListings,
      countLabel: isId ? 'tayang' : 'live',
    },
    {
      id: 'communityPosts',
      href: '/manage/community',
      title: isId ? 'Komunitas' : 'Community',
      description: isId
        ? 'Rapikan thread, pertanyaan, dan diskusi.'
        : 'Tidy threads, questions, and discussions.',
      action: isId ? 'Buka' : 'Open',
      icon: MessageCircle,
      count: counts.communityPosts,
      countLabel: isId ? 'postingan' : 'posts',
    },
    {
      id: 'reels',
      href: '/manage/reels',
      title: 'Reels',
      description: isId
        ? 'Edit caption, tag, dan konten video singkat.'
        : 'Edit captions, tags, and short videos.',
      action: isId ? 'Buka' : 'Open',
      icon: Clapperboard,
      count: counts.reels,
      countLabel: 'reels',
    },
    {
      id: 'activeTransactions',
      href: '/transactions',
      title: isId ? 'Transaksi' : 'Transactions',
      description: isId
        ? 'Pantau pesanan dan pembayaran yang masih berjalan.'
        : 'Track orders and payments still in progress.',
      action: isId ? 'Pantau' : 'Review',
      icon: Package,
      count: counts.activeTransactions,
      countLabel: isId ? 'aktif' : 'active',
      priority: counts.activeTransactions > 0,
    },
    {
      id: 'inboxRooms',
      href: '/chat',
      title: 'Chat',
      description: isId
        ? 'Balas percakapan yang terkait listing dan kebutuhan.'
        : 'Reply to conversations tied to posts and needs.',
      action: isId ? 'Buka chat' : 'Open chat',
      icon: MessageCircle,
      count: counts.inboxRooms,
      countLabel: isId ? 'ruang' : 'rooms',
    },
    {
      id: 'businesses',
      href: '/usaha/dashboard',
      title: isId ? 'Profil usaha' : 'Business profiles',
      description: isId
        ? 'Kelola toko, katalog, kontak, lokasi, dan tim.'
        : 'Manage stores, catalog, contact, location, and team.',
      action: isId ? 'Kelola usaha' : 'Manage business',
      icon: Store,
      count: counts.businesses,
      countLabel: isId ? 'usaha' : 'businesses',
    },
    {
      id: 'insight',
      href: '/dashboard',
      title: isId ? 'Insight' : 'Insights',
      description: isId
        ? 'Lihat ringkasan performa dan langkah berikutnya.'
        : 'See performance summary and next actions.',
      action: isId ? 'Lihat' : 'View',
      icon: BarChart3,
      countLabel: isId ? 'dashboard' : 'dashboard',
    },
    {
      id: 'ai',
      href: '/profile/ai',
      title: isId ? 'AI pribadi' : 'Personal AI',
      description: isId
        ? 'Kelola agent, draft, dan bantuan pembuatan konten.'
        : 'Manage agents, drafts, and creation assistance.',
      action: isId ? 'Buka AI' : 'Open AI',
      icon: Bot,
      countLabel: isId ? 'tools' : 'tools',
    },
  ];

  const priorityCards = cards.filter(card => card.priority).slice(0, 3);
  const totalPosts =
    counts.activeListings +
    counts.draftListings +
    counts.archivedListings +
    counts.communityPosts +
    counts.reels;

  if (authLoading || loading) {
    return (
      <main className="page-shell page-rhythm py-8">
        <section className="ui-panel rounded-3xl p-5 text-sm text-[color:var(--app-text-soft)]">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
          {copy.loading}
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="page-shell page-rhythm py-8">
        <section className="ui-panel ui-hero-panel rounded-3xl p-5 sm:p-6">
          <p className="ui-kicker">
            <AlertCircle className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-[color:var(--app-text)] sm:text-3xl">
            {copy.login}
          </h1>
          <Link
            href="/login"
            className="ui-button-primary mt-5 inline-flex items-center gap-2 px-4 text-sm font-semibold"
          >
            {copy.loginCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell page-rhythm py-6 sm:py-8">
      <section className="ui-panel ui-hero-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ui-kicker">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadCounts(true)}
              disabled={refreshing}
              className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {copy.refresh}
            </button>
            <Link
              href="/create"
              className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              {copy.create}
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryPill label={isId ? 'Semua konten' : 'All content'} value={totalPosts} />
        <SummaryPill label={isId ? 'Butuh aksi' : 'Needs action'} value={priorityCards.length} />
        <SummaryPill label={isId ? 'Usaha dikelola' : 'Managed businesses'} value={counts.businesses} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => (
            <ManageActionCard key={card.id} card={card} />
          ))}
        </div>

        <aside className="ui-panel h-fit rounded-3xl p-4 sm:p-5">
          <h2 className="text-base font-bold text-[color:var(--app-text)]">
            {copy.focus}
          </h2>
          <div className="mt-3 space-y-2">
            {priorityCards.length > 0 ? (
              priorityCards.map(card => (
                <Link
                  key={card.id}
                  href={card.href}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-white px-3 py-3 text-sm transition hover:border-[color:var(--app-accent-border)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[color:var(--app-text)]">
                      {card.title}
                    </span>
                    <span className="text-xs text-[color:var(--app-text-soft)]">
                      {formatCount(card.count || 0)} {card.countLabel}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                </Link>
              ))
            ) : (
              <p className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {copy.allGood}
              </p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="ui-panel rounded-2xl p-4">
      <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">
        {formatCount(value)}
      </p>
    </div>
  );
}

function ManageActionCard({ card }: { card: ManageCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className={cn(
        'group flex min-h-[176px] flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[color:var(--app-surface)]',
        card.priority
          ? 'border-amber-300 ring-2 ring-amber-100'
          : 'border-[color:var(--app-border)] hover:border-[color:var(--app-accent-border)]',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-right">
          <span className="block text-xl font-bold text-[color:var(--app-text)]">
            {typeof card.count === 'number' ? formatCount(card.count) : '-'}
          </span>
          <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            {card.countLabel}
          </span>
        </span>
      </span>
      <span className="mt-4 block">
        <span className="block text-base font-bold text-[color:var(--app-text)]">
          {card.title}
        </span>
        <span className="mt-1 line-clamp-2 block text-sm leading-6 text-[color:var(--app-text-soft)]">
          {card.description}
        </span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-[color:var(--app-accent)]">
        {card.action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
