'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Database,
  MessageCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  SOCIAL_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  type LajukanExploreCategory,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import { cn } from '@/lib/utils';

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const CATEGORY_ACCENTS = [
  '#047857',
  '#0369a1',
  '#b45309',
  '#6d28d9',
  '#be185d',
];

const CATEGORY_CARD_COPY: Record<
  string,
  {
    supplyId: string;
    supplyEn: string;
    demandId: string;
    demandEn: string;
  }
> = {
  supplies: {
    supplyId: 'Supplier, bahan baku, kemasan',
    supplyEn: 'Suppliers, materials, packaging',
    demandId: 'Pembeli cari stok dan supplier',
    demandEn: 'Buyers need stock and suppliers',
  },
  service: {
    supplyId: 'Desain, foto, website, legal',
    supplyEn: 'Design, photo, website, legal',
    demandId: 'Pembeli cari jasa usaha',
    demandEn: 'Buyers need business services',
  },
  equipment: {
    supplyId: 'Mesin, alat, sewa, servis',
    supplyEn: 'Machines, tools, rental, repair',
    demandId: 'Usaha cari alat produksi',
    demandEn: 'Businesses need production tools',
  },
  property: {
    supplyId: 'Ruko, kios, booth, gudang',
    supplyEn: 'Shops, kiosks, booths, storage',
    demandId: 'Usaha cari lokasi jualan',
    demandEn: 'Businesses need selling places',
  },
  opportunity: {
    supplyId: 'Franchise, reseller, mitra',
    supplyEn: 'Franchise, reseller, partners',
    demandId: 'Calon mitra cari peluang',
    demandEn: 'Partners need opportunities',
  },
  community: {
    supplyId: 'Diskusi dan tanya jawab usaha',
    supplyEn: 'Business discussion and Q&A',
    demandId: 'Diskusi dan tanya jawab usaha',
    demandEn: 'Business discussion and Q&A',
  },
  video: {
    supplyId: 'Video usaha dan inspirasi',
    supplyEn: 'Business videos and ideas',
    demandId: 'Video usaha dan inspirasi',
    demandEn: 'Business videos and ideas',
  },
};

