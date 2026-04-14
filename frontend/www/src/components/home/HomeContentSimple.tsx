'use client';

import {
  Component,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { HomeDiscoveryFeed } from '@/components/home/HomeDiscoveryFeed';
import { Link, useRouter } from '@/i18n/navigation';
import { buildCreatePath } from '@/lib/createRoutes';
import {
  UMKM_DISCOVERY_PATH,
  UMKM_OWNER_ONBOARDING_PATH,
  UMKM_OWNER_PATH,
  buildUmkmStorefrontPath,
} from '@/lib/umkmSurface';
import {
  readUmkmCartSession,
  subscribeUmkmCartSession,
  type UmkmCartSession,
} from '@/lib/super-app/umkmCartSession';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

class HomeSectionBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { hasError: boolean }
> {
  constructor(props: {
    children: ReactNode;
    fallback: ReactNode;
    resetKey: string;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

type HomeContentSimpleProps = {
  locale: string;
};

type HeroIntent = 'need' | 'offer';
type HomeLauncherItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
};

function HomeSectionShell({
  children,
  hero = false,
  className,
}: {
  children: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'ui-page-section ui-home-section-shell px-2 sm:px-2.5 lg:px-3',
        className,
      )}
      data-home-section-hero={hero ? 'true' : undefined}
    >
      <div className="ui-home-section-content">{children}</div>
    </section>
  );
}

function HomeSectionFallback({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <HomeSectionShell>
      <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] dark:bg-slate-950 sm:px-5">
        <p className="text-sm font-semibold text-[color:var(--app-text)]">
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
          {body}
        </p>
        <div className="mt-4">
          <Link
            href={href}
            className="ui-button-primary ui-pressable inline-flex items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" />
            {action}
          </Link>
        </div>
      </div>
    </HomeSectionShell>
  );
}

