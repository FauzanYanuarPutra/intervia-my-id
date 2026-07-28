'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  FileText,
  ImageIcon,
  Loader2,
  MessageCircle,
  Package,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
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

type ContentKind = 'listing' | 'community' | 'reel';

type ContentPreview = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  mediaType: 'image' | 'video' | 'none';
  status: string;
  metric: number;
  metricLabel: string;
};

type PreviewState = {
  listings: ContentPreview[];
  community: ContentPreview[];
  reels: ContentPreview[];
};

type AttentionItem = {
  id: string;
  href: string;
  title: string;
  detail: string;
  icon: LucideIcon;
};

type OperationItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  value?: number;
  valueLabel: string;
  tone: 'emerald' | 'sky' | 'violet' | 'amber' | 'slate';
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

const EMPTY_PREVIEWS: PreviewState = {
  listings: [],
  community: [],
  reels: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readNumber(record: Record<string, unknown>, keys: string[]): number {
  const sources = [
    record,
    asRecord(record.stats),
    asRecord(record.metrics),
    asRecord(record.metadata),
  ].filter(Boolean) as Record<string, unknown>[];

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value.replace(/[^\d.-]/g, ''))
            : Number.NaN;
      if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
  }

  return 0;
}

function readMedia(value: unknown, depth = 0): string {
  if (depth > 4) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^(https?:\/\/|\/)/i.test(trimmed) ? trimmed : '';
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const media = readMedia(entry, depth + 1);
      if (media) return media;
    }
    return '';
  }

  const record = asRecord(value);
  if (!record) return '';

  for (const key of [
    'thumbnail',
    'thumbnailUrl',
    'thumbnail_url',
    'poster',
    'posterUrl',
    'cover_image',
    'image_url',
    'imageUrl',
    'url',
    'src',
  ]) {
    const media = readMedia(record[key], depth + 1);
    if (media) return media;
  }

  for (const key of ['imageUrls', 'image_urls', 'images', 'media', 'gallery']) {
    const media = readMedia(record[key], depth + 1);
    if (media) return media;
  }

  return '';
}

function listFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(item => asRecord(item)) as Record<string, unknown>[];
  }
  const record = asRecord(payload);
  if (!record) return [];

  for (const key of ['items', 'results', 'data', 'rooms', 'stores']) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(item => asRecord(item)) as Record<string, unknown>[];
    }
    const nested = asRecord(value);
    if (!nested) continue;
    for (const nestedKey of ['items', 'results', 'data', 'rooms', 'stores']) {
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
  const record = asRecord(payload);
  const total = record?.total;
  if (typeof total === 'number' && Number.isFinite(total)) {
    return Math.max(0, total);
  }
  return listFromPayload(payload).length;
}

