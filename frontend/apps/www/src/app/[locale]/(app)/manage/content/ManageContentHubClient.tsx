'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  Clapperboard,
  FileText,
  Loader2,
  MessageSquareText,
  Newspaper,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';

type ContentCounts = {
  news: number;
  reels: number;
  community: number;
};

const EMPTY_COUNTS: ContentCounts = {
  news: 0,
  reels: 0,
  community: 0,
};

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function countPayload(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== 'object') return 0;

  const root = payload as Record<string, unknown>;
  for (const key of ['total', 'count', 'total_count', 'totalCount']) {
    const value = root[key];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Math.max(0, Number(value));
    }
  }

  for (const key of ['items', 'results', 'data', 'threads', 'reels']) {
    const value = root[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of ['items', 'results', 'data']) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey].length;
      }
    }
  }

  return 0;
}

export default function ManageContentHubClient() {
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const [counts, setCounts] = useState<ContentCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const copy = useMemo(
    () => ({
      title: 'Kelola konten',
      subtitle:
        'News, Reels, dan Community punya ruang masing-masing. Listing tetap dikelola di Kelola Listing.',
      publicLabel: 'Bagian publik',
      manageLabel: 'Kelola',
      newsTitle: 'News',
      newsDescription:
        'Kirim dan pantau artikel atau berita yang kamu ajukan ke Lajukan.',
      reelsTitle: 'Reels',
      reelsDescription:
        'Kelola video pendek yang kamu publikasikan untuk memperkenalkan usaha atau produk.',
      communityTitle: 'Community',
      communityDescription:
        'Kelola diskusi dan postingan komunitas tanpa mencampurnya dengan listing bisnis.',
      listingTitle: 'Listing',
      listingDescription:
        'Produk, jasa, kebutuhan, dan penawaran tetap berada di ruang Listing.',
      listingAction: 'Kelola Listing',
      refresh: 'Perbarui',
      login: 'Masuk untuk mengelola konten.',
      partial:
        'Sebagian jumlah belum bisa dimuat, tetapi semua halaman pengelolaan tetap bisa dibuka.',
    }),
    [],
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

      const results = await Promise.allSettled([
        authFetch('/api/news/submissions?limit=50', { cache: 'no-store' }),
        authFetch('/api/reels?mine=true&limit=50', { cache: 'no-store' }),
        authFetch('/api/forum/threads?mine=true&sort=new&page_size=50', {
          cache: 'no-store',
        }),
      ]);

      const payloads = await Promise.all(
        results.map(result =>
          result.status === 'fulfilled' ? readJson(result.value) : Promise.resolve({}),
        ),
      );

      setCounts({
        news: countPayload(payloads[0]),
        reels: countPayload(payloads[1]),
        community: countPayload(payloads[2]),
      });
      setPartialError(results.some(result => result.status === 'rejected'));

      setLoading(false);
      setRefreshing(false);
    },
    [authFetch, isAuthenticated],
  );

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData]);

  if (authLoading || loading) {
    return (
      <main className="page-shell py-5 sm:py-7">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-100 dark:bg-white/6" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(item => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/6"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="page-shell py-5 sm:py-7">
        <section className="mx-auto max-w-xl rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 sm:p-6">
          <FileText className="h-6 w-6 text-emerald-700" />
          <h1 className="mt-4 text-xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {copy.login}
          </h1>
        </section>
      </main>
    );
  }

  const cards = [
    {
      id: 'news',
      href: '/news/submissions',
      title: copy.newsTitle,
      description: copy.newsDescription,
      icon: Newspaper,
      count: counts.news,
      action: 'Kelola News',
      secondaryHref: '/news/submit',
      secondaryAction: 'Kirim News',
    },
    {
      id: 'reels',
      href: '/manage/reels',
      title: copy.reelsTitle,
      description: copy.reelsDescription,
      icon: Clapperboard,
      count: counts.reels,
      action: 'Kelola Reels',
      secondaryHref: '/reels',
      secondaryAction: 'Lihat Reels',
    },
    {
      id: 'community',
      href: '/manage/community',
      title: copy.communityTitle,
      description: copy.communityDescription,
      icon: Users,
      count: counts.community,
      action: 'Kelola Community',
      secondaryHref: '/community',
      secondaryAction: 'Buka Community',
    },
  ];

  return (
    <main className="page-shell min-w-0 max-w-full overflow-x-clip pb-8 pt-4 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <BookOpenText className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  {copy.publicLabel}
                </p>
                <h1 className="text-xl font-black tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
                  {copy.title}
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {copy.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60"
            aria-label={copy.refresh}
            title={copy.refresh}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </header>

        {partialError ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            {copy.partial}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                className="flex min-w-0 flex-col rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.28)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/8 dark:text-slate-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600 dark:bg-white/8 dark:text-slate-300">
                    {card.count}
                  </span>
                </div>

                <h2 className="mt-4 text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {card.title}
                </h2>
                <p className="mt-1.5 min-h-[66px] text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {card.description}
                </p>

                <div className="mt-4 space-y-2">
                  <Link
                    href={card.href}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white transition hover:bg-emerald-800"
                  >
                    {card.action}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={card.secondaryHref}
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/6"
                  >
                    {card.secondaryAction}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-400/15 dark:bg-emerald-500/8">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-400/15">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                Jangan cari Listing di sini
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                Listing, transaksi, dan operasional usaha tetap dipisahkan dari konten publik.
              </p>
              <Link
                href="/my-listings"
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-200 dark:ring-emerald-400/20 dark:hover:bg-white/6"
              >
                {copy.listingAction}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
