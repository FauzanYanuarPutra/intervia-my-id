'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ArrowRight,
  Clapperboard,
  Radio,
  Search,
  Store,
  Volume2,
} from 'lucide-react';

type ReelItem = {
  id: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  title: string;
  caption: string;
  hook: string;
  filterPreset?: 'natural' | 'warm' | 'fresh' | 'cinema' | 'mono' | 'pop';
  captureMode?: 'upload' | 'camera' | 'live';
  liveStatus?: 'none' | 'scheduled' | 'live' | 'ended';
  liveTitle?: string | null;
  liveScheduledAt?: string | null;
  store: {
    id: string;
    slug: string;
    name: string;
    city: string;
    phone?: string | null;
    storefrontPath: string;
  };
};

function getReelFilterCss(filterPreset?: ReelItem['filterPreset']) {
  switch (filterPreset) {
    case 'fresh':
      return 'saturate(1.12) contrast(1.04) brightness(1.03)';
    case 'warm':
      return 'sepia(0.08) saturate(1.14) contrast(1.02) brightness(1.02)';
    case 'pop':
      return 'saturate(1.28) contrast(1.08)';
    case 'cinema':
      return 'contrast(1.12) saturate(0.94) brightness(0.96)';
    case 'mono':
      return 'grayscale(1) contrast(1.1)';
    default:
      return 'none';
  }
}

function getLiveLabel(item: Pick<ReelItem, 'liveStatus' | 'captureMode'>) {
  if (item.liveStatus === 'live') return 'LIVE';
  if (item.liveStatus === 'scheduled' || item.captureMode === 'live') {
    return 'Live siap';
  }
  return null;
}

