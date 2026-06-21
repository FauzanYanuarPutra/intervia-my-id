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
  Languages,
  LogIn,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Plus,
  Search as SearchIcon,
  Settings,
  ShoppingBag,
  Store,
  Sun,
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
import { useTheme } from '@/context/ThemeContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcherButton } from '@/components/modal/LanguageModal/LanguageSwitcherButton';
import { useLanguageModal } from '@/components/modal/LanguageModal/LanguageModalContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { HeaderInboxDropdown } from '@/components/layout/HeaderInboxDropdown';
import { SearchInput } from '@/components/ui/SearchInput';
import AISearchBar from '@/components/search/AISearchBar';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import {
  UMKM_DISCOVERY_PATH,
  LEGACY_UMKM_OWNER_PATH,
  buildUsahaPath,
  getUmkmSurfaceCopy,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

function matchesRoute(pathname: string, matcher: string) {
  const exact = matcher.endsWith('$');
  const route = exact ? matcher.slice(0, -1) || '/' : matcher;
  if (route === '/') return pathname === '/';
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
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
  const userAvatarStyle = readProfileAvatarStyle(user);
  const { isDark, isReady, setColorScheme } = useTheme();
  const { open: openLanguageModal, currentLocale } = useLanguageModal();
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
    business: locale === 'id' ? 'Cari & Promosi' : 'Search and Promote',
    professional: locale === 'id' ? 'Profesional' : 'Professional',
    createSection: locale === 'id' ? 'Buat' : 'Create',
    preferences: locale === 'id' ? 'Tampilan' : 'Display',
    language: locale === 'id' ? 'Bahasa' : 'Language',
    dark: locale === 'id' ? 'Gelap' : 'Dark',
    light: locale === 'id' ? 'Terang' : 'Light',
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
          matchers: ['/profile$', '/profile/edit'],
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
        ...(!PROMO_ONLY_MODE
          ? [
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
          ]
          : []),
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
        ...(!PROMO_ONLY_MODE
          ? [
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
          ]
          : []),
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
              ? 'Akses chat dan profil'
              : 'Access chats and profile',
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
                ? PROMO_ONLY_MODE
                  ? 'Tanya jawab langsung'
                  : 'Pesan dan negosiasi'
                : PROMO_ONLY_MODE
                  ? 'Direct questions'
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
        title: text.business,
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
            matchers: ['/search'],
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
            matchers: [UMKM_DISCOVERY_PATH],
          },
          {
            href: '/search?type=product&q=supplier',
            label: 'Marketplace',
            caption:
              localeKey === 'id'
                ? 'Produk siap pilih'
                : 'Ready-to-browse products',
            icon: Store,
            matchers: ['/search'],
          },
        ],
      },
      {
        id: 'professional',
        title: localeKey === 'id' ? 'Profesional' : 'Professional',
        items: [
          {
            href: '/search?type=job&q=lowongan',
            label: localeKey === 'id' ? 'Loker' : 'Jobs',
            caption:
              localeKey === 'id'
                ? 'Cari kerja dan kandidat'
                : 'Jobs and candidates',
            icon: BriefcaseBusiness,
            matchers: ['/search'],
          },
          {
            href: '/search?type=freelancer&q=umkm',
            label: 'Talent',
            caption:
              localeKey === 'id'
                ? 'Freelancer dan skill'
                : 'Freelancers and skills',
            icon: UserRound,
            matchers: ['/search'],
          },
          {
            href: '/search?type=property&q=lokasi%20jualan',
            label: localeKey === 'id' ? 'Lokasi' : 'Property',
            caption:
              localeKey === 'id'
                ? 'Ruko, tempat, booth'
                : 'Shops, places, booths',
            icon: Building2,
            matchers: ['/search'],
          },
          ...(!PROMO_ONLY_MODE
            ? [
              {
                href: guarded('/my-projects'),
                label: localeKey === 'id' ? 'Proyek Saya' : 'My Projects',
                caption:
                  localeKey === 'id'
                    ? 'Brief dan penawaran'
                    : 'Briefs and offers',
                icon: ClipboardList,
                matchers: ['/my-projects'],
              },
            ]
            : []),
        ],
      },
    ];
  }, [chatHref, isAuthenticated, localeKey, text.business]);

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
        label: localeKey === 'id' ? 'Buat Posting' : 'Create Post',
        caption:
          localeKey === 'id' ? 'Tawarkan atau cari' : 'Choose offer or need',
        icon: Plus,
        matchers: ['/create'],
      },
      {
        href: createNeedHref,
        label: localeKey === 'id' ? 'Cari Kebutuhan' : 'Need Something',
        caption:
          localeKey === 'id'
            ? 'Supplier, jasa, talent'
            : 'Need goods, services, talent',
        icon: ClipboardList,
        matchers: ['/create/butuh', '/create/need'],
      },
      {
        href: createSellHref,
        label: localeKey === 'id' ? 'Tawarkan' : 'Want to Sell',
        caption:
          localeKey === 'id'
            ? 'Produk, jasa, lokasi'
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

  const drawerQuickLinks = useMemo<DrawerItem[]>(
    () => [
      {
        href: '/search',
        label: localeKey === 'id' ? 'Cari cepat' : 'Quick search',
        caption:
          localeKey === 'id'
            ? 'Supplier, jasa, lokasi'
            : 'Suppliers, services, places',
        icon: SearchIcon,
        matchers: ['/search'],
      },
      {
        href: chatHref,
        label: localeKey === 'id' ? 'Chat' : 'Chat',
        caption:
          localeKey === 'id' ? 'Tanya user atau admin' : 'Ask users or admin',
        icon: MessageCircle,
        matchers: ['/chat'],
      },
      {
        href: manageHref,
        label: localeKey === 'id' ? 'Kelola Usaha' : 'Manage business',
        caption:
          localeKey === 'id'
            ? 'Profil, katalog, order'
            : 'Profile, catalog, orders',
        icon: Store,
        matchers: ['/usaha', LEGACY_UMKM_OWNER_PATH],
      },
    ],
    [chatHref, localeKey, manageHref],
  );

  const closeAll = useCallback(() => {
    setProfileOpen(false);
    setMobileOpen(false);
    setMenuSearch('');
  }, []);

  const openLanguageFromDrawer = useCallback(() => {
    setMobileOpen(false);
    setMenuSearch('');
    openLanguageModal();
  }, [openLanguageModal]);

  const toggleDrawerTheme = useCallback(() => {
    setColorScheme(isDark ? 'light' : 'dark');
  }, [isDark, setColorScheme]);

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
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = prevBodyOverflow;
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
    <section
      className={cn(
        'overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.32)] dark:border-[color:var(--app-border-strong)]',
        options?.compact &&
        'border-[color:color-mix(in_srgb,var(--app-accent-border)_54%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,var(--app-surface-strong))]',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1.5">
        <p className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
          {title}
        </p>
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] px-2 text-[10px] font-black text-[color:var(--app-text-soft)]">
          {items.length}
        </span>
      </div>
      <div className="space-y-1">
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
                'ui-pressable group flex min-h-[56px] min-w-0 items-center gap-3 rounded-[16px] px-2.5 py-2 text-left transition',
                active
                  ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border transition',
                  active
                    ? 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] dark:bg-white/10'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] group-hover:text-[color:var(--app-accent)]',
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 block text-[13px] font-black leading-tight">
                  {item.label}
                </span>
                {item.caption ? (
                  <span className="mt-0.5 line-clamp-1 block text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                    {item.caption}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 transition group-hover:translate-x-0.5',
                  active
                    ? 'text-[color:var(--app-accent)]'
                    : 'text-[color:var(--app-text-soft)]',
                )}
              />
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
            className="ui-layer-popover fixed inset-0 bg-slate-950/32 backdrop-blur-sm"
          />
          <aside className="ui-layer-drawer fixed inset-y-0 right-0 flex h-[100dvh] max-h-[100dvh] w-[min(92vw,390px)] flex-col overflow-hidden border-l border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_28px_86px_-34px_rgba(15,23,42,0.56)] ring-1 ring-black/[0.04] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:ring-white/10 lg:inset-y-4 lg:right-4 lg:h-[calc(100dvh-2rem)] lg:w-[min(400px,calc(100vw-2rem))] lg:rounded-[28px] lg:border">
            <div className="shrink-0 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)] dark:border-[color:var(--app-border-strong)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]">
                    <LajuloLogo className="h-6 w-6" textClassName="hidden" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[18px] font-black leading-tight tracking-[-0.03em] text-[color:var(--app-text)]">
                      {locale === 'id' ? 'Menu Lajukan' : 'Lajukan menu'}
                    </h2>
                    <p className="truncate text-[12px] font-semibold text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Cari, posting, chat, dan kelola akun.'
                        : 'Search, post, chat, and manage account.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="ui-pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="relative mt-4">
                <AISearchBar
                  className="w-full"
                  placeholder={text.searchMenu}
                  onSearch={nextQuery => {
                    setMenuSearch(nextQuery);
                    handleGlobalSearchSubmit(nextQuery);
                    setMobileOpen(false);
                  }}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-[color:var(--app-surface-muted)] p-3 pb-4">
              <section className="grid grid-cols-3 gap-1.5">
                {drawerQuickLinks.map(item => {
                  const Icon = item.icon;
                  const active = (
                    item.matchers?.length
                      ? item.matchers
                      : [hrefPath(item.href)]
                  ).some(matcher => matchesRoute(cleanPath, matcher));

                  return (
                    <Link
                      key={`quick-${item.href}-${item.label}`}
                      href={item.href}
                      onClick={closeAll}
                      className={cn(
                        'ui-pressable group flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border px-2 py-2 text-center transition',
                        active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-[12px] border transition',
                          active
                            ? 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] group-hover:text-[color:var(--app-accent)]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="block max-w-full truncate text-[11px] font-black leading-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </section>

              <div className="relative overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.32)] dark:border-[color:var(--app-border-strong)]">
                <div aria-hidden="true" className="hidden" />
                {isAuthenticated ? (
                  <div className="relative">
                    <div className="flex min-w-0 items-center gap-3">
                      <Image
                        src={profileAvatarSrc(
                          user?.avatarUrl || user?.avatar_url,
                          userAvatarStyle,
                          user?.fullName || user?.full_name || user?.email,
                        )}
                        alt="Profile avatar"
                        width={44}
                        height={44}
                        className="h-11 w-11 shrink-0 rounded-full border border-[color:var(--app-border)] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[color:var(--app-text)]">
                          {user?.username || user?.fullName || 'User'}
                        </p>
                        <p className="truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                          {user?.email ||
                            (locale === 'id'
                              ? 'Akun aktif'
                              : 'Active account')}
                        </p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={closeAll}
                        className="ui-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
                        aria-label={
                          locale === 'id' ? 'Buka profil' : 'Open profile'
                        }
                      >
                        <UserRound className="h-4 w-4" />
                      </Link>
                    </div>
                    <div
                      className={cn(
                        'mt-3 grid gap-1.5',
                        PROMO_ONLY_MODE ? 'grid-cols-1' : 'grid-cols-3',
                      )}
                    >
                      {!PROMO_ONLY_MODE ? (
                        <>
                          <Link
                            href="/payments"
                            onClick={closeAll}
                            className="ui-pressable inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 text-xs font-black text-[color:var(--app-text)]"
                          >
                            <Wallet className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                            {locale === 'id' ? 'Saldo' : 'Balance'}
                          </Link>
                          <Link
                            href="/transactions"
                            onClick={closeAll}
                            className="ui-pressable inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 text-xs font-black text-[color:var(--app-text)]"
                          >
                            <Store className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                            {locale === 'id' ? 'Transaksi' : 'Deals'}
                          </Link>
                        </>
                      ) : null}
                      <Link
                        href={manageHref}
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 text-xs font-black text-[color:var(--app-text)]"
                      >
                        <MapPinned className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                        {locale === 'id' ? 'Usaha' : 'Business'}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <p className="text-sm font-black text-[color:var(--app-text)]">
                      {locale === 'id' ? 'Masuk ke akun' : 'Sign in'}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? PROMO_ONLY_MODE
                          ? 'Chat, profil, dan draft promosi jadi tersimpan.'
                          : 'Chat, transaksi, dan draft jadi tersimpan.'
                        : PROMO_ONLY_MODE
                          ? 'Keep chats, profiles, and promotion drafts saved.'
                          : 'Keep chats, transactions, and drafts saved.'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link
                        href="/login"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-black text-[color:var(--app-text)]"
                      >
                        {text.login}
                      </Link>
                      <Link
                        href="/register"
                        onClick={closeAll}
                        className="ui-pressable inline-flex min-h-9 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-strong)] px-3 text-sm font-black text-[color:var(--app-text-inverse)]"
                      >
                        {text.register}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <section className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)]">
                <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                  {text.preferences}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={openLanguageFromDrawer}
                    className="ui-pressable inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-left text-sm font-black text-[color:var(--app-text)]"
                  >
                    <Languages className="h-4 w-4 text-[color:var(--app-accent)]" />
                    <span className="min-w-0">
                      <span className="block truncate">{text.language}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                        {currentLocale?.toUpperCase() ||
                          localeKey.toUpperCase()}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleDrawerTheme}
                    disabled={!isReady}
                    className="ui-pressable inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-left text-sm font-black text-[color:var(--app-text)] disabled:opacity-50"
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-[color:var(--app-accent)]" />
                    ) : (
                      <Moon className="h-4 w-4 text-[color:var(--app-accent)]" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate">
                        {isDark ? text.light : text.dark}
                      </span>
                      <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Mode' : 'Mode'}
                      </span>
                    </span>
                  </button>
                </div>
              </section>

              <div className="space-y-2.5">
                {visibleCreateDrawerItems.length > 0
                  ? renderDrawerGroup(
                    text.createSection,
                    visibleCreateDrawerItems,
                    { compact: true },
                  )
                  : null}
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
            </div>

            <div className="shrink-0 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-[color:var(--app-border-strong)]">
              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  href="/support"
                  onClick={closeAll}
                  className="ui-pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-black text-[color:var(--app-text)]"
                >
                  <CircleHelp className="h-4 w-4" />
                  {text.support}
                </Link>
                <Link
                  href="/settings"
                  onClick={closeAll}
                  className="ui-pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-black text-[color:var(--app-text)]"
                >
                  <Settings className="h-4 w-4" />
                  {locale === 'id' ? 'Setelan' : 'Settings'}
                </Link>
              </div>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    closeAll();
                    void logout();
                  }}
                  className="ui-pressable mt-1.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[13px] border border-[color:color-mix(in_srgb,_var(--app-danger-border)_58%,_transparent)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-black text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
                >
                  <LogOut className="h-4 w-4" />
                  {text.logout}
                </button>
              ) : null}
            </div>
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

          <div className="hidden min-w-0 flex-1 shrink-0 items-center justify-end gap-2 lg:flex xl:gap-2.5">
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileOpen}
              aria-label={text.menu}
              className={cn(
                'ui-pressable inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border shadow-[0_12px_24px_-22px_rgba(15,23,42,0.42)] transition',
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
              className="ui-pressable inline-flex h-11 min-h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-2.5 text-sm font-bold text-[color:var(--app-text-inverse)] shadow-[0_14px_28px_-18px_color-mix(in_srgb,var(--app-accent)_72%,transparent)] transition hover:brightness-105 xl:px-4"
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
                    'ui-pressable inline-flex h-11 min-h-11 items-center gap-0 rounded-full border px-2 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.42)] transition xl:gap-2 xl:px-2 xl:pr-3',
                    matchesRoute(cleanPath, '/profile$') ||
                      matchesRoute(cleanPath, '/profile/edit') ||
                      matchesRoute(cleanPath, '/usaha') ||
                      matchesRoute(cleanPath, LEGACY_UMKM_OWNER_PATH) ||
                      matchesRoute(cleanPath, '/settings') ||
                      (!PROMO_ONLY_MODE &&
                        (matchesRoute(cleanPath, '/transactions') ||
                          matchesRoute(cleanPath, '/payments')))
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                  data-tour="www-profile"
                >
                  <Image
                    src={profileAvatarSrc(
                      user?.avatarUrl || user?.avatar_url,
                      userAvatarStyle,
                      user?.fullName || user?.full_name || user?.email,
                    )}
                    alt="Profile avatar"
                    width={28}
                    height={28}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="hidden max-w-[84px] truncate text-sm font-semibold 2xl:inline">
                    {user?.username || user?.fullName || 'User'}
                  </span>
                </button>

                {profileOpen ? (
                  <div
                    role="menu"
                    className="ui-layer-popover absolute right-0 mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]"
                  >
                    <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-muted))] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Image
                          src={profileAvatarSrc(
                            user?.avatarUrl || user?.avatar_url,
                            userAvatarStyle,
                            user?.fullName || user?.full_name || user?.email,
                          )}
                          alt="Profile avatar"
                          width={44}
                          height={44}
                          className="h-11 w-11 shrink-0 rounded-full border-2 border-[color:var(--app-surface-strong)] object-cover shadow-[0_14px_28px_-24px_rgba(15,23,42,0.55)]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[color:var(--app-text)]">
                            {user?.username || user?.fullName || 'User'}
                          </p>
                          <p className="truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                            {user?.email ||
                              (locale === 'id'
                                ? 'Akun aktif'
                                : 'Active account')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1">
                      {accountDrawerItems.map(item => {
                        const itemPath = hrefPath(item.href);
                        const itemFilter = new URLSearchParams(
                          item.href.split('?')[1] || '',
                        ).get('filter');
                        const currentFilter = searchParams.get('filter');
                        const active =
                          itemPath === '/my-listings'
                            ? cleanPath === '/my-listings' &&
                            (itemFilter
                              ? currentFilter === itemFilter
                              : !currentFilter)
                            : (item.matchers?.some(matcher =>
                              matchesRoute(cleanPath, matcher),
                            ) ?? false);
                        const ItemIcon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'ui-pressable group flex min-h-[46px] items-center gap-2.5 rounded-[15px] px-2.5 text-sm font-semibold transition',
                              active
                                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                            )}
                            onClick={() => setProfileOpen(false)}
                            role="menuitem"
                            aria-current={active ? 'page' : undefined}
                          >
                            <span
                              className={cn(
                                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 transition',
                                active
                                  ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] ring-[color:var(--app-accent-border)]'
                                  : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] ring-[color:var(--app-border)] group-hover:text-[color:var(--app-accent)]',
                              )}
                            >
                              <ItemIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">
                                {item.label}
                              </span>
                              {item.caption ? (
                                <span className="block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                                  {item.caption}
                                </span>
                              ) : null}
                            </span>
                            {active ? (
                              <span className="h-2 w-2 min-w-2 min-h-3 max-w-2 max-h-2 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="my-2 border-t border-[color:var(--app-border)]" />
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1 py-1">
                      <LanguageSwitcherButton />
                      <ThemeToggle />
                    </div>
                    <div className="my-1 border-t border-[color:var(--app-border)]" />
                    <button
                      type="button"
                      className="ui-pressable flex min-h-[44px] w-full items-center gap-2.5 rounded-[15px] px-3 text-left text-sm font-semibold text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
                      onClick={async () => {
                        await logout();
                        setProfileOpen(false);
                      }}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]">
                        <LogOut className="h-4 w-4" />
                      </span>
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
                  className="ui-pressable inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm font-bold text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.42)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
                  onClick={closeAll}
                  data-tour="www-login"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                    <LogIn className="h-3.5 w-3.5" />
                  </span>
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
