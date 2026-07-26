'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  MessageCircle,
  PlayCircle,
  Plus,
  Search,
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
  const actionLabel = isId ? 'Tekan untuk buka' : 'Tap to open';
  const modeLabel =
    mode === 'demand'
      ? isId
        ? 'Kebutuhan pembeli'
        : 'Buyer needs'
      : isId
        ? 'Penyedia'
        : 'Providers';

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
      aria-label={`${actionLabel}: ${title}`}
      className="group relative grid min-h-[124px] min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_38px] items-center gap-3 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--category-accent)] hover:shadow-[0_18px_38px_-30px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--category-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface-muted)]"
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
      <span className="min-w-0">
        <span className="mb-2 flex min-w-0 items-center gap-2">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--category-soft)]">
            <Image
              src={category.image}
              alt=""
              fill
              sizes="40px"
              className="object-contain p-1 transition duration-300 group-hover:scale-105"
            />
          </span>
          <span
            className="inline-flex min-w-0 items-center rounded-full px-2 py-1 text-[10px] font-bold"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <span className="truncate">{modeLabel}</span>
          </span>
        </span>
        <span className="block text-sm font-bold leading-5 text-[color:var(--app-text)] group-hover:text-[color:var(--category-accent)]">
          {title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs font-medium leading-4 text-[color:var(--app-text-soft)]">
          {subtitle || (isId ? category.descriptionId : category.descriptionEn)}
        </span>
        <span
          className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold"
          style={{ backgroundColor: `${accent}12`, color: accent }}
        >
          {actionLabel}
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
      href={buildExploreCategoryHref(category)}
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
    const clean = nextQuery.replace(/\s+/g, ' ').trim();
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
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.5)] sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:items-center lg:gap-10">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl lg:text-4xl">
                {isDemand
                  ? isId
                    ? 'Cari kebutuhan pembeli'
                    : 'Find buyer needs'
                  : isId
                    ? 'Mau cari apa?'
                    : 'What do you need?'}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isDemand
                  ? isId
                    ? 'Pilih kategori pembeli, lalu lihat brief yang bisa kamu tanggapi.'
                    : 'Choose a buyer category, then open requests you can respond to.'
                  : isId
                    ? 'Pilih kategori utama atau ketik kebutuhanmu di kolom pencarian.'
                    : 'Choose a main category or search directly.'}
              </p>
            </div>

            <div className="min-w-0">
              <div
                className="grid grid-cols-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
                role="tablist"
                aria-label={isId ? 'Pilih tujuan' : 'Choose a goal'}
              >
                {[
                  {
                    value: 'supply' as const,
                    label: isId ? 'Cari penyedia' : 'Find Providers',
                    shortLabel: isId ? 'Penyedia' : 'Providers',
                    icon: Store,
                  },
                  {
                    value: 'demand' as const,
                    label: isId ? 'Cari pembeli' : 'Find Buyers',
                    shortLabel: isId ? 'Pembeli' : 'Buyers',
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
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-2.5 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:justify-start sm:px-3',
                        active
                          ? 'cursor-default bg-[color:var(--app-accent)] text-white shadow-sm'
                          : 'cursor-pointer text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate sm:hidden">
                          {option.shortLabel}
                        </span>
                        <span className="hidden truncate sm:block">
                          {option.label}
                        </span>
                      </span>
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
                <label className="flex min-h-[52px] items-center gap-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.5)] focus-within:border-[color:var(--app-accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
                  <Search className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
                  <input
                    type="search"
                    name="q"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isDemand
                        ? isId
                          ? 'Contoh: butuh supplier kemasan'
                          : 'Example: needs packaging supplier'
                        : isId
                          ? 'Contoh: supplier kemasan'
                          : 'Example: packaging supplier'
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                    aria-label={isId ? 'Cari di Lajukan' : 'Search Lajukan'}
                  />
                  <button
                    type="submit"
                    disabled={query.trim().length < 2}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none',
                      query.trim().length < 2 &&
                      'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="hidden sm:inline">
                      {isId ? 'Cari' : 'Search'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </label>
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
                {isId ? 'Pilih kategori' : 'Choose a category'}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                {isDemand
                  ? isId
                    ? 'Pilih kategori kebutuhan pembeli yang paling cocok.'
                    : 'Choose the buyer need category that fits.'
                  : isId
                    ? 'Pilih kategori utama yang paling dekat dengan kebutuhanmu.'
                    : 'Choose the main category closest to your need.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                {isId ? 'Komunitas dan video' : 'Community and videos'}
              </span>
              <span className="mt-0.5 block text-sm text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Opsional, untuk diskusi dan inspirasi usaha.'
                  : 'Optional, for discussions and business ideas.'}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {socialCategories.map((category, index) => (
              <ExploreChannelCard
                key={category.id}
                category={category}
                index={index}
                locale={locale}
              />
            ))}
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
                    ? 'Punya yang mereka butuhkan?'
                    : 'Have what buyers need?'
                  : isId
                    ? 'Belum menemukan yang cocok?'
                    : 'Still not finding the right option?'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
                {isDemand
                  ? isId
                    ? 'Buat penawaran agar produk atau jasamu mudah ditemukan.'
                    : 'Post an offer so your product or service can be found.'
                  : isId
                    ? 'Tulis kebutuhanmu agar penyedia dapat menawarkan solusi.'
                    : 'Post your need so providers can offer a solution.'}
              </p>
            </div>
            <Link
              href={isDemand ? '/create?side=supply' : '/create?side=demand'}
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
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