export default function ReelsFeedClient({ isId }: { isId: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [items, setItems] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const search = searchParams.toString();
  const requestSearch = search ? `${search}&limit=18` : 'limit=18';
  const storeHint = searchParams.get('store') || '';

  const quickLinks = [
    {
      label: isId ? 'Semua reels' : 'All reels',
      href: '/reels',
    },
    {
      label: isId ? 'Supplier' : 'Suppliers',
      href: '/reels?q=supplier',
    },
    {
      label: 'Packaging',
      href: '/reels?q=packaging',
    },
    {
      label: isId ? 'Kopi' : 'Coffee',
      href: '/reels?q=kopi',
    },
  ];

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setCity(searchParams.get('city') || '');
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetch(`/api/reels/feed?${requestSearch}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(payload => {
        if (alive) setItems(payload.data || []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [requestSearch]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    const cleanQuery = query.trim();
    const cleanCity = city.trim();

    if (cleanQuery) {
      params.set('q', cleanQuery);
    } else {
      params.delete('q');
    }

    if (cleanCity) {
      params.set('city', cleanCity);
    } else {
      params.delete('city');
    }

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden py-4 sm:py-6 lg:py-8">
      <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 sm:px-4 md:px-6 lg:px-8">
        <section className="ui-panel ui-hero-panel min-w-0 rounded-2xl p-4 sm:rounded-3xl sm:p-6 lg:p-8">
          <p className="ui-kicker inline-flex max-w-full items-center gap-1.5">
            <Clapperboard className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isId ? 'Reels usaha' : 'Business reels'}</span>
          </p>

          <h1 className="mt-3 max-w-4xl break-words text-2xl font-bold leading-tight tracking-tight text-[color:var(--app-text)] sm:text-3xl lg:text-4xl">
            {storeHint
              ? isId
                ? `Reels untuk ${storeHint}`
                : `Reels for ${storeHint}`
              : isId
                ? 'Scroll bukti usaha, lalu masuk ke toko'
                : 'Scroll business proof, then open the store'}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-[15px]">
            {isId
              ? 'Reels di Lajukan bukan buat hiburan kosong. Fungsinya untuk nunjukin proses, produk unggulan, dan ritme order yang benar-benar jalan.'
              : 'These reels are not for empty scrolling. They show process, hero products, and a real operating rhythm.'}
          </p>

          <div className="-mx-1 mt-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex flex-none items-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--app-border)] bg-white/90 px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-white"
              >
                <Store className="h-3.5 w-3.5 shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <form
          onSubmit={submitFilters}
          className="ui-panel mt-3 min-w-0 rounded-2xl p-4 sm:mt-4 sm:rounded-3xl sm:p-5"
        >
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  isId ? 'Cari nama toko atau produk' : 'Search store or product'
                }
                className="w-full min-w-0 rounded-2xl border border-[color:var(--app-border)] bg-white py-3 pl-10 pr-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent)]"
              />
            </label>

            <input
              value={city}
              onChange={event => setCity(event.target.value)}
              placeholder={isId ? 'Filter kota' : 'City filter'}
              className="w-full min-w-0 rounded-2xl border border-[color:var(--app-border)] bg-white px-3 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent)]"
            />

            <button
              type="submit"
              className="ui-button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold lg:w-auto lg:min-w-32"
            >
              <ArrowRight className="h-4 w-4 shrink-0" />
              {isId ? 'Cari reels' : 'Search reels'}
            </button>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-xs text-[color:var(--app-text-soft)] md:grid-cols-2">
            <span className="flex min-w-0 items-start gap-2 rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2">
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {isId
                  ? 'Search untuk kumpulan reels per produk atau toko.'
                  : 'Search to group reels by product or store.'}
              </span>
            </span>

            <span className="flex min-w-0 items-start gap-2 rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2">
              <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {isId
                  ? 'Kalau video memang tanpa track audio, tombol suara tidak akan menghasilkan suara.'
                  : 'If a video has no audio track, unmuting will not add sound.'}
              </span>
            </span>
          </div>
        </form>

        <section className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`reel-skeleton-${index}`}
                  className="min-w-0 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-white sm:rounded-3xl"
                >
                  <div className="aspect-[9/16] w-full animate-pulse bg-[color:var(--app-surface-muted)]" />
                  <div className="space-y-3 p-4">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--app-surface-muted)]" />
                    <div className="h-5 w-4/5 animate-pulse rounded-full bg-[color:var(--app-surface-muted)]" />
                    <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--app-surface-muted)]" />
                  </div>
                </div>
              ))
            : null}

          {!loading && items.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--app-border)] bg-white p-6 text-center sm:p-8">
              <p className="text-sm text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Belum ada reels yang cocok dengan filter ini.'
                  : 'No reels match the current filters.'}
              </p>
            </div>
          ) : null}

          {!loading
            ? items.map(item => {
                const filter = getReelFilterCss(item.filterPreset);
                const liveLabel = getLiveLabel(item);

                return (
                  <article
                    key={item.id}
                    className="group min-w-0 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-white shadow-[0_22px_40px_-32px_rgba(15,23,42,0.2)] sm:rounded-3xl"
                  >
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-100">
                      {item.mediaType === 'video' ? (
                        <video
                          src={item.mediaUrl}
                          className="h-full w-full object-cover"
                          style={filter === 'none' ? undefined : { filter }}
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                          style={filter === 'none' ? undefined : { filter }}
                          loading="lazy"
                        />
                      )}

                      {liveLabel ? (
                        <span className="absolute left-2.5 top-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 truncate rounded-full bg-rose-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:left-3 sm:top-3">
                          <Radio className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{liveLabel}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                          {item.store.name}
                        </p>
                        <h2 className="mt-1 break-words text-base font-semibold leading-snug text-[color:var(--app-text)] sm:text-[17px]">
                          {item.title}
                        </h2>
                        <p className="mt-1 truncate text-sm text-[color:var(--app-text-soft)]">
                          {item.store.city}
                        </p>
                      </div>

                      <p className="break-words text-sm leading-6 text-[color:var(--app-text-soft)]">
                        {item.hook}
                      </p>

                      <p className="break-words text-sm leading-6 text-[color:var(--app-text-soft)]">
                        {item.caption}
                      </p>

                      <div className="min-w-0 rounded-2xl bg-[color:var(--app-surface-muted)] p-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Yang di bawah video ini bukan dekorasi. Tombolnya buat 3 hal: buka toko, lihat kumpulan reels toko itu, atau cari ulang feed dengan kata kunci lain.'
                          : 'The actions below the video are functional: open the store, see that store’s reel collection, or search the feed again with another keyword.'}
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <Link
                          href={item.store.storefrontPath}
                          className="ui-button-primary inline-flex min-h-11 min-w-0 items-center justify-center px-3 text-center text-sm font-semibold"
                        >
                          <span className="truncate">
                            {isId ? 'Masuk ke toko' : 'Open store'}
                          </span>
                        </Link>

                        <Link
                          href={`${item.store.storefrontPath}?tab=reels`}
                          className="ui-button-secondary inline-flex min-h-11 min-w-0 items-center justify-center px-3 text-center text-sm font-semibold"
                        >
                          <span className="truncate">
                            {isId ? 'Lihat reels toko' : 'Store reels'}
                          </span>
                        </Link>

                        <Link
                          href={`/reels?store=${encodeURIComponent(item.store.slug)}`}
                          className="ui-button-secondary inline-flex min-h-11 min-w-0 items-center justify-center px-3 text-center text-sm font-semibold sm:col-span-2 xl:col-span-1 2xl:col-span-2"
                        >
                          <span className="truncate">
                            {isId ? 'Filter toko ini' : 'Filter this store'}
                          </span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
        </section>
      </div>
    </main>
  );
}