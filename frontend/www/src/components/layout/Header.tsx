'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  ClipboardList,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search as SearchIcon,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  LocalizedAnchor as Link,
  localizeHref,
} from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcherButton } from '@/components/modal/LanguageModal/LanguageSwitcherButton';
import { useChatInbox } from '@/context/ChatInboxContext';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { HeaderInboxDropdown } from '@/components/layout/HeaderInboxDropdown';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { resolveLocaleFromPathname } from '@/lib/locale';
import {
  UMKM_DISCOVERY_PATH,
  LEGACY_UMKM_OWNER_PATH,
  buildUsahaPath,
  getUmkmSurfaceCopy,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

function matchesRoute(pathname: string, matcher: string) {
  if (matcher === '/') return pathname === '/';
  return pathname === matcher || pathname.startsWith(`${matcher}/`);
}

function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] || '/';
}

type DrawerItem = {
  href: string;
  label: string;
  caption?: string;
  icon: LucideIcon;
  matchers?: string[];
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const { totalUnread } = useChatInbox();
  const activeSearchQuery = searchParams.get('q') || '';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [globalSearchDraft, setGlobalSearchDraft] = useState({
    source: activeSearchQuery,
    value: activeSearchQuery,
  });
  const [menuSearch, setMenuSearch] = useState('');

  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const locale = resolveLocaleFromPathname(pathname);
  const localeKey = locale === 'id' ? 'id' : 'en';
  const globalSearch =
    globalSearchDraft.source === activeSearchQuery
      ? globalSearchDraft.value
      : activeSearchQuery;
  const cleanPath = normalizePathname(pathname);
  const createHref = isAuthenticated ? '/create' : '/register';
  const manageHref = buildUsahaPath('home');
  const accountHref = isAuthenticated ? '/profile' : '/login';
  const chatHref = isAuthenticated ? '/chat' : '/login';
  const surfaceCopy = getUmkmSurfaceCopy(locale);

  const text = {
    brand: locale === 'id' ? 'Lajukan UMKM' : 'Lajukan',
    brandHint:
      locale === 'id'
        ? 'Supplier, jasa, peluang'
        : 'Suppliers, services, deals',
    search: locale === 'id' ? 'Cari' : 'Search',
    searchPlaceholder:
      locale === 'id'
        ? 'Cari supplier, jasa, lokasi...'
        : 'Search suppliers, services, places...',
    menu: locale === 'id' ? 'Menu' : 'Menu',
    manage: surfaceCopy.owner,
    create: locale === 'id' ? 'Posting' : 'Post',
    createLong:
      locale === 'id'
        ? 'Posting kebutuhan/tawaran'
        : 'Post a new need or offer',
    chat: locale === 'id' ? 'Chat' : 'Chat',
    account: locale === 'id' ? 'Akun' : 'Account',
    login: locale === 'id' ? 'Masuk' : 'Login',
    register: locale === 'id' ? 'Daftar' : 'Register',
    logout: locale === 'id' ? 'Keluar' : 'Logout',
    support: locale === 'id' ? 'Bantuan' : 'Get help',
    searchMenu: locale === 'id' ? 'Cari Menu' : 'Search Menu',
    social: locale === 'id' ? 'Sosial' : 'Social',
    business: locale === 'id' ? 'Belanja & Usaha' : 'Shopping and Business',
    professional: locale === 'id' ? 'Profesional' : 'Professional',
    createSection: locale === 'id' ? 'Buat' : 'Create',
  } as const;

  const coreDrawerItems = useMemo(
    () => buildPrimaryNavItems(isAuthenticated, localeKey),
    [isAuthenticated, localeKey],
  );
  const coreDrawerLinks = useMemo(
    () => coreDrawerItems.filter(item => item.key !== 'account'),
    [coreDrawerItems],
  );
  const desktopPrimaryLinks = useMemo(
    () => coreDrawerLinks.filter(item => item.key !== 'create'),
    [coreDrawerLinks],
  );
  const coreDrawerActiveKey = resolveActivePrimaryNavKey(
    coreDrawerItems,
    pathname,
  );

  const accountDrawerItems = useMemo<DrawerItem[]>(() => {
    const drawerSurfaceCopy = getUmkmSurfaceCopy(localeKey);

    return isAuthenticated
      ? [
          {
            href: accountHref,
            label: localeKey === 'id' ? 'Akun' : 'Account',
            caption:
              localeKey === 'id'
                ? 'Identitas, rating, aktivitas'
                : 'Identity, rating, activity',
            icon: UserRound,
            matchers: ['/profile'],
          },
          {
            href: '/my-listings',
            label: localeKey === 'id' ? 'Postingan' : 'Posts',
            caption:
              localeKey === 'id'
                ? 'Listing aktif dan draft'
                : 'Active listings and drafts',
            icon: ShoppingBag,
            matchers: ['/my-listings'],
          },
          {
            href: '/my-listings?filter=favorites',
            label: localeKey === 'id' ? 'Favorit' : 'Favorites',
            caption:
              localeKey === 'id' ? 'Simpan referensi' : 'Saved references',
            icon: Heart,
            matchers: ['/my-listings'],
          },
          {
            href: '/payments',
            label: localeKey === 'id' ? 'Saldo' : 'Balance',
            caption:
              localeKey === 'id'
                ? 'Top up dan pembayaran'
                : 'Top up and payments',
            icon: Wallet,
            matchers: ['/payments'],
          },
          {
            href: manageHref,
            label: drawerSurfaceCopy.owner,
            caption:
              localeKey === 'id'
                ? 'Toko, katalog, order'
                : 'Store, catalog, orders',
            icon: MapPinned,
            matchers: ['/usaha', LEGACY_UMKM_OWNER_PATH],
          },
          {
            href: '/transactions',
            label: localeKey === 'id' ? 'Transaksi' : 'Transactions',
            caption:
              localeKey === 'id'
                ? 'Deal, escrow, riwayat'
                : 'Deals, escrow, history',
            icon: Store,
            matchers: ['/transactions'],
          },
          {
            href: '/settings',
            label: localeKey === 'id' ? 'Pengaturan' : 'Settings',
            caption:
              localeKey === 'id'
                ? 'Bahasa, keamanan, akun'
                : 'Language, security, account',
            icon: Settings,
            matchers: ['/settings'],
          },
        ]
      : [
          {
            href: '/login',
            label: localeKey === 'id' ? 'Masuk' : 'Login',
            caption:
              localeKey === 'id'
                ? 'Akses chat dan transaksi'
                : 'Access chats and transactions',
            icon: UserRound,
            matchers: ['/login'],
          },
          {
            href: '/register',
            label: localeKey === 'id' ? 'Daftar' : 'Register',
            caption:
              localeKey === 'id'
                ? 'Buat akun Lajukan'
                : 'Create a Lajukan account',
            icon: Plus,
            matchers: ['/register'],
          },
          {
            href: '/support',
            label: localeKey === 'id' ? 'Bantuan' : 'Get help',
            caption: localeKey === 'id' ? 'Pusat bantuan' : 'Help center',
            icon: CircleHelp,
            matchers: ['/support'],
          },
        ];
  }, [accountHref, isAuthenticated, localeKey, manageHref]);

  const menuGroups = useMemo<
    Array<{ id: string; title: string; items: DrawerItem[] }>
  >(() => {
    const guarded = (href: string) => (isAuthenticated ? href : '/login');
    const drawerSurfaceCopy = getUmkmSurfaceCopy(localeKey);

    return [
      {
        id: 'social',
        title: localeKey === 'id' ? 'Sosial' : 'Social',
        items: [
          {
            href: '/home',
            label: localeKey === 'id' ? 'Beranda' : 'Home',
            caption: localeKey === 'id' ? 'Feed utama' : 'Main feed',
            icon: Home,
            matchers: ['/home', '/'],
          },
          {
            href: '/community',
            label: localeKey === 'id' ? 'Komunitas' : 'Community',
            caption:
              localeKey === 'id'
                ? 'Grup, diskusi, posting'
                : 'Groups, posts, discussions',
            icon: Users,
            matchers: ['/community'],
          },
          {
            href: '/reels',
            label: 'Reels',
            caption:
              localeKey === 'id'
                ? 'Video usaha singkat'
                : 'Short business videos',
            icon: Clapperboard,
            matchers: ['/reels'],
          },
          {
            href: chatHref,
            label: localeKey === 'id' ? 'Chat' : 'Chat',
            caption:
              localeKey === 'id'
                ? 'Pesan dan negosiasi'
                : 'Messages and negotiation',
            icon: MessageCircle,
            matchers: ['/chat'],
          },
          {
            href: guarded('/notifications'),
            label: localeKey === 'id' ? 'Notifikasi' : 'Notifications',
            caption:
              localeKey === 'id' ? 'Update penting' : 'Important updates',
            icon: Bell,
            matchers: ['/notifications'],
          },
        ],
      },
      {
        id: 'business',
        title: localeKey === 'id' ? 'Belanja & Usaha' : 'Shopping and Business',
        items: [
          {
            href: '/search',
            label: localeKey === 'id' ? 'Cari' : 'Search',
            caption:
              localeKey === 'id'
                ? 'Supplier, jasa, lokasi'
                : 'Suppliers, services, places',
            icon: SearchIcon,
            matchers: ['/search'],
          },
          {
            href: '/kategori',
            label: localeKey === 'id' ? 'Kategori' : 'Categories',
            caption:
              localeKey === 'id'
                ? 'Jalur cepat cari kebutuhan'
                : 'Quick lanes for needs',
            icon: LayoutGrid,
            matchers: ['/kategori'],
          },
          {
            href: '/search?type=product',
            label: 'Supplier',
            caption:
              localeKey === 'id'
                ? 'Produk dan bahan usaha'
                : 'Products and supplies',
            icon: ShoppingBag,
            matchers: ['/search', '/marketplace'],
          },
          {
            href: '/search?type=service',
            label: localeKey === 'id' ? 'Jasa' : 'Services',
            caption:
              localeKey === 'id'
                ? 'Operasional dan partner'
                : 'Operations and partners',
            icon: Wrench,
            matchers: ['/search'],
          },
          {
            href: UMKM_DISCOVERY_PATH,
            label: drawerSurfaceCopy.discovery,
            caption:
              localeKey === 'id'
                ? 'Usaha lokal sekitar'
                : 'Nearby local businesses',
            icon: MapPinned,
            matchers: [UMKM_DISCOVERY_PATH, '/super-app/umkm'],
          },
          {
            href: '/marketplace',
            label: 'Marketplace',
            caption:
              localeKey === 'id'
                ? 'Produk siap pilih'
                : 'Ready-to-browse products',
            icon: Store,
            matchers: ['/marketplace'],
          },
        ],
      },
      {
        id: 'professional',
        title: localeKey === 'id' ? 'Profesional' : 'Professional',
        items: [
          {
            href: '/jobs',
            label: localeKey === 'id' ? 'Loker' : 'Jobs',
            caption:
              localeKey === 'id'
                ? 'Cari kerja dan kandidat'
                : 'Jobs and candidates',
            icon: BriefcaseBusiness,
            matchers: ['/jobs'],
          },
          {
            href: '/freelancers',
            label: 'Talent',
            caption:
              localeKey === 'id'
                ? 'Freelancer dan skill'
                : 'Freelancers and skills',
            icon: UserRound,
            matchers: ['/freelancers'],
          },
          {
            href: '/property',
            label: localeKey === 'id' ? 'Lokasi' : 'Property',
            caption:
              localeKey === 'id'
                ? 'Ruko, tempat, booth'
                : 'Shops, places, booths',
            icon: Building2,
            matchers: ['/property'],
          },
          {
            href: guarded('/my-projects'),
            label: localeKey === 'id' ? 'Proyek Saya' : 'My Projects',
            caption:
              localeKey === 'id' ? 'Brief dan penawaran' : 'Briefs and offers',
            icon: ClipboardList,
            matchers: ['/my-projects', '/projects'],
          },
        ],
      },
    ];
  }, [chatHref, isAuthenticated, localeKey]);

  const createDrawerItems = useMemo<DrawerItem[]>(() => {
    const createNeedHref = isAuthenticated
      ? localeKey === 'id'
        ? '/create/butuh'
        : '/create/need'
      : '/register';
    const createSellHref = isAuthenticated
      ? localeKey === 'id'
        ? '/create/jual'
        : '/create/sell'
      : '/register';
    const createProductHref = isAuthenticated
      ? localeKey === 'id'
        ? '/create/jual/produk'
        : '/create/sell/products'
      : '/register';
    const createServiceHref = isAuthenticated
      ? localeKey === 'id'
        ? '/create/jual/jasa'
        : '/create/sell/services'
      : '/register';

    return [
      {
        href: createHref,
        label: localeKey === 'id' ? 'Posting' : 'Post',
        caption:
          localeKey === 'id' ? 'Mulai dari template' : 'Start from template',
        icon: Plus,
        matchers: ['/create'],
      },
      {
        href: createNeedHref,
        label: localeKey === 'id' ? 'Permintaan' : 'Request',
        caption:
          localeKey === 'id'
            ? 'Butuh barang, jasa, talent'
            : 'Need goods, services, talent',
        icon: ClipboardList,
        matchers: ['/create/butuh', '/create/need'],
      },
      {
        href: createSellHref,
        label: localeKey === 'id' ? 'Penawaran' : 'Offer',
        caption:
          localeKey === 'id'
            ? 'Jual produk atau jasa'
            : 'Sell products or services',
        icon: ShoppingBag,
        matchers: ['/create/jual', '/create/sell'],
      },
      {
        href: createProductHref,
        label: localeKey === 'id' ? 'Produk' : 'Product',
        caption:
          localeKey === 'id'
            ? 'Upload listing produk'
            : 'Upload a product listing',
        icon: Package,
        matchers: ['/create/jual/produk', '/create/sell/products'],
      },
      {
        href: createServiceHref,
        label: localeKey === 'id' ? 'Jasa' : 'Service',
        caption: localeKey === 'id' ? 'Tawarkan layanan' : 'Offer a service',
        icon: Wrench,
        matchers: ['/create/jual/jasa', '/create/sell/services'],
      },
      {
        href: '/community?compose=reel',
        label: 'Reels',
        caption:
          localeKey === 'id' ? 'Upload video usaha' : 'Upload business video',
        icon: Clapperboard,
        matchers: ['/community'],
      },
    ];
  }, [createHref, isAuthenticated, localeKey]);

  const menuSearchNeedle = menuSearch.trim().toLowerCase();
  const visibleMenuGroups = useMemo(() => {
    if (!menuSearchNeedle) return menuGroups;

    return menuGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          `${item.label} ${item.caption || ''}`
            .toLowerCase()
            .includes(menuSearchNeedle),
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [menuGroups, menuSearchNeedle]);

  const visibleCreateDrawerItems = useMemo(() => {
    if (!menuSearchNeedle) return createDrawerItems;
    return createDrawerItems.filter(item =>
      `${item.label} ${item.caption || ''}`
        .toLowerCase()
        .includes(menuSearchNeedle),
    );
  }, [createDrawerItems, menuSearchNeedle]);

  const closeAll = useCallback(() => {
    setProfileOpen(false);
    setMobileOpen(false);
    setMenuSearch('');
  }, []);

  const setGlobalSearch = (value: string) => {
    setGlobalSearchDraft({
      source: activeSearchQuery,
      value,
    });
  };

  const handleGlobalSearchSubmit = (submittedQuery: string) => {
    const query = submittedQuery.trim();
    const nextHref = query
      ? `/search?q=${encodeURIComponent(query)}`
      : '/search';

    closeAll();
    router.push(localizeHref(nextHref, locale));
  };

  useEffect(() => {
    if (!profileOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen && !mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileOpen(false);
      setMobileOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, profileOpen]);

  useEffect(() => {
    if (!mobileOpen || typeof document === 'undefined') return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [mobileOpen]);

  const toggleMobileMenu = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const renderDrawerGroup = (
    title: string,
    items: DrawerItem[],
    options?: { compact?: boolean },
  ) => (
    <section className="rounded-[18px] border border-[color:var(--app-border)]/75 bg-[color:var(--app-surface-muted)] p-2.5 dark:border-[color:var(--app-border-strong)]">
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
        {title}
      </p>
      <div
        className={cn(
          'mt-2 grid gap-2',
          options?.compact
            ? 'grid-cols-2 lg:grid-cols-1'
            : 'grid-cols-2 lg:grid-cols-3',
        )}
      >
        {items.map(item => {
          const Icon = item.icon;
          const active = (
            item.matchers?.length ? item.matchers : [hrefPath(item.href)]
          ).some(matcher => matchesRoute(cleanPath, matcher));

          return (
            <Link
              key={`${title}-${item.href}-${item.label}`}
              href={item.href}
              onClick={closeAll}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'ui-pressable ui-pressable-card flex min-h-[48px] items-center gap-2 rounded-[14px] border bg-[color:var(--app-surface-strong)] px-2.5 py-2 transition',
                active
                  ? 'border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  active
                    ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black leading-4">
                  {item.label}
                </span>
                {item.caption ? (
                  <span className="mt-0.5 hidden truncate text-[11px] font-medium leading-4 text-[color:var(--app-text-soft)] xl:block">
                    {item.caption}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="hidden h-4 w-4 shrink-0 opacity-60 xl:block" />
            </Link>
          );
        })}
      </div>
    </section>
  );

  const mobileDrawerLayer =
    typeof document !== 'undefined' && mobileOpen
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close mobile menu overlay"
              onClick={() => setMobileOpen(false)}
              className="ui-layer-popover fixed inset-0 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_45%,_transparent)] backdrop-blur-sm"
            />
            <aside className="ui-layer-drawer fixed right-0 top-0 flex h-[100svh] max-h-[100svh] w-[min(94vw,390px)] flex-col bg-[color:var(--app-surface-strong)] shadow-2xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] lg:right-4 lg:top-[calc(62px+env(safe-area-inset-top))] lg:h-[min(82svh,720px)] lg:w-[min(760px,calc(100vw-2rem))] lg:rounded-[22px] lg:border">
              <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] px-3 py-2.5 dark:border-[color:var(--app-border-strong)] sm:px-4">
                <div>
                  <p className="text-sm font-black text-[color:var(--app-text)]">
                    {text.menu}
                  </p>
                  <p className="mt-0.5 hidden text-xs text-[color:var(--app-text-soft)] sm:block">
                    {locale === 'id'
                      ? 'Semua pintasan Lajukan'
                      : 'All Lajukan shortcuts'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="ui-pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form
                onSubmit={event => event.preventDefault()}
                className="px-3 pt-2.5 sm:px-4"
              >
                <label className="ui-navbar-search-field">
                  <SearchIcon className="ui-navbar-search-icon" />
                  <input
                    data-testid="app-menu-search-input"
                    type="search"
                    value={menuSearch}
                    onChange={event => setMenuSearch(event.target.value)}
                    placeholder={text.searchMenu}
                    className="ui-navbar-search-input"
                  />
                </label>
              </form>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
                {!isAuthenticated ? (
                  <div className="ui-panel-muted rounded-[18px] border border-[color:var(--app-border)]/80 p-2.5">
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">
                      {text.account}
                    </p>
                    <p className="mt-1 hidden text-xs text-[color:var(--app-text-soft)] sm:block">
                      {locale === 'id'
                        ? 'Masuk biar chat, draft, transaksi nyambung.'
                        : 'Sign in so your chats, drafts, and transactions stay in sync.'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link
                        href="/login"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold text-[color:var(--app-text)]"
                      >
                        {text.login}
                      </Link>
                      <Link
                        href="/register"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-10 items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                      >
                        {text.register}
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    {visibleMenuGroups.map(group => (
                      <div key={group.id}>
                        {renderDrawerGroup(group.title, group.items)}
                      </div>
                    ))}
                    {visibleMenuGroups.length === 0 &&
                    visibleCreateDrawerItems.length === 0 ? (
                      <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-center text-sm font-semibold text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Menu tidak ditemukan.'
                          : 'No menu found.'}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                    {visibleCreateDrawerItems.length > 0
                      ? renderDrawerGroup(
                          text.createSection,
                          visibleCreateDrawerItems,
                          { compact: true },
                        )
                      : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] p-2.5 dark:border-[color:var(--app-border-strong)] sm:p-3">
                {isAuthenticated ? (
                  <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5 dark:border-[color:var(--app-border-strong)]">
                    <div className="flex min-w-0 items-center gap-2">
                      <Image
                        src={user?.avatarUrl || '/default-avatar.svg'}
                        alt="Profile avatar"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[color:var(--app-text)]">
                          {user?.username || user?.fullName || 'User'}
                        </p>
                        <p className="truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                          {user?.email ||
                            (locale === 'id' ? 'Akun aktif' : 'Active account')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link
                        href="/profile"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-text)]"
                      >
                        <UserRound className="h-4 w-4" />
                        {locale === 'id' ? 'Profil' : 'Profile'}
                      </Link>
                      <Link
                        href="/settings"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-text)]"
                      >
                        <Settings className="h-4 w-4" />
                        {locale === 'id' ? 'Pengaturan' : 'Settings'}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeAll();
                        void logout();
                      }}
                      className="ui-pressable mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_58%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_8%,_transparent)] px-3 text-sm font-black text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
                    >
                      <LogOut className="h-4 w-4" />
                      {text.logout}
                    </button>
                  </div>
                ) : null}
                <Link
                  href="/support"
                  onClick={closeAll}
                  className="ui-pressable inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold text-[color:var(--app-text)]"
                >
                  <CircleHelp className="h-4 w-4" />
                  {text.support}
                </Link>
              </div>

              <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <header
        className="ui-layer-header fixed inset-x-0 top-0 border-x-0 border-b border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)] backdrop-blur-xl dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)]"
        data-tour="www-header"
      >
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <div className="lajukan-header-shell page-shell page-shell-inset flex h-12 items-center gap-2 sm:h-14">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[470px]">
            <Link
              href="/home"
              className="ui-pressable inline-flex shrink-0 items-center"
              onClick={closeAll}
              aria-label={text.brand}
            >
              <span className="inline-flex max-w-[40px] select-none 2xl:max-w-[128px]">
                <LajuloLogo textClassName="hidden 2xl:inline" />
              </span>
            </Link>

            <div className="hidden min-w-[220px] flex-1 lg:block">
              <SearchInput
                value={globalSearch}
                onValueChange={setGlobalSearch}
                onSearch={handleGlobalSearchSubmit}
                placeholder={text.searchPlaceholder}
                ariaLabel={text.search}
                inputAriaLabel={text.search}
                variant="navbar"
                layout="row"
                compact
                showSubmitButton={false}
                testId="app-header-search-form"
                inputTestId="app-header-search-input"
              />
            </div>
          </div>

          <nav
            className="hidden min-w-0 flex-[1.15] items-center justify-center gap-1 lg:flex"
            aria-label={locale === 'id' ? 'Navigasi utama' : 'Main navigation'}
          >
            {desktopPrimaryLinks.map(item => {
              const Icon = item.icon;
              const active = coreDrawerActiveKey === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={closeAll}
                  className={cn(
                    'ui-pressable inline-flex !min-h-[42px] items-center justify-center gap-2 rounded-[16px] px-2 text-sm font-semibold transition xl:px-3',
                    active
                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full transition',
                      active
                        ? 'bg-white text-[color:var(--app-accent)]'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden min-w-0 flex-1 shrink-0 items-center justify-end gap-1.5 lg:flex xl:gap-2">
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileOpen}
              aria-label={text.menu}
              className={cn(
                'ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border transition',
                mobileOpen
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]',
              )}
              title={text.menu}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>

            {isAuthenticated ? (
              <>
                <HeaderInboxDropdown
                  kind="chat"
                  isId={locale === 'id'}
                  active={matchesRoute(cleanPath, '/chat')}
                />

                <HeaderInboxDropdown
                  kind="notifications"
                  isId={locale === 'id'}
                  active={matchesRoute(cleanPath, '/notifications')}
                />
              </>
            ) : null}

            <Link
              href={createHref}
              className="ui-pressable inline-flex !min-h-[44px] items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-2.5 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[var(--app-shadow)] xl:px-4"
              onClick={closeAll}
              aria-label={text.createLong}
              title={text.createLong}
              data-tour="www-create"
              data-testid="app-header-create-link"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,_var(--app-text-inverse)_14%,_transparent)]">
                <Plus className="h-4 w-4" />
              </span>
              <span className="hidden xl:inline">{text.create}</span>
            </Link>

            {isAuthenticated ? (
              <div
                className="ui-layer-local-topbar relative"
                ref={profileMenuRef}
              >
                <button
                  type="button"
                  onClick={() => setProfileOpen(prev => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className={cn(
                    'ui-pressable inline-flex h-10 items-center gap-0 rounded-full border px-1.5 transition xl:gap-2 xl:px-2 xl:pr-3',
                    matchesRoute(cleanPath, '/profile') ||
                      matchesRoute(cleanPath, '/settings') ||
                      matchesRoute(cleanPath, '/transactions') ||
                      matchesRoute(cleanPath, '/payments')
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                  data-tour="www-profile"
                >
                  <Image
                    src={user?.avatarUrl || '/default-avatar.svg'}
                    alt="Profile avatar"
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span className="hidden max-w-[84px] truncate text-sm font-semibold 2xl:inline">
                    {user?.username || user?.fullName || 'User'}
                  </span>
                </button>

                {profileOpen ? (
                  <div
                    role="menu"
                    className="ui-layer-popover absolute right-0 mt-2 w-64 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-lg"
                  >
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                        {user?.username || user?.fullName || 'User'}
                      </p>
                      <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                        {user?.email || '-'}
                      </p>
                    </div>
                    <div className="mt-1">
                      {accountDrawerItems.map(item => {
                        const active =
                          item.matchers?.some(matcher =>
                            matchesRoute(cleanPath, matcher),
                          ) ?? false;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'ui-pressable flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium transition',
                              active
                                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                            )}
                            onClick={() => setProfileOpen(false)}
                            role="menuitem"
                            aria-current={active ? 'page' : undefined}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 px-1 py-1">
                      <LanguageSwitcherButton />
                      <ThemeToggle />
                    </div>
                    <div className="my-1 border-t border-[color:var(--app-border)]" />
                    <button
                      type="button"
                      className="ui-pressable flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm font-medium text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
                      onClick={async () => {
                        await logout();
                        setProfileOpen(false);
                      }}
                    >
                      {text.logout}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LanguageSwitcherButton />
                <ThemeToggle />
                <Link
                  href="/login"
                  className="ui-pressable inline-flex min-h-[42px] items-center rounded-full border border-[color:var(--app-border)] px-4 text-sm font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                  onClick={closeAll}
                  data-tour="www-login"
                >
                  {text.login}
                </Link>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:hidden">
            <Link
              href="/search"
              className={cn(
                'ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border transition',
                matchesRoute(cleanPath, '/search')
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]',
              )}
              onClick={closeAll}
              data-tour="www-search-mobile"
              data-testid="app-header-mobile-search-link"
              aria-label={text.search}
            >
              <SearchIcon className="h-4 w-4" />
            </Link>

            <Link
              href={chatHref}
              onClick={closeAll}
              className={cn(
                'ui-pressable relative inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border transition',
                matchesRoute(cleanPath, '/chat')
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]',
              )}
              aria-label={text.chat}
            >
              <MessageCircle className="h-4 w-4" />
              {totalUnread > 0 ? (
                <span className="absolute right-0 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[9px] font-black text-[color:var(--app-text-inverse)]">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              ) : null}
            </Link>

            <Link
              href={createHref}
              onClick={closeAll}
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] shadow-[var(--app-shadow)]"
              aria-label={text.createLong}
              data-tour="www-create-mobile"
              data-testid="app-header-mobile-create-link"
            >
              <Plus className="h-4.5 w-4.5" />
            </Link>

            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]"
              data-testid="app-header-mobile-menu-button"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>
      {mobileDrawerLayer}
    </>
  );
}