function buildPreview(
  row: Record<string, unknown>,
  kind: ContentKind,
  fallbackStatus = '',
): ContentPreview {
  const metadata = asRecord(row.metadata);
  const mediaType =
    readText(row, ['mediaType', 'media_type']) === 'video'
      ? 'video'
      : readText(row, ['mediaType', 'media_type']) === 'image'
        ? 'image'
        : 'none';

  const imageUrl =
    readMedia(row) ||
    (mediaType === 'image'
      ? readText(row, ['videoSrc', 'video_src', 'sourceUrl', 'source_url'])
      : '');

  const title =
    readText(row, ['title', 'name', 'caption']) ||
    (kind === 'listing'
      ? 'Postingan tanpa judul'
      : kind === 'community'
        ? 'Diskusi komunitas'
        : 'Reel tanpa judul');

  const description =
    readText(row, ['summary', 'description', 'caption', 'content', 'body']) ||
    readText(metadata || {}, ['summary', 'description', 'caption']);

  const metric =
    kind === 'listing'
      ? readNumber(row, ['view_count', 'views_count', 'views'])
      : kind === 'community'
        ? readNumber(row, ['replyCount', 'reply_count', 'comments'])
        : readNumber(row, ['likesCount', 'likes_count', 'likes']);

  return {
    id: readText(row, ['id', 'slug']) || `${kind}-${title}`,
    title,
    description,
    imageUrl,
    mediaType: imageUrl ? 'image' : mediaType,
    status:
      readText(row, ['content_status', 'status', 'state']) || fallbackStatus,
    metric,
    metricLabel:
      kind === 'listing' ? 'views' : kind === 'community' ? 'balasan' : 'suka',
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat('id-ID', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export default function ManageHubClient({ isId }: ManageHubClientProps) {
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const [counts, setCounts] = useState<CountState>(EMPTY_COUNTS);
  const [previews, setPreviews] = useState<PreviewState>(EMPTY_PREVIEWS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const copy = useMemo(
    () => ({
      eyebrow: isId ? 'Studio konten' : 'Content studio',
      title: isId
        ? 'Semua kontenmu, terlihat dalam sekali pandang.'
        : 'See all your content at a glance.',
      subtitle: isId
        ? 'Listing, diskusi komunitas, dan reels punya ruang masing-masing. Pilih yang ingin kamu rapikan, lalu lanjutkan di editor yang tepat.'
        : 'Listings, community discussions, and reels each have their own space. Pick what needs work, then continue in the right editor.',
      create: isId ? 'Buat konten' : 'Create content',
      refresh: isId ? 'Perbarui data' : 'Refresh data',
      login: isId
        ? 'Masuk untuk membuka studio kontenmu.'
        : 'Sign in to open your content studio.',
      loginCta: isId ? 'Masuk' : 'Sign in',
      loading: isId
        ? 'Menyiapkan studio konten...'
        : 'Preparing your studio...',
      partial: isId
        ? 'Sebagian data belum tersambung. Konten yang tersedia tetap bisa dikelola.'
        : 'Some data is unavailable. You can still manage the content shown.',
      attention: isId ? 'Perlu perhatianmu' : 'Needs your attention',
      attentionHint: isId
        ? 'Selesaikan yang paling penting lebih dulu.'
        : 'Handle the most important items first.',
      allGood: isId ? 'Semua terlihat rapi' : 'Everything looks tidy',
      allGoodHint: isId
        ? 'Tidak ada draft atau transaksi aktif yang mendesak.'
        : 'There are no urgent drafts or active transactions.',
      contentTitle: isId ? 'Konten saya' : 'My content',
      contentHint: isId
        ? 'Tiga jenis konten, tiga tampilan yang mudah dibedakan.'
        : 'Three content types with clear visual differences.',
      operationsTitle: isId ? 'Operasional' : 'Operations',
      operationsHint: isId
        ? 'Chat, transaksi, usaha, insight, dan alat bantu dipisahkan dari konten.'
        : 'Chats, transactions, business tools, insights, and assistants stay separate from content.',
      open: isId ? 'Buka pengelola' : 'Open manager',
      newItem: isId ? 'Buat baru' : 'Create new',
    }),
    [isId],
  );

  const loadData = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setPartialError(false);

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
        authFetch('/api/reels?mine=true&limit=50', { cache: 'no-store' }),
        authFetch('/api/transactions?limit=50', { cache: 'no-store' }),
        authFetch('/api/chat/inbox', { cache: 'no-store' }),
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
        transactionsPayload,
        inboxPayload,
        storesPayload,
      ] = payloads;

      const activeListings = listFromPayload(activePayload);
      const draftListings = listFromPayload(draftPayload);
      const communityItems = listFromPayload(communityPayload);
      const reelItems = listFromPayload(reelsPayload);
      const transactionItems = listFromPayload(transactionsPayload);

      setCounts({
        activeListings: countPayload(activePayload),
        draftListings: countPayload(draftPayload),
        archivedListings: countPayload(archivedPayload),
        communityPosts: countPayload(communityPayload),
        reels: countPayload(reelsPayload),
        activeTransactions: transactionItems.filter(item => {
          const status = readText(item, ['status', 'state']).toLowerCase();
          return (
            status !== '' &&
            !['completed', 'cancelled', 'canceled', 'failed'].includes(status)
          );
        }).length,
        inboxRooms: countPayload(inboxPayload),
        businesses: countPayload(storesPayload),
      });

      setPreviews({
        listings: [
          ...activeListings
            .slice(0, 2)
            .map(item => buildPreview(item, 'listing', 'active')),
          ...draftListings
            .slice(0, 1)
            .map(item => buildPreview(item, 'listing', 'draft')),
        ],
        community: communityItems
          .slice(0, 3)
          .map(item => buildPreview(item, 'community', 'published')),
        reels: reelItems
          .slice(0, 3)
          .map(item => buildPreview(item, 'reel', 'published')),
      });

      setPartialError(
        results.some(result => result.status === 'rejected') ||
          responses.some(response => response && !response.ok),
      );
      setLoading(false);
      setRefreshing(false);
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

    if (counts.draftListings > 0) {
      items.push({
        id: 'drafts',
        href: '/my-listings?status=draft',
        title: isId ? 'Lanjutkan draft' : 'Finish your drafts',
        detail: isId
          ? `${formatCount(counts.draftListings)} belum selesai`
          : `${formatCount(counts.draftListings)} unfinished`,
        icon: FileText,
      });
    }

    if (counts.activeTransactions > 0) {
      items.push({
        id: 'transactions',
        href: '/transactions',
        title: isId ? 'Cek transaksi berjalan' : 'Review active transactions',
        detail: isId
          ? `${formatCount(counts.activeTransactions)} perlu dipantau`
          : `${formatCount(counts.activeTransactions)} to review`,
        icon: Package,
      });
    }

    if (counts.archivedListings > 0) {
      items.push({
        id: 'archive',
        href: '/my-listings?status=archived',
        title: isId ? 'Lihat arsip listing' : 'Review listing archive',
        detail: isId
          ? `${formatCount(counts.archivedListings)} tersimpan`
          : `${formatCount(counts.archivedListings)} archived`,
        icon: ClipboardList,
      });
    }

    return items.slice(0, 3);
  }, [
    counts.activeTransactions,
    counts.archivedListings,
    counts.draftListings,
    isId,
  ]);

  const operations = useMemo<OperationItem[]>(
    () => [
      {
        id: 'chat',
        href: '/chat',
        title: 'Chat',
        description: isId
          ? 'Balas calon mitra dan pelanggan.'
          : 'Reply to prospects and customers.',
        icon: MessageCircle,
        value: counts.inboxRooms,
        valueLabel: isId ? 'percakapan' : 'conversations',
        tone: 'sky',
      },
      {
        id: 'transactions',
        href: '/transactions',
        title: isId ? 'Transaksi' : 'Transactions',
        description: isId
          ? 'Pantau status pekerjaan dan pesanan.'
          : 'Track jobs and orders.',
        icon: Package,
        value: counts.activeTransactions,
        valueLabel: isId ? 'aktif' : 'active',
        tone: 'amber',
      },
      {
        id: 'business',
        href: '/usaha/dashboard',
        title: isId ? 'Profil usaha' : 'Business profiles',
        description: isId
          ? 'Toko, katalog, lokasi, dan tim.'
          : 'Store, catalog, location, and team.',
        icon: Store,
        value: counts.businesses,
        valueLabel: isId ? 'usaha' : 'businesses',
        tone: 'emerald',
      },
      {
        id: 'insight',
        href: '/dashboard',
        title: isId ? 'Insight' : 'Insights',
        description: isId
          ? 'Lihat performa dan peluang perbaikan.'
          : 'See performance and opportunities.',
        icon: BarChart3,
        valueLabel: isId ? 'dashboard' : 'dashboard',
        tone: 'violet',
      },
      {
        id: 'ai',
        href: '/profile/ai',
        title: isId ? 'AI pribadi' : 'Personal AI',
        description: isId
          ? 'Bantu ide, copy, dan draft konten.'
          : 'Help with ideas, copy, and drafts.',
        icon: Bot,
        valueLabel: isId ? 'asisten' : 'assistant',
        tone: 'slate',
      },
    ],
    [counts.activeTransactions, counts.businesses, counts.inboxRooms, isId],
  );

  if (authLoading || loading) {
    return <ManageHubSkeleton label={copy.loading} />;
  }

  if (!isAuthenticated) {
    return (
      <main className="page-shell page-rhythm py-8">
        <section className="ui-panel ui-hero-panel rounded-[2rem] p-6 sm:p-8">
          <p className="ui-kicker">
            <AlertCircle className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 max-w-xl text-2xl font-black tracking-tight text-[color:var(--app-text)] sm:text-4xl">
            {copy.login}
          </h1>
          <Link
            href="/login"
            className="ui-button-primary mt-6 inline-flex items-center gap-2 px-5 text-sm font-black"
          >
            {copy.loginCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  const socialCount = counts.communityPosts + counts.reels;
  const needsAction = counts.draftListings + counts.activeTransactions;

  return (
    <main
      data-testid="manage-studio"
      className="page-shell page-rhythm py-4 sm:py-7"
    >
      <section
        data-testid="manage-studio-hero"
        data-visual-surface="dark"
        className="manage-studio-hero relative isolate overflow-hidden rounded-[2rem] border border-emerald-800 bg-emerald-950 p-5 text-white shadow-[0_24px_70px_-40px_rgba(5,46,37,0.8)] sm:p-7 lg:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/3 -z-10 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl"
        />

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-end">
          <div>
            <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-50 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.045em] sm:text-4xl lg:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base sm:leading-7">
              {copy.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/create"
                className="manage-studio-create inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                {copy.create}
              </Link>
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={refreshing}
                className="manage-studio-refresh inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {copy.refresh}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <HeroMetric
              label={isId ? 'Listing tayang' : 'Live listings'}
              value={counts.activeListings}
            />
            <HeroMetric
              label={isId ? 'Konten sosial' : 'Social content'}
              value={socialCount}
            />
            <HeroMetric
              label={isId ? 'Perlu aksi' : 'Needs action'}
              value={needsAction}
              emphasis={needsAction > 0}
            />
            <HeroMetric
              label={isId ? 'Percakapan' : 'Conversations'}
              value={counts.inboxRooms}
            />
          </div>
        </div>
      </section>

      {partialError ? (
        <section className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
          <span>{copy.partial}</span>
        </section>
      ) : null}

      <section
        data-testid="manage-attention"
        data-attention-state={
          attentionItems.length > 0 ? 'needs-action' : 'clear'
        }
        className={cn(
          'manage-attention-panel rounded-3xl border p-4 sm:p-5',
          attentionItems.length > 0
            ? 'border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#fff7ed)]'
            : 'border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#f0fdfa)]',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
              attentionItems.length > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700',
            )}
          >
            {attentionItems.length > 0 ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-[color:var(--app-text)]">
              {attentionItems.length > 0 ? copy.attention : copy.allGood}
            </h2>
            <p className="mt-0.5 text-sm text-[color:var(--app-text-soft)]">
              {attentionItems.length > 0
                ? copy.attentionHint
                : copy.allGoodHint}
            </p>
          </div>
        </div>

        {attentionItems.length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {attentionItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[color:var(--app-text)]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[color:var(--app-text-soft)]">
                      {item.detail}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-amber-600 transition group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="manage-content-title">
        <SectionHeading
          id="manage-content-title"
          title={copy.contentTitle}
          description={copy.contentHint}
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ContentChannelCard
            kind="listing"
            title={isId ? 'Listing' : 'Listings'}
            description={
              isId
                ? 'Produk, jasa, kebutuhan, dan peluang yang kamu tayangkan.'
                : 'Products, services, needs, and opportunities you publish.'
            }
            href="/my-listings"
            createHref="/create"
            count={counts.activeListings}
            countLabel={isId ? 'tayang' : 'live'}
            secondaryValue={counts.draftListings}
            secondaryLabel={isId ? 'draft' : 'drafts'}
            previews={previews.listings}
            openLabel={copy.open}
            createLabel={copy.newItem}
            emptyLabel={
              isId
                ? 'Belum ada listing. Mulai dari kebutuhan usahamu.'
                : 'No listings yet.'
            }
          />
          <ContentChannelCard
            kind="community"
            title={isId ? 'Komunitas' : 'Community'}
            description={
              isId
                ? 'Pertanyaan, diskusi, dan pengalaman yang kamu bagikan.'
                : 'Questions, discussions, and experiences you share.'
            }
            href="/manage/community"
            createHref="/community?compose=post"
            count={counts.communityPosts}
            countLabel={isId ? 'postingan' : 'posts'}
            previews={previews.community}
            openLabel={copy.open}
            createLabel={copy.newItem}
            emptyLabel={
              isId
                ? 'Belum ada diskusi. Mulai obrolan yang bermanfaat.'
                : 'No discussions yet.'
            }
          />
          <ContentChannelCard
            kind="reel"
            title="Reels"
            description={
              isId
                ? 'Video singkat, tutorial, dan cerita di balik usahamu.'
                : 'Short videos, tutorials, and stories behind your business.'
            }
            href="/manage/reels"
            createHref="/reels?upload=1"
            count={counts.reels}
            countLabel="reels"
            previews={previews.reels}
            openLabel={copy.open}
            createLabel={copy.newItem}
            emptyLabel={
              isId
                ? 'Belum ada reels. Bagikan cerita singkat pertamamu.'
                : 'No reels yet.'
            }
          />
        </div>
      </section>

      <section aria-labelledby="manage-operations-title">
        <SectionHeading
          id="manage-operations-title"
          title={copy.operationsTitle}
          description={copy.operationsHint}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {operations.map(item => (
            <OperationCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ManageHubSkeleton({ label }: { label: string }) {
  return (
    <main className="page-shell page-rhythm py-4 sm:py-7">
      <section className="min-h-72 animate-pulse rounded-[2rem] bg-emerald-900 p-6 text-emerald-50">
        <div className="h-7 w-32 rounded-full bg-white/15" />
        <div className="mt-5 h-12 max-w-xl rounded-2xl bg-white/15" />
        <div className="mt-3 h-5 max-w-2xl rounded-xl bg-white/10" />
        <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div
            key={item}
            className="h-[25rem] animate-pulse rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
          />
        ))}
      </section>
    </main>
  );
}

function HeroMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      data-emphasis={emphasis ? 'true' : 'false'}
      className="manage-studio-metric rounded-2xl border p-3.5 backdrop-blur sm:p-4"
    >
      <p className="text-2xl font-black tracking-tight sm:text-3xl">
        {formatCount(value)}
      </p>
      <p className="mt-1 text-[11px] font-bold text-emerald-50/80 sm:text-xs">
        {label}
      </p>
    </div>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2
          id={id}
          className="text-xl font-black tracking-tight text-[color:var(--app-text)] sm:text-2xl"
        >
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function ContentChannelCard({
  kind,
  title,
  description,
  href,
  createHref,
  count,
  countLabel,
  secondaryValue,
  secondaryLabel,
  previews,
  openLabel,
  createLabel,
  emptyLabel,
}: {
  kind: ContentKind;
  title: string;
  description: string;
  href: string;
  createHref: string;
  count: number;
  countLabel: string;
  secondaryValue?: number;
  secondaryLabel?: string;
  previews: ContentPreview[];
  openLabel: string;
  createLabel: string;
  emptyLabel: string;
}) {
  const icon =
    kind === 'listing'
      ? ClipboardList
      : kind === 'community'
        ? MessageCircle
        : Clapperboard;
  const Icon = icon;
  const palette =
    kind === 'listing'
      ? {
          shell: 'border-emerald-200 bg-emerald-50/60',
          icon: 'bg-emerald-600 text-white',
          badge: 'bg-emerald-100 text-emerald-800',
          button: 'bg-emerald-700 text-white hover:bg-emerald-800',
        }
      : kind === 'community'
        ? {
            shell: 'border-sky-200 bg-sky-50/60',
            icon: 'bg-sky-600 text-white',
            badge: 'bg-sky-100 text-sky-800',
            button: 'bg-sky-700 text-white hover:bg-sky-800',
          }
        : {
            shell: 'border-rose-200 bg-rose-50/60',
            icon: 'bg-rose-600 text-white',
            badge: 'bg-rose-100 text-rose-800',
            button: 'bg-slate-950 text-white hover:bg-slate-800',
          };

  return (
    <article
      data-testid={`manage-channel-${kind}`}
      data-manage-channel={kind}
      className={cn(
        'manage-channel-card flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border p-3 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)] sm:p-4',
        palette.shell,
      )}
    >
      <div className="flex items-start gap-3 px-1 pb-3">
        <span
          className={cn(
            'manage-channel-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm',
            palette.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[color:var(--app-text)]">
              {title}
            </h3>
            <span
              className={cn(
                'inline-flex min-h-6 items-center rounded-full px-2.5 text-[11px] font-black',
                palette.badge,
              )}
            >
              {formatCount(count)} {countLabel}
            </span>
            {typeof secondaryValue === 'number' && secondaryLabel ? (
              <span className="inline-flex min-h-6 items-center rounded-full bg-amber-100 px-2.5 text-[11px] font-black text-amber-800">
                {formatCount(secondaryValue)} {secondaryLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[color:var(--app-text-soft)]">
            {description}
          </p>
        </div>
      </div>

      <ContentPreviewGallery
        kind={kind}
        previews={previews}
        emptyLabel={emptyLabel}
      />

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Link
          href={href}
          className={cn(
            'manage-channel-primary inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition',
            palette.button,
          )}
        >
          <span className="truncate">{openLabel}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
        <Link
          href={createHref}
          aria-label={`${createLabel} ${title}`}
          title={`${createLabel} ${title}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white text-[color:var(--app-text)] shadow-sm transition hover:-translate-y-0.5"
        >
          <Plus className="h-4.5 w-4.5" />
        </Link>
      </div>
    </article>
  );
}

function ContentPreviewGallery({
  kind,
  previews,
  emptyLabel,
}: {
  kind: ContentKind;
  previews: ContentPreview[];
  emptyLabel: string;
}) {
  if (previews.length === 0) {
    const Icon =
      kind === 'listing'
        ? ImageIcon
        : kind === 'community'
          ? MessageCircle
          : Play;
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/65 px-5 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[color:var(--app-text-soft)] shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <p className="mt-3 max-w-xs text-sm leading-5 text-[color:var(--app-text-soft)]">
          {emptyLabel}
        </p>
      </div>
    );
  }

  if (kind === 'reel') {
    return (
      <div className="grid h-48 grid-cols-3 gap-2 overflow-hidden rounded-2xl bg-slate-950 p-2">
        {previews.slice(0, 3).map((preview, index) => (
          <PreviewTile
            key={preview.id}
            preview={preview}
            kind={kind}
            className={cn(
              'h-full rounded-xl',
              index === 2 && previews.length < 3 ? 'hidden sm:block' : '',
            )}
            compact
          />
        ))}
      </div>
    );
  }

  if (kind === 'community') {
    return (
      <div className="manage-community-preview grid h-48 gap-2 overflow-hidden rounded-2xl bg-sky-950 p-2">
        <PreviewTile
          preview={previews[0]}
          kind={kind}
          className="h-full rounded-xl"
        />
      </div>
    );
  }

  return (
    <div className="grid h-48 grid-cols-[1.45fr_0.75fr] gap-2 overflow-hidden rounded-2xl bg-emerald-950 p-2">
      <PreviewTile
        preview={previews[0]}
        kind={kind}
        className="h-full rounded-xl"
      />
      <div className="grid min-w-0 grid-rows-2 gap-2">
        {(previews.slice(1, 3).length > 0
          ? previews.slice(1, 3)
          : [previews[0], previews[0]]
        ).map((preview, index) => (
          <PreviewTile
            key={`${preview.id}-${index}`}
            preview={preview}
            kind={kind}
            className="h-full rounded-xl"
            compact
          />
        ))}
      </div>
    </div>
  );
}

function PreviewTile({
  preview,
  kind,
  className,
  compact = false,
}: {
  preview: ContentPreview;
  kind: ContentKind;
  className?: string;
  compact?: boolean;
}) {
  const fallback =
    kind === 'listing'
      ? 'bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]'
      : kind === 'community'
        ? 'bg-[linear-gradient(135deg,#e0f2fe,#7dd3fc)]'
        : 'bg-[linear-gradient(160deg,#4c0519,#be123c_55%,#fb7185)]';
  const Icon =
    kind === 'listing'
      ? ClipboardList
      : kind === 'community'
        ? MessageCircle
        : Play;

  return (
    <div
      className={cn(
        'group relative min-w-0 overflow-hidden bg-slate-900',
        fallback,
        className,
      )}
    >
      {preview.imageUrl ? (
        <Image
          src={preview.imageUrl}
          alt=""
          fill
          unoptimized
          sizes={kind === 'reel' ? '180px' : '420px'}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            className={cn('text-white/75', compact ? 'h-5 w-5' : 'h-8 w-8')}
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {kind === 'reel' ? (
        <span className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        </span>
      ) : null}
      <div
        className={cn('absolute inset-x-0 bottom-0', compact ? 'p-2' : 'p-3')}
      >
        <p
          className={cn(
            'font-black leading-tight text-white',
            compact ? 'line-clamp-1 text-[10px]' : 'line-clamp-2 text-sm',
          )}
        >
          {preview.title}
        </p>
        {!compact ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-white/80">
            <span className="rounded-full bg-white/15 px-2 py-1 backdrop-blur">
              {preview.status || 'aktif'}
            </span>
            {preview.metric > 0 ? (
              <span>
                {formatCount(preview.metric)} {preview.metricLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OperationCard({ item }: { item: OperationItem }) {
  const Icon = item.icon;
  const palette = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  }[item.tone];

  return (
    <Link
      href={item.href}
      className="group flex min-h-36 flex-col rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-md"
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
            palette,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <ChevronRight className="h-4 w-4 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5" />
      </span>
      <span className="mt-4 block text-sm font-black text-[color:var(--app-text)]">
        {item.title}
      </span>
      <span className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
        {item.description}
      </span>
      <span className="mt-auto pt-3 text-[11px] font-black text-[color:var(--app-text-soft)]">
        {typeof item.value === 'number'
          ? `${formatCount(item.value)} ${item.valueLabel}`
          : item.valueLabel}
      </span>
    </Link>
  );
}
