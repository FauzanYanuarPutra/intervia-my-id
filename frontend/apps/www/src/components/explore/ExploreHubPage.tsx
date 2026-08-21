'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { Header } from '@/components/layout/Header';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import {
  ExploreArtwork,
  ExploreModeTabs,
  ExploreSectionHeader,
  ExploreSurface,
  stripLajukanAvatarBackground,
  useExploreEmblaRail,
} from '@/components/explore/ExploreVisualSystem';
import { HUB_CATEGORY_COPY } from '@/components/explore/ExploreCopy';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildCategorySearchHref,
  buildExploreCategoryHref,
  type LajukanExploreCategory,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import { createLajukanAvatarDataUrl } from '@/lib/profile/avatar2d';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

type HubIntent = 'supply' | 'demand';

type CategoryCardItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  image: string;
  slug: string;
};

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function categoryHref(
  category: LajukanExploreCategory,
  intent: HubIntent,
): string {
  return intent === 'demand'
    ? buildCategorySearchHref({ category, side: 'demand' })
    : buildExploreCategoryHref(category);
}

function CategoryCard({
  item,
  locale,
  position,
  intent,
}: {
  item: CategoryCardItem;
  locale: LajukanLocale;
  position: number;
  intent: HubIntent;
}) {
  return (
    <Link
      href={item.href}
      aria-label={`${item.label}. ${item.description}`}
      onClick={() => {
        void trackLajukanEvent('explore_category_click', {
          properties: {
            locale,
            source: 'explore_hub_main_categories',
            route: '/explore',
            category: item.slug,
            position,
            side: intent,
          },
        });
      }}
      className={cn(
        'group flex h-full min-h-[112px] min-w-0 flex-col rounded-[15px] border border-zinc-200/80 bg-white p-2.5',
        'transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_34px_-30px_rgba(15,23,42,0.45)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
        'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
        'sm:min-h-[122px] sm:rounded-[16px] sm:p-3',
        'lg:min-h-[132px]',
      )}
    >
      <div className="flex min-h-[48px] items-start justify-between gap-1.5 sm:min-h-[52px] sm:gap-2">
        <ExploreArtwork
          src={item.image}
          alt=""
          visualId={item.id}
          size="md"
          muted
        />
        <ArrowRight
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-zinc-700 dark:group-hover:text-emerald-400"
        />
      </div>

      <h3 className="relative z-10 mt-1.5 line-clamp-2 text-[11px] font-black leading-[14px] tracking-[-0.015em] text-zinc-950 dark:text-zinc-50 min-[390px]:text-[12px] min-[390px]:leading-4 sm:mt-2 sm:text-[13px]">
        {item.label}
      </h3>

      <p className="relative z-10 mt-1 hidden line-clamp-1 text-[10px] font-medium leading-4 text-zinc-400 dark:text-zinc-500 md:block lg:text-[11px]">
        {item.description}
      </p>
    </Link>
  );
}

function UtilityCard({
  href,
  image,
  visualId,
  avatar = false,
  title,
  description,
}: {
  href: string;
  image: string;
  visualId: string;
  avatar?: boolean;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group grid min-h-[94px] min-w-0 grid-cols-[52px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-[15px] border border-zinc-200/80 bg-white p-2.5',
        'transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_32px_-30px_rgba(15,23,42,0.4)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
        'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
        'sm:min-h-[104px] sm:grid-cols-[58px_minmax(0,1fr)_20px] sm:gap-3 sm:rounded-[16px] sm:p-3',
        'lg:min-h-[110px]',
      )}
    >
      <div className="flex min-w-0 items-center justify-center">
        <ExploreArtwork
          src={image}
          alt=""
          visualId={visualId}
          size="md"
          variant={avatar ? 'avatar' : 'category'}
          muted={!avatar}
        />
      </div>

      <div className="relative z-10 min-w-0">
        <h3 className="truncate text-[12px] font-black tracking-[-0.015em] text-zinc-950 dark:text-zinc-50 sm:text-[13px] lg:text-sm">
          {title}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[9.5px] font-medium leading-[15px] text-zinc-500 dark:text-zinc-400 sm:mt-1 sm:text-[10.5px] sm:leading-4">
          {description}
        </p>
      </div>

      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-zinc-700 dark:group-hover:text-emerald-400"
      />
    </Link>
  );
}

const MAP_IMAGE = '/images/hero/menu/map-01.png';