function HomeLauncherGrid({ items }: { items: HomeLauncherItem[] }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5 sm:gap-2">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-label={item.label}
            className="ui-pressable ui-pressable-card group flex min-h-[78px] min-w-0 flex-col items-center justify-center rounded-[18px] bg-white px-1.5 py-2.5 text-center shadow-[0_16px_30px_-24px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:shadow-[0_22px_36px_-24px_color-mix(in_srgb,var(--app-accent)_24%,transparent)] dark:bg-slate-950/88 dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_16%,rgba(15,23,42,0.98))] sm:min-h-[96px] sm:rounded-[22px] sm:px-3 sm:py-3"
          >
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-[12px] shadow-[0_14px_24px_-20px_rgba(15,23,42,0.24)] transition group-hover:scale-105 sm:h-11 sm:w-11 sm:rounded-[18px]',
                item.iconClass,
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            </span>
            <span className="mt-2 text-[11px] font-semibold leading-[1.15] text-slate-800 dark:text-slate-100 sm:mt-3 sm:text-sm">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function HomeContentSimple({ locale }: HomeContentSimpleProps) {
  const resolvedLocale = locale || 'id';
  const isId = resolvedLocale === 'id';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [heroIntent, setHeroIntent] = useState<HeroIntent>('need');
  const [activeMenuCart, setActiveMenuCart] = useState<UmkmCartSession | null>(
    null,
  );

  const heroTabs = isId
    ? [
        { value: 'need' as const, label: 'Cari' },
        { value: 'offer' as const, label: 'Jual' },
      ]
    : [
        { value: 'need' as const, label: 'Find' },
        { value: 'offer' as const, label: 'Sell' },
      ];

  const heroConfig =
    heroIntent === 'need'
      ? {
          badge: isId ? 'Cari cepat' : 'Find fast',
          title: isId
            ? 'Satu kolom untuk cari kebutuhan usaha.'
            : 'One field to find what your business needs.',
          helper: isId
            ? 'Ketik singkat, lalu pilih jalur yang paling dekat.'
            : 'Type a short need, then jump into the closest lane.',
          placeholder: isId
            ? 'Contoh: supplier kopi, jasa desain, booth bazar'
            : 'Search suppliers, locations, or services',
          submitLabel: isId ? 'Cari' : 'Search',
          launcherLabel: isId
            ? 'Jalur paling sering dipakai'
            : 'Most-used lanes',
        }
      : {
          badge: isId ? 'Jual cepat' : 'Sell fast',
          title: isId
            ? 'Tulis singkat, kami arahkan ke form yang pas.'
            : 'Write briefly and we will route you to the right form.',
          helper: isId
            ? 'Tidak perlu isi panjang di awal. Mulai dari jenis posting yang paling dekat.'
            : 'You do not need a long setup upfront. Start from the closest post type.',
          placeholder: isId
            ? 'Contoh: frozen food, jasa laundry, sewa booth'
            : 'Type a product, service, or location',
          submitLabel: isId ? 'Buat draft' : 'Create draft',
          launcherLabel: isId ? 'Mulai dari sini' : 'Start here',
        };

  const heroLauncherItems: HomeLauncherItem[] =
    heroIntent === 'need'
      ? isId
        ? [
            {
              id: 'supplier',
              label: 'Supplier',
              href: '/search?type=product&side=supply&q=supplier',
              icon: Package,
              iconClass:
                'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
            },
            {
              id: 'distributor',
              label: 'Distributor',
              href: '/search?type=product&side=supply&q=distributor',
              icon: Building2,
              iconClass:
                'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900',
            },
            {
              id: 'service',
              label: 'Jasa',
              href: '/search?type=service&side=supply',
              icon: Wrench,
              iconClass:
                'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900',
            },
            {
              id: 'freelancer',
              label: 'Talent',
              href: '/search?type=freelancer&side=supply',
              icon: UserRound,
              iconClass:
                'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
            },
            {
              id: 'property',
              label: 'Lokasi',
              href: '/search?type=property&side=supply&q=lokasi%20jualan',
              icon: MapPin,
              iconClass:
                'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
            },
            {
              id: 'tool-rental',
              label: 'Sewa',
              href: '/search?type=tool_rental&side=supply',
              icon: Truck,
              iconClass:
                'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
            },
            {
              id: 'umkm',
              label: 'Usaha',
              href: UMKM_DISCOVERY_PATH,
              icon: Store,
              iconClass:
                'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
            },
            {
              id: 'all',
              label: 'Semua',
              href: '/search',
              icon: LayoutGrid,
              iconClass:
                'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
            },
          ]
        : [
            {
              id: 'supplier',
              label: 'Suppliers',
              href: '/search?type=product&side=supply&q=supplier',
              icon: Package,
              iconClass:
                'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
            },
            {
              id: 'distributor',
              label: 'Distributors',
              href: '/search?type=product&side=supply&q=distributor',
              icon: Building2,
              iconClass:
                'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900',
            },
            {
              id: 'service',
              label: 'Services',
              href: '/search?type=service&side=supply',
              icon: Wrench,
              iconClass:
                'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900',
            },
            {
              id: 'freelancer',
              label: 'Talent',
              href: '/search?type=freelancer&side=supply',
              icon: UserRound,
              iconClass:
                'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
            },
            {
              id: 'property',
              label: 'Locations',
              href: '/search?type=property&side=supply&q=lokasi%20jualan',
              icon: MapPin,
              iconClass:
                'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
            },
            {
              id: 'tool-rental',
              label: 'Rentals',
              href: '/search?type=tool_rental&side=supply',
              icon: Truck,
              iconClass:
                'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
            },
            {
              id: 'umkm',
              label: 'Business',
              href: UMKM_DISCOVERY_PATH,
              icon: Store,
              iconClass:
                'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
            },
            {
              id: 'all',
              label: 'All',
              href: '/search',
              icon: LayoutGrid,
              iconClass:
                'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
            },
          ]
      : isId
        ? [
            {
              id: 'sell-product',
              label: 'Produk',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'product',
              }),
              icon: Package,
              iconClass:
                'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
            },
            {
              id: 'sell-service',
              label: 'Jasa',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'service',
              }),
              icon: Wrench,
              iconClass:
                'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900',
            },
            {
              id: 'sell-property',
              label: 'Lokasi',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'property',
              }),
              icon: MapPin,
              iconClass:
                'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
            },
            {
              id: 'sell-rental',
              label: 'Sewa',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'tool_rental',
              }),
              icon: Truck,
              iconClass:
                'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
            },
            {
              id: 'sell-job',
              label: 'Lowongan',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'demand',
                type: 'job',
              }),
              icon: BriefcaseBusiness,
              iconClass:
                'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900',
            },
            {
              id: 'sell-talent',
              label: 'Freelancer',
              href: '/profile/edit?focus=talent',
              icon: UserRound,
              iconClass:
                'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
            },
            {
              id: 'open-business',
              label: 'Tambah usaha',
              href: UMKM_OWNER_ONBOARDING_PATH,
              icon: Building2,
              iconClass:
                'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
            },
            {
              id: 'manage-business',
              label: 'Semua usaha',
              href: UMKM_OWNER_PATH,
              icon: Store,
              iconClass:
                'bg-lime-50 text-lime-700 ring-1 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-900',
            },
          ]
        : [
            {
              id: 'sell-product',
              label: 'Products',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'product',
              }),
              icon: Package,
              iconClass:
                'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
            },
            {
              id: 'sell-service',
              label: 'Services',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'service',
              }),
              icon: Wrench,
              iconClass:
                'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900',
            },
            {
              id: 'sell-property',
              label: 'Spaces',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'property',
              }),
              icon: MapPin,
              iconClass:
                'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-900',
            },
            {
              id: 'sell-rental',
              label: 'Rentals',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'supply',
                type: 'tool_rental',
              }),
              icon: Truck,
              iconClass:
                'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900',
            },
            {
              id: 'sell-job',
              label: 'Jobs',
              href: buildCreatePath({
                locale: resolvedLocale,
                side: 'demand',
                type: 'job',
              }),
              icon: BriefcaseBusiness,
              iconClass:
                'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900',
            },
            {
              id: 'sell-talent',
              label: 'Talent',
              href: '/profile/edit?focus=talent',
              icon: UserRound,
              iconClass:
                'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
            },
            {
              id: 'open-business',
              label: 'Add business',
              href: UMKM_OWNER_ONBOARDING_PATH,
              icon: Building2,
              iconClass:
                'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
            },
            {
              id: 'manage-business',
              label: 'All businesses',
              href: UMKM_OWNER_PATH,
              icon: Store,
              iconClass:
                'bg-lime-50 text-lime-700 ring-1 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-900',
            },
          ];

  const resolveOfferHref = (value: string) => {
    const text = value.trim().toLowerCase();
    if (/(booth|lokasi|ruko|kios|space|lapak|property)/.test(text)) {
      return buildCreatePath({
        locale: resolvedLocale,
        side: 'supply',
        type: 'property',
      });
    }
    if (
      /(jasa|service|desain|design|laundry|printing|kemasan|admin|konsultan)/.test(
        text,
      )
    ) {
      return buildCreatePath({
        locale: resolvedLocale,
        side: 'supply',
        type: 'service',
      });
    }
    return buildCreatePath({
      locale: resolvedLocale,
      side: 'supply',
      type: 'product',
    });
  };

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = query.trim();
    if (heroIntent === 'offer') {
      if (!clean) {
        router.push('/create?mode=quick');
        return;
      }
      router.push(resolveOfferHref(clean));
      return;
    }
    router.push(clean ? `/search?q=${encodeURIComponent(clean)}` : '/search');
  };

  useEffect(() => {
    const syncActiveMenuCart = () => {
      setActiveMenuCart(readUmkmCartSession());
    };

    syncActiveMenuCart();
    return subscribeUmkmCartSession(syncActiveMenuCart);
  }, []);

  const menuOrderHref =
    activeMenuCart?.storeSlug && activeMenuCart.itemCount > 0
      ? `${buildUmkmStorefrontPath(activeMenuCart.storeSlug)}?mode=${activeMenuCart.mode}&tab=menu&checkout=1`
      : UMKM_DISCOVERY_PATH;

  return (
    <main className="page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-3">
      <div className="flex w-full flex-col gap-3 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3.5">
        <HomeSectionShell hero>
          <div className="overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[28px] sm:p-3.5">
            <div className="px-1">
              <div className="inline-flex min-h-[28px] items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_26%,white)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_20%,rgba(15,23,42,0.98))] dark:text-[color:var(--app-accent)]">
                {heroConfig.badge}
              </div>
              <h1 className="mt-3 max-w-2xl text-[1.35rem] font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.65rem]">
                {heroConfig.title}
              </h1>
              <p className="mt-2 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400 sm:text-[13px]">
                {heroConfig.helper}
              </p>
            </div>

            <form
              onSubmit={onSearch}
              className="mt-4 flex flex-col gap-2"
              role="search"
              aria-label="Home search"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/80 transition focus-within:bg-white dark:bg-slate-900/80 dark:ring-slate-800/80 dark:focus-within:bg-slate-900">
                  <Search className="h-4 w-4 text-[color:var(--app-accent)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={heroConfig.placeholder}
                    className="min-h-[28px] w-full min-w-0 appearance-none border-0 bg-transparent text-[11px] font-medium text-slate-800 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[32px] sm:text-[13px] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <button
                  type="submit"
                  className="ui-pressable inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[11px] font-semibold text-white shadow-[0_16px_28px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)] transition hover:brightness-105"
                >
                  {heroConfig.submitLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="inline-flex w-full max-w-[260px] rounded-full bg-slate-100 p-1 sm:max-w-[280px] dark:bg-slate-900">
                {heroTabs.map(tab => {
                  const active = heroIntent === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setHeroIntent(tab.value)}
                      className={cn(
                        'ui-pressable inline-flex min-h-[34px] flex-1 items-center justify-center rounded-full px-3 text-[11px] font-semibold transition sm:min-h-[36px] sm:text-[12px]',
                        active
                          ? 'bg-white text-[color:var(--app-accent-strong)] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.18)] dark:bg-slate-950 dark:text-[color:var(--app-accent)]'
                          : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-950 dark:hover:text-slate-100',
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </HomeSectionShell>

        
        <HomeSectionShell>
          <div className="pt-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
              {heroConfig.launcherLabel}
            </p>
            <HomeLauncherGrid items={heroLauncherItems} />
          </div>
        </HomeSectionShell>

        <HomeSectionBoundary
          resetKey={`discovery-${resolvedLocale}`}
          fallback={
            <HomeSectionFallback
              title={
                isId
                  ? 'Rekomendasi belum tampil'
                  : 'Recommendations unavailable'
              }
              body={
                isId
                  ? 'Tetap bisa lanjut cari sekarang.'
                  : 'You can still continue searching now.'
              }
              href="/search"
              action={isId ? 'Buka pencarian' : 'Open search'}
            />
          }
        >
          <HomeDiscoveryFeed locale={resolvedLocale} compact />
        </HomeSectionBoundary>

        <HomeSectionShell>
          <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0f172a,#1e293b)] p-3 text-white shadow-[0_22px_40px_-30px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:p-3.5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="inline-flex min-h-[28px] items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {activeMenuCart?.itemCount
                    ? isId
                      ? 'Pesanan aktif'
                      : 'Active order'
                    : isId
                      ? 'Pesan menu'
                      : 'Menu order'}
                </div>
                <h2 className="mt-3 text-[1.15rem] font-black leading-tight tracking-[-0.04em] sm:text-[1.35rem]">
                  {activeMenuCart?.itemCount
                    ? isId
                      ? `Lanjutkan pesanan di ${activeMenuCart.storeName || 'usaha aktif'}`
                      : `Continue your order at ${activeMenuCart.storeName || 'the active business'}`
                    : isId
                      ? 'Pilih satu usaha, tambah menu, lalu langsung checkout.'
                      : 'Pick one business, add a menu, then check out fast.'}
                </h2>
                <p className="mt-2 text-[12px] leading-5 text-slate-200 sm:text-[13px]">
                  {activeMenuCart?.itemCount
                    ? isId
                      ? `${activeMenuCart.itemCount} item sudah siap dilanjutkan. Kalau pindah usaha, keranjang lama akan direset setelah konfirmasi.`
                      : `${activeMenuCart.itemCount} items are ready to continue. Switching businesses will reset the old cart after confirmation.`
                    : isId
                      ? 'Flow dibuat satu keranjang untuk satu usaha supaya lebih cepat dan tidak bikin bingung.'
                      : 'The flow keeps one cart per business so ordering stays fast and clear.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:min-w-[220px]">
                <Link
                  href={menuOrderHref}
                  className="ui-pressable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-4 text-[12px] font-semibold text-slate-900 shadow-[0_18px_30px_-22px_rgba(255,255,255,0.28)] transition hover:brightness-105"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {activeMenuCart?.itemCount
                    ? isId
                      ? 'Lanjutkan pesanan'
                      : 'Continue order'
                    : isId
                      ? 'Cari usaha'
                      : 'Find a business'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <p className="text-[11px] leading-5 text-slate-300 sm:text-right">
                  {isId
                    ? 'Satu keranjang hanya untuk satu usaha.'
                    : 'One cart only works for one business.'}
                </p>
              </div>
            </div>
          </div>
        </HomeSectionShell>

      </div>
    </main>
  );
}