function ExploreCategoryCard({
  category,
  index,
  locale,
  href,
  mode,
}: {
  category: LajukanExploreCategory;
  index: number;
  locale: LajukanLocale;
  href: string;
  mode: 'supply' | 'demand';
}) {
  const isId = locale === 'id';
  const accent = CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length];
  const copy = CATEGORY_CARD_COPY[category.id];
  const title = isId ? category.labelId : category.labelEn;
  const subtitle =
    mode === 'demand'
      ? isId
        ? copy?.demandId
        : copy?.demandEn
      : isId
        ? copy?.supplyId
        : copy?.supplyEn;
  const actionLabel =
    mode === 'demand'
      ? isId
        ? `Lihat permintaan pembeli untuk ${title}`
        : `See buyer requests for ${title}`
      : isId
        ? `Cari ${title}`
        : `Find ${title}`;

  return (
    <Link
      href={href}
      onClick={() => {
        void trackLajukanEvent('explore_category_click', {
          properties: {
            locale,
            source: 'explore_hub',
            route: '/explore',
            category: category.slug,
            position: index,
            side: mode,
          },
        });
      }}
      aria-label={actionLabel}
      className="group relative grid min-h-[92px] min-w-0 cursor-pointer grid-cols-[44px_minmax(0,1fr)_36px] items-center gap-3 overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--category-accent)] hover:shadow-[0_18px_38px_-30px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--category-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      style={
        {
          '--category-accent': accent,
          '--category-soft': `${accent}12`,
        } as React.CSSProperties
      }
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--category-soft)]">
        <Image
          src={category.image}
          alt=""
          fill
          sizes="44px"
          className="object-contain p-1 transition duration-300 group-hover:scale-105"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--category-accent)]">
          {title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs font-medium leading-4 text-[color:var(--app-text-soft)]">
          {subtitle || (isId ? category.descriptionId : category.descriptionEn)}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white transition group-hover:translate-x-0.5"
        style={{ backgroundColor: accent }}
      >
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function ExploreChannelCard({
  category,
  index,
  locale,
}: {
  category: LajukanExploreCategory;
  index: number;
  locale: LajukanLocale;
}) {
  const isId = locale === 'id';
  const accent = CATEGORY_ACCENTS[(index + 2) % CATEGORY_ACCENTS.length];
  const title = isId ? category.labelId : category.labelEn;
  const description = isId ? category.descriptionId : category.descriptionEn;
  const Icon = category.id === 'video' ? PlayCircle : MessageCircle;
  const actionLabel =
    category.id === 'video'
      ? isId
        ? 'Tonton video'
        : 'Watch videos'
      : isId
        ? 'Buka komunitas'
        : 'Open community';

  return (
    <Link
      href={category.id === 'video' ? '/reels' : '/community'}
      aria-label={`${actionLabel}: ${title}`}
      className="group grid min-h-[132px] cursor-pointer grid-cols-[56px_minmax(0,1fr)] gap-4 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[color:var(--channel-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--channel-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
      style={
        {
          '--channel-accent': accent,
          '--channel-soft': `${accent}12`,
        } as React.CSSProperties
      }
    >
      <span className="relative h-14 w-14 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--channel-soft)]">
        <Image
          src={category.image}
          alt=""
          fill
          sizes="56px"
          className="object-contain p-1"
        />
      </span>
      <span className="min-w-0">
        <span
          className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          <Icon className="h-3 w-3" />
          {isId ? 'Belajar & jaringan' : 'Learning & network'}
        </span>
        <span className="block text-sm font-bold text-[color:var(--app-text)] group-hover:text-[color:var(--channel-accent)]">
          {title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-[color:var(--app-text-soft)]">
          {description}
        </span>
        <span
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold"
          style={{ color: accent }}
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

export function ExploreHubPage({ locale }: { locale: LajukanLocale }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchSide, setSearchSide] = useState<'supply' | 'demand'>('supply');
  const isId = locale === 'id';
  const marketplaceCategories = MARKETPLACE_EXPLORE_CATEGORIES;
  const isDemand = searchSide === 'demand';
  const socialCategories = SOCIAL_EXPLORE_CATEGORIES;

  const buildCategoryHref = (category: LajukanExploreCategory) => {
    if (searchSide === 'supply') return buildExploreCategoryHref(category);
    const params = new URLSearchParams({ side: 'demand' });
    return `${buildExploreCategoryHref(category)}?${params.toString()}`;
  };

  const submitSearch = (nextQuery = query) => {
    const clean = normalizeQuery(nextQuery);
    if (clean.length < 2) return;
    void trackLajukanEvent('navbar_search_submit', {
      properties: {
        locale,
        source: 'explore_hub',
        route: '/explore',
        query: clean,
        side: searchSide,
      },
    });
    const params = new URLSearchParams({
      q: clean,
      side: searchSide,
    });
    if (searchSide === 'demand') params.set('tab', 'needs');
    router.push(`/${locale}/explore?${params.toString()}`);
  };

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="min-w-0 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.5)] sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:items-center lg:gap-10">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl lg:text-4xl">
                {isDemand
                  ? isId
                    ? 'Temukan calon pembeli'
                    : 'Find potential buyers'
                  : isId
                    ? 'Cari kebutuhan usahamu'
                    : 'Find what your business needs'}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isDemand
                  ? isId
                    ? 'Lihat orang yang sedang mencari produk atau jasa seperti milikmu.'
                    : 'See people looking for products or services like yours.'
                  : isId
                    ? 'Cari bahan baku, supplier, jasa, mesin, atau tempat usaha.'
                    : 'Find materials, suppliers, services, tools, or business places.'}
              </p>
            </div>

            <div className="min-w-0">
              <div
                className="grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
                role="group"
                aria-label={isId ? 'Pilih tujuan pencarian' : 'Choose a search goal'}
              >
                {[
                  {
                    value: 'supply' as const,
                    label: isId ? 'Cari untuk usaha' : 'Find for my business',
                    icon: Store,
                  },
                  {
                    value: 'demand' as const,
                    label: isId ? 'Cari calon pembeli' : 'Find potential buyers',
                    icon: ClipboardList,
                  },
                ].map(option => {
                  const Icon = option.icon;
                  const active = searchSide === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSearchSide(option.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-center text-xs font-bold leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:px-3',
                        active
                          ? 'cursor-default bg-[color:var(--app-accent)] text-white shadow-sm'
                          : 'cursor-pointer text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <form
                role="search"
                action={`/${locale}/explore`}
                method="get"
                className="mt-2.5"
                onSubmit={event => {
                  event.preventDefault();
                  const submitted = new FormData(event.currentTarget).get('q');
                  submitSearch(
                    typeof submitted === 'string' ? submitted : query,
                  );
                }}
              >
                <label htmlFor="explore-hub-search" className="sr-only">
                  {isId ? 'Cari kebutuhan usaha' : 'Search business needs'}
                </label>
                <div className="flex min-h-[52px] min-w-0 items-center gap-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.5)] focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
                  <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
                  <input
                    type="search"
                    id="explore-hub-search"
                    name="q"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isDemand
                        ? isId
                          ? 'Contoh: pembeli butuh kemasan'
                          : 'Example: buyers need packaging'
                        : isId
                          ? 'Contoh: kemasan standing pouch'
                          : 'Example: standing pouch packaging'
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                    aria-label={isId ? 'Cari di Lajukan' : 'Search Lajukan'}
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                  <button
                    type="submit"
                    disabled={query.trim().length < 2}
                    className={cn(
                      'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none',
                      query.trim().length < 2 &&
                      'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span>{isId ? 'Cari' : 'Search'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                {searchSide === 'demand' ? (
                  <>
                    <input type="hidden" name="side" value="demand" />
                    <input type="hidden" name="tab" value="needs" />
                  </>
                ) : null}
              </form>
            </div>
          </div>
        </section>

        <section
          className="py-6 sm:py-8"
          aria-labelledby="explore-categories-title"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="explore-categories-title"
                className="text-lg font-bold text-[color:var(--app-text)] sm:text-xl"
              >
                {isDemand
                  ? isId
                    ? 'Pembeli sedang mencari apa?'
                    : 'What are buyers looking for?'
                  : isId
                    ? 'Cari berdasarkan kategori'
                    : 'Browse by category'}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {isDemand
                  ? isId
                    ? 'Pilih jenis produk atau jasa yang kamu tawarkan.'
                    : 'Choose the type of product or service you offer.'
                  : isId
                    ? 'Pilih satu kategori, lalu cari lebih spesifik.'
                    : 'Choose one category, then narrow your search.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {marketplaceCategories.map((category, index) => (
              <ExploreCategoryCard
                key={category.id}
                category={category}
                index={index}
                locale={locale}
                href={buildCategoryHref(category)}
                mode={searchSide}
              />
            ))}
          </div>
        </section>

        <details className="group border-t border-[color:var(--app-border)] py-5 sm:py-6">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
            <span>
              <span className="block text-base font-bold text-[color:var(--app-text)] sm:text-lg">
                {isId ? 'Komunitas, video, dan referensi' : 'Community, videos, and references'}
              </span>
              <span className="mt-0.5 block text-sm text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Opsional, untuk belajar dan mencari informasi tambahan.'
                  : 'Optional resources for learning and extra information.'}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {socialCategories.map((category, index) => (
              <ExploreChannelCard
                key={category.id}
                category={category}
                index={index}
                locale={locale}
              />
            ))}
            <Link
              href="/explore?tab=references"
              className="group grid min-h-[132px] cursor-pointer grid-cols-[56px_minmax(0,1fr)] gap-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
                <Database className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-900">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {isId ? 'Data publik' : 'Public data'}
                </span>
                <span className="block text-sm font-bold text-amber-950">
                  {isId ? 'Referensi tempat usaha' : 'Business place references'}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-amber-950/75">
                  {isId
                    ? 'Data lokasi untuk acuan, bukan toko atau penawaran aktif.'
                    : 'Location data for reference, not active stores or offers.'}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900">
                  {isId ? 'Lihat referensi' : 'View references'}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          </div>
        </details>

        <section
          className="pb-6 sm:pb-8"
          aria-label={isId ? 'Aksi lanjut' : 'Next action'}
        >
          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-sm font-bold text-[color:var(--app-text)] sm:text-base">
                {isDemand
                  ? isId
                    ? 'Punya produk atau jasa yang cocok?'
                    : 'Have what buyers need?'
                  : isId
                    ? 'Belum menemukan yang dibutuhkan?'
                    : 'Still not finding the right option?'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
                {isDemand
                  ? isId
                    ? 'Pasang penawaran agar calon pembeli bisa menemukanmu.'
                    : 'Post an offer so your product or service can be found.'
                  : isId
                    ? 'Tulis kebutuhanmu agar penjual atau penyedia jasa bisa membantu.'
                    : 'Post your need so providers can offer a solution.'}
              </p>
            </div>
            <Link
              href={isDemand ? '/create?side=supply' : '/create?side=demand'}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              {isDemand
                ? isId
                  ? 'Buat penawaran'
                  : 'Post an offer'
                : isId
                  ? 'Buat kebutuhan'
                  : 'Post a need'}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
