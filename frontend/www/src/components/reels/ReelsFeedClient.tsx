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
  const search = searchParams.toString();
  const requestSearch = search ? `${search}&limit=18` : 'limit=18';
  const [items, setItems] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      label: isId ? 'Packaging' : 'Packaging',
      href: '/reels?q=packaging',
    },
    {
      label: isId ? 'Kopi' : 'Coffee',
      href: '/reels?q=kopi',
    },
  ];

  useEffect(() => {
    let alive = true;
    fetch(`/api/reels/feed?${requestSearch}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(payload => {
        if (alive) setItems(payload.data || []);
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
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set('q', query);
    } else {
      params.delete('q');
    }
    if (city) {
      params.set('city', city);
    } else {
      params.delete('city');
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <main className="page-shell page-rhythm py-8">
      <section className="ui-panel ui-hero-panel rounded-3xl p-6">
        <p className="ui-kicker">
          <Clapperboard className="h-3.5 w-3.5" />
          {isId ? 'Reels usaha' : 'Business reels'}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--app-text)]">
          {storeHint
            ? isId
              ? `Reels untuk ${storeHint}`
              : `Reels for ${storeHint}`
            : isId
              ? 'Scroll bukti usaha, lalu masuk ke toko'
              : 'Scroll business proof, then open the store'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Reels di Lajukan bukan buat hiburan kosong. Fungsinya untuk nunjukin proses, produk unggulan, dan ritme order yang benar-benar jalan.'
            : 'These reels are not for empty scrolling. They show process, hero products, and a real operating rhythm.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-white/90 px-3 py-2 text-xs font-semibold text-[color:var(--app-text)]"
            >
              <Store className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <form onSubmit={submitFilters} className="ui-panel mt-4 rounded-3xl p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--app-text-soft)]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={
                isId ? 'Cari nama toko atau produk' : 'Search store or product'
              }
              className="w-full rounded-2xl border border-[color:var(--app-border)] bg-white px-10 py-3 text-sm text-[color:var(--app-text)]"
            />
          </label>
          <input
            value={city}
            onChange={event => setCity(event.target.value)}
            placeholder={isId ? 'Filter kota' : 'City filter'}
            className="rounded-2xl border border-[color:var(--app-border)] bg-white px-3 py-3 text-sm text-[color:var(--app-text)]"
          />
          <button
            type="submit"
            className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" />
            {isId ? 'Cari reels' : 'Search reels'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
            <Search className="h-3.5 w-3.5" />
            {isId
              ? 'Search untuk kumpulan reels per produk atau toko.'
              : 'Search to group reels by product or store.'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
            <Volume2 className="h-3.5 w-3.5" />
            {isId
              ? 'Kalau video memang tanpa track audio, tombol suara tidak akan menghasilkan suara.'
              : 'If a video has no audio track, unmuting will not add sound.'}
          </span>
        </div>
      </form>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-[color:var(--app-text-soft)]">
            {isId ? 'Memuat reels...' : 'Loading reels...'}
          </p>
        ) : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-[color:var(--app-text-soft)]">
            {isId
              ? 'Belum ada reels yang cocok dengan filter ini.'
              : 'No reels match the current filters.'}
          </p>
        ) : null}
        {items.map(item => {
          const filter = getReelFilterCss(item.filterPreset);
          const liveLabel = getLiveLabel(item);
          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-white shadow-[0_22px_40px_-32px_rgba(15,23,42,0.2)]"
            >
              <div className="relative aspect-[9/14] overflow-hidden bg-slate-100">
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
                    className="h-full w-full object-cover"
                    style={filter === 'none' ? undefined : { filter }}
                    loading="lazy"
                  />
                )}
                {liveLabel ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg">
                    <Radio className="h-3.5 w-3.5" />
                    {liveLabel}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                    {item.store.name}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    {item.store.city}
                  </p>
                </div>
                <p className="text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {item.hook}
                </p>
                <p className="text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {item.caption}
                </p>
                <div className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Yang di bawah video ini bukan dekorasi. Tombolnya buat 3 hal: buka toko, lihat kumpulan reels toko itu, atau cari ulang feed dengan kata kunci lain.'
                    : 'The actions below the video are functional: open the store, see that store’s reel collection, or search the feed again with another keyword.'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={item.store.storefrontPath}
                    className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold"
                  >
                    {isId ? 'Masuk ke toko' : 'Open store'}
                  </Link>
                  <Link
                    href={`${item.store.storefrontPath}?tab=reels`}
                    className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
                  >
                    {isId ? 'Lihat reels toko' : 'Store reels'}
                  </Link>
                  <Link
                    href={`/reels?store=${encodeURIComponent(item.store.slug)}`}
                    className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
                  >
                    {isId ? 'Filter toko ini' : 'Filter this store'}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