export function ExploreHubPage({ locale }: { locale: LajukanLocale }) {
  const router = useRouter();
  const isId = locale === 'id';

  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<HubIntent>('supply');

  const { emblaRef: examplesRailRef } = useExploreEmblaRail();
  const { emblaRef: categoryRailRef, emblaApi: categoryRailApi } =
    useExploreEmblaRail();

  const mainCategories = useMemo<CategoryCardItem[]>(
    () =>
      MARKETPLACE_EXPLORE_CATEGORIES.map(category => {
        const copy = HUB_CATEGORY_COPY[category.id];

        return {
          id: category.id,
          label:
            (isId ? copy?.labelId : copy?.labelEn) ||
            (isId ? category.shortLabelId : category.shortLabelEn),
          description:
            (isId ? copy?.descriptionId : copy?.descriptionEn) ||
            (isId ? category.descriptionId : category.descriptionEn),
          href: categoryHref(category, intent),
          image: category.image,
          slug: category.slug,
        };
      }),
    [intent, isId],
  );

  const community = LAJUKAN_EXPLORE_CATEGORIES.find(
    item => item.id === 'community',
  );
  const video = LAJUKAN_EXPLORE_CATEGORIES.find(item => item.id === 'video');

  const peopleImage = '/images/hero/menu/keahlian-01.png';

  const ctaImage = '/images/hero/menu/kebutuhan-01.png';

  const examples =
    intent === 'demand'
      ? isId
        ? ['kemasan makanan', 'jasa desain', 'freezer usaha']
        : ['food packaging', 'design service', 'business freezer']
      : isId
        ? ['supplier kemasan', 'jasa foto produk', 'mesin sealer']
        : ['packaging supplier', 'product photography', 'sealing machine'];

  const submitSearch = (nextQuery = query) => {
    const clean = normalizeQuery(nextQuery);
    if (clean.length < 2) return;

    void trackLajukanEvent('navbar_search_submit', {
      properties: {
        locale,
        source: 'explore_hub',
        route: '/explore',
        query: clean,
        side: intent,
      },
    });

    const params = new URLSearchParams({ q: clean, side: intent });
    if (intent === 'demand') params.set('tab', 'needs');

    router.push(`/${locale}/explore?${params.toString()}`);
  };

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
      <div className="lg:hidden">
        <Header />
        <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1120px] px-3 py-3 sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-4">
        {/* HERO */}
        <ExploreSurface elevated className="p-3.5 sm:p-5 lg:p-6">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] lg:items-end lg:gap-7">
            <div className="min-w-0">
              <h1 className="text-[clamp(1.55rem,5vw,2.55rem)] font-black leading-[1.02] tracking-[-0.045em] text-zinc-950 dark:text-white">
                {isId ? 'Mau cari apa?' : 'What are you looking for?'}
              </h1>

              <ExploreModeTabs
                value={intent}
                options={[
                  {
                    value: 'supply' as const,
                    label: isId ? 'Cari produk & jasa' : 'Find products & services',
                    hint: isId ? 'Untuk kebutuhan usaha' : 'For business needs',
                  },
                  {
                    value: 'demand' as const,
                    label: isId ? 'Cari pembeli' : 'Find buyers',
                    hint: isId ? 'Untuk yang jualan' : 'For sellers',
                  },
                ]}
                onChange={setIntent}
                ariaLabel={isId ? 'Tujuan pencarian' : 'Search purpose'}
                className="mt-3 w-full max-w-[560px]"
              />
            </div>

            <div className="min-w-0">
              <form
                role="search"
                action={`/${locale}/explore`}
                method="get"
                onSubmit={event => {
                  event.preventDefault();
                  const submitted = new FormData(event.currentTarget).get('q');
                  submitSearch(
                    typeof submitted === 'string' ? submitted : query,
                  );
                }}
                className={cn(
                  'flex min-h-[50px] w-full min-w-0 items-center gap-2 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1.5 pl-3',
                  'transition focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/5',
                  'dark:border-zinc-800 dark:bg-zinc-900/75 dark:focus-within:border-emerald-800 dark:focus-within:bg-zinc-950',
                  'sm:min-h-[54px]',
                )}
              >
                <Search
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 sm:h-[18px] sm:w-[18px]"
                />

                <label htmlFor="explore-hub-search" className="sr-only">
                  {isId ? 'Cari di Jelajahi' : 'Search Explore'}
                </label>

                <input
                  type="search"
                  id="explore-hub-search"
                  name="q"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    intent === 'demand'
                      ? isId
                        ? 'Ketik produk atau jasa yang kamu jual'
                        : 'Type what you sell'
                      : isId
                        ? 'Cari supplier, jasa, mesin, tempat...'
                        : 'Search suppliers, services, equipment...'
                  }
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600 sm:text-sm"
                  autoComplete="off"
                  enterKeyHint="search"
                />

                <input type="hidden" name="side" value={intent} />
                {intent === 'demand' ? (
                  <input type="hidden" name="tab" value="needs" />
                ) : null}

                <button
                  type="submit"
                  disabled={query.trim().length < 2}
                  className={cn(
                    'inline-flex h-9 min-w-[58px] shrink-0 items-center justify-center rounded-[10px] bg-zinc-950 px-2.5 text-[10px] font-black text-white',
                    'transition hover:bg-emerald-700 disabled:pointer-events-none dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300',
                    'sm:h-10 sm:min-w-[68px] sm:px-3.5 sm:text-xs',
                    query.trim().length < 2 && 'opacity-40',
                  )}
                >
                  {isId ? 'Cari' : 'Search'}
                </button>
              </form>

              <div
                ref={examplesRailRef}
                className="mt-2.5 w-full min-w-0 cursor-grab overflow-hidden active:cursor-grabbing"
                aria-label={isId ? 'Contoh pencarian' : 'Search examples'}
              >
                <div className="flex touch-pan-y gap-1.5">
                  {examples.map(example => (
                    <div key={example} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(example);
                          submitSearch(example);
                        }}
                        className="inline-flex h-8 max-w-[190px] items-center rounded-full border border-zinc-200 bg-white px-2.5 text-[9.5px] font-semibold text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white sm:max-w-[240px] sm:px-3 sm:text-[10.5px]"
                      >
                        <span className="truncate">{example}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ExploreSurface>

        {/* CATEGORIES */}
        <ExploreSurface className="mt-3 p-3 sm:p-4 lg:p-5">
          <ExploreSectionHeader
            title={
              intent === 'demand'
                ? isId
                  ? 'Kamu jual apa?'
                  : 'What do you sell?'
                : isId
                  ? 'Pilih kategori'
                  : 'Choose a category'
            }
            action={
              <EmblaDesktopControls
                api={categoryRailApi}
                isId={isId}
                compact
              />
            }
          />

          <div
            ref={categoryRailRef}
            className="mt-2.5 w-full min-w-0 cursor-grab overflow-hidden pb-1 pt-1.5 active:cursor-grabbing sm:mt-3 sm:pt-2"
            aria-label={isId ? 'Kategori utama' : 'Main categories'}
          >
            <div className="flex touch-pan-y gap-2 [backface-visibility:hidden] [will-change:transform] sm:gap-2.5">
              {mainCategories.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    'min-w-0 shrink-0',
                    'flex-[0_0_46%]',
                    'min-[420px]:flex-[0_0_39%]',
                    'sm:flex-[0_0_30.5%]',
                    'md:flex-[0_0_23.5%]',
                    'lg:flex-[0_0_18.4%]',
                  )}
                >
                  <CategoryCard
                    item={item}
                    locale={locale}
                    position={index}
                    intent={intent}
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="mt-1.5 text-[9px] font-semibold text-zinc-400 sm:hidden">
            {isId ? 'Geser untuk kategori lainnya' : 'Swipe for more categories'}
          </p>
        </ExploreSurface>

        {/* SECONDARY DESTINATIONS */}
        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
          <ExploreSurface className="min-w-0 p-3 sm:p-4">
            <ExploreSectionHeader
              title={isId ? 'Cari dengan cara lain' : 'Other ways to search'}
            />

            <div className="mt-2.5 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <UtilityCard
                href="/explore?tab=users"
                image={peopleImage}
                visualId="people"
                avatar
                title={isId ? 'Orang & Keahlian' : 'People & Skills'}
                description={
                  isId
                    ? 'Cari orang berdasarkan nama atau keahlian.'
                    : 'Find people by name or skill.'
                }
              />

              <UtilityCard
                href={`${UMKM_DISCOVERY_PATH}?view=map`}
                image={MAP_IMAGE}
                visualId="map"
                title={isId ? 'Usaha di Sekitar' : 'Businesses Nearby'}
                description={
                  isId
                    ? 'Cari toko dan usaha lewat peta.'
                    : 'Find shops and businesses on the map.'
                }
              />
            </div>
          </ExploreSurface>

          {community || video ? (
            <ExploreSurface className="min-w-0 p-3 sm:p-4">
              <ExploreSectionHeader
                title={isId ? 'Belajar & terhubung' : 'Learn & connect'}
              />

              <div className="mt-2.5 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {community ? (
                  <UtilityCard
                    href="/community"
                    image={community.image}
                    visualId="community"
                    title={isId ? 'Komunitas' : 'Community'}
                    description={
                      isId
                        ? 'Diskusi dan tanya sesama pelaku usaha.'
                        : 'Discuss with other business owners.'
                    }
                  />
                ) : null}

                {video ? (
                  <UtilityCard
                    href="/reels"
                    image={video.image}
                    visualId="video"
                    title={isId ? 'Video Usaha' : 'Business Videos'}
                    description={
                      isId
                        ? 'Tips, tutorial, dan inspirasi singkat.'
                        : 'Short tips, tutorials, and inspiration.'
                    }
                  />
                ) : null}
              </div>
            </ExploreSurface>
          ) : null}
        </div>

        {/* CTA */}
        <section
          className="relative mt-3 overflow-hidden rounded-[18px] border border-zinc-800 sm:rounded-[22px]"
          style={{
            backgroundColor: '#09090b',
            backgroundImage:
              'radial-gradient(circle at 82% 24%, rgba(16,185,129,0.20), transparent 38%), linear-gradient(135deg, #09090b 0%, #18181b 58%, #09090b 100%)',
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div
            className={cn(
              'relative z-10 grid min-w-0 grid-cols-1 px-4 pt-5',
              'sm:min-h-[260px] sm:grid-cols-[minmax(0,0.82fr)_minmax(280px,1.18fr)]',
              'sm:items-center sm:gap-4 sm:px-5 sm:py-5',
              'lg:min-h-[290px] lg:grid-cols-[minmax(0,0.78fr)_minmax(360px,1.22fr)]',
              'lg:gap-6 lg:px-7 lg:py-6',
            )}
          >
            <div className="relative z-20 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold !text-emerald-300 sm:text-[11px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />

                {intent === 'demand'
                  ? isId
                    ? 'Untuk penjual'
                    : 'For sellers'
                  : isId
                    ? 'Belum menemukan?'
                    : 'Still searching?'}
              </div>

              <h2 className="mt-2 max-w-[540px] text-[18px] font-black leading-[1.15] tracking-[-0.025em] !text-white sm:text-xl lg:text-2xl">
                {intent === 'demand'
                  ? isId
                    ? 'Biar pembeli yang cocok menemukanmu'
                    : 'Let the right buyers find you'
                  : isId
                    ? 'Biar penyedia yang cocok menemukanmu'
                    : 'Let the right providers find you'}
              </h2>

              <p className="mt-2 max-w-[460px] text-[11px] font-medium leading-[17px] !text-zinc-400 sm:text-xs sm:leading-5">
                {intent === 'demand'
                  ? isId
                    ? 'Pasang produk atau jasa yang kamu jual.'
                    : 'Post the products or services you sell.'
                  : isId
                    ? 'Tulis kebutuhanmu dan tunggu penawaran.'
                    : 'Post what you need and receive offers.'}
              </p>

              <Link
                href={
                  intent === 'demand'
                    ? '/create?side=supply'
                    : '/create?side=demand'
                }
                className={cn(
                  'group mt-4 inline-flex min-h-10 max-w-full items-center justify-center gap-2',
                  'rounded-[11px] border border-white/90 px-4 text-[11px] font-black',
                  '!bg-white !text-zinc-950 transition',
                  'hover:!border-emerald-100 hover:!bg-emerald-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  'sm:min-h-11 sm:px-5 sm:text-xs',
                )}
              >
                <span className="truncate">
                  {intent === 'demand'
                    ? isId
                      ? 'Pasang produk / jasa'
                      : 'Post product / service'
                    : isId
                      ? 'Buat kebutuhan'
                      : 'Post a need'}
                </span>

                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            <div
              aria-hidden="true"
              className={cn(
                'relative -mx-2 mt-2 h-[210px] min-w-0',
                'sm:-mr-3 sm:mt-0 sm:h-full sm:min-h-[230px]',
                'lg:-mr-5 lg:min-h-[260px]',
              )}
            >
              <div className="pointer-events-none absolute bottom-3 left-1/2 h-28 w-3/4 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />

              <Image
                src={ctaImage}
                alt=""
                fill
                sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 48vw, 520px"
                className={cn(
                  'relative z-10 object-contain object-bottom',
                  'drop-shadow-[0_18px_30px_rgba(16,185,129,0.16)]',
                  'sm:object-right',
                )}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}