'use client';

import Image from 'next/image';
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  ClipboardList,
  Heart,
  Home,
  LayoutGrid,
  Languages,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  LocalizedAnchor as Link,
  localizeHref,
} from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcherButton } from '@/components/modal/LanguageModal/LanguageSwitcherButton';
import { useLanguageModal } from '@/components/modal/LanguageModal/LanguageModalContext';
import LajuloLogo from '@/components/logo/LajuloLogo';
import { HeaderInboxDropdown } from '@/components/layout/HeaderInboxDropdown';
import { ExploreMegaMenu } from '@/components/navigation/ExploreMegaMenu';
import { NavbarGlobalSearch } from '@/components/navigation/NavbarGlobalSearch';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';

import { resolveLocaleFromPathname } from '@/lib/locale';
import {
  profileAvatarSrc,
  readProfileAvatarStyle,
} from '@/lib/profile/avatar';

import {
  UMKM_DISCOVERY_PATH,
  LEGACY_UMKM_OWNER_PATH,
  buildUsahaPath,
  getUmkmSurfaceCopy,
} from '@/lib/umkmSurface';

import { cn } from '@/lib/utils';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

import {
  LAJUKAN_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  categoryLabel,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type MenuArtworkKey =
  | 'all'
  | 'materials'
  | 'services'
  | 'machines'
  | 'places'
  | 'opportunities';

type DrawerVisual =
  | {
      kind: 'icon';
      icon: LucideIcon;
    }
  | {
      kind: 'artwork';
      src: string;
      circle?: boolean;
    };

type DrawerItem = {
  href: string;
  label: string;
  caption?: string;
  visual: DrawerVisual;
  matchers?: string[];
};

type ImageTileSize =
  | 'small'
  | 'medium'
  | 'large';

/* -------------------------------------------------------------------------- */
/* Assets                                                                     */
/* -------------------------------------------------------------------------- */

const MENU_ARTWORKS: Record<
  MenuArtworkKey,
  string
> = {
  all: '/images/hero/menu/semua-01.png',
  materials: '/images/hero/menu/bahan-01.png',
  services: '/images/hero/menu/jasa-01.png',
  machines: '/images/hero/menu/mesin-01.png',
  places: '/images/hero/menu/lok-01.png',
  opportunities: '/images/hero/menu/peluang-01.png',
};

const CREATE_ARTWORKS = {
  need: '/images/create/kategori/cari.png',
  offer: '/images/create/kategori/tawar.png',
} as const;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizePathname(
  pathname: string,
): string {
  const clean = pathname.replace(
    /^\/(id|en)(?=\/|$)/,
    '',
  );

  return clean || '/';
}

function matchesRoute(
  pathname: string,
  matcher: string,
): boolean {
  const exact = matcher.endsWith('$');

  const route = exact
    ? matcher.slice(0, -1) || '/'
    : matcher;

  if (route === '/') {
    return pathname === '/';
  }

  if (exact) {
    return pathname === route;
  }

  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] || '/';
}

function getCategoryArtwork(
  id: string,
  slug: string,
  fallback?: string,
): string {
  const source =
    `${id} ${slug}`.toLowerCase();

  if (
    source.includes('material') ||
    source.includes('supply') ||
    source.includes('bahan')
  ) {
    return MENU_ARTWORKS.materials;
  }

  if (
    source.includes('service') ||
    source.includes('jasa')
  ) {
    return MENU_ARTWORKS.services;
  }

  if (
    source.includes('machine') ||
    source.includes('equipment') ||
    source.includes('alat') ||
    source.includes('mesin')
  ) {
    return MENU_ARTWORKS.machines;
  }

  if (
    source.includes('property') ||
    source.includes('place') ||
    source.includes('location') ||
    source.includes('tempat') ||
    source.includes('lokasi')
  ) {
    return MENU_ARTWORKS.places;
  }

  if (
    source.includes('opportun') ||
    source.includes('peluang')
  ) {
    return MENU_ARTWORKS.opportunities;
  }


  return fallback || MENU_ARTWORKS.all;
}

/* -------------------------------------------------------------------------- */
/* Artwork                                                                    */
/* -------------------------------------------------------------------------- */

function MenuArtwork({
  src,
  size = 'medium',
  priority = false,
  circle = false,
}: {
  src: string;
  size?: ImageTileSize;
  priority?: boolean;
  circle?: boolean;
}) {
  const sizeClass =
    size === 'small'
      ? 'h-[42px] w-[42px]'
      : size === 'large'
        ? 'h-[82px] w-[82px]'
        : 'h-[64px] w-[64px]';

  /*
   * Semua artwork dari CREATE_ARTWORKS otomatis dibuat bulat.
   *
   * Ini membuat:
   * - /images/create/kategori/cari.png
   * - /images/create/kategori/tawar.png
   *
   * selalu:
   * - rounded-full
   * - center
   * - object-cover
   *
   * Jadi pemanggil MenuArtwork tidak perlu lagi menambahkan
   * circle secara manual.
   */
  const isCreateArtwork =
    src.startsWith('/images/create/');

  const shouldBeCircle =
    circle || isCreateArtwork;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden',
        sizeClass,
        shouldBeCircle &&
          'rounded-full',
      )}
    >
      <Image
        src={src}
        alt=""
        width={
          size === 'small'
            ? 48
            : size === 'large'
              ? 96
              : 76
        }
        height={
          size === 'small'
            ? 48
            : size === 'large'
              ? 96
              : 76
        }
        priority={priority}
        loading={
          priority
            ? undefined
            : 'lazy'
        }
        draggable={false}
        className={cn(
          'block h-full w-full select-none',
          shouldBeCircle
            ? 'object-cover'
            : 'object-contain',
        )}
        sizes={
          size === 'small'
            ? '48px'
            : size === 'large'
              ? '96px'
              : '76px'
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Simple icon                                                                */
/* -------------------------------------------------------------------------- */

function MenuIcon({
  icon: Icon,
  active = false,
}: {
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
        active
          ? 'bg-white text-[color:var(--app-accent)] shadow-sm dark:bg-[color:var(--app-surface-strong)]'
          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function DrawerVisual({
  visual,
  artworkSize = 'small',
  active = false,
}: {
  visual: DrawerVisual;
  artworkSize?: ImageTileSize;
  active?: boolean;
}) {
  if (visual.kind === 'artwork') {
    return (
      <MenuArtwork
        src={visual.src}
        size={artworkSize}
        circle={visual.circle}
      />
    );
  }

  return (
    <MenuIcon
      icon={visual.icon}
      active={active}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    user,
    logout,
    isAuthenticated,
  } = useAuth();

  const {
    open: openLanguageModal,
    currentLocale,
  } = useLanguageModal();

  const locale =
    resolveLocaleFromPathname(
      pathname,
    );

  const localeKey: LajukanLocale =
    locale === 'id'
      ? 'id'
      : 'en';

  const isId = localeKey === 'id';

  const cleanPath =
    normalizePathname(pathname);

  const activeSearchQuery =
    searchParams.get('q') || '';

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [globalSearchDraft, setGlobalSearchDraft] =
    useState({
      source: activeSearchQuery,
      value: activeSearchQuery,
    });

  const profileMenuRef =
    useRef<HTMLDivElement | null>(null);

  const avatarStyle =
    readProfileAvatarStyle(user);

  const avatarSrc =
    profileAvatarSrc(
      user?.avatarUrl ||
        user?.avatar_url,
      avatarStyle,
      user?.fullName ||
        user?.full_name ||
        user?.email ||
        'User',
    );

  const avatarRemote =
    avatarSrc.startsWith(
      'https://',
    );

  const globalSearch =
    globalSearchDraft.source ===
    activeSearchQuery
      ? globalSearchDraft.value
      : activeSearchQuery;

  const createHref =
    isAuthenticated
      ? '/create'
      : '/register';

  const chatHref =
    isAuthenticated
      ? '/chat'
      : '/login';

  const manageHref =
    buildUsahaPath('home');

  const accountHref =
    isAuthenticated
      ? '/profile'
      : '/login';

  const text = useMemo(
    () => ({
      menu: 'Menu',

      create: isId
        ? 'Posting'
        : 'Post',

      login: isId
        ? 'Masuk'
        : 'Login',

      register: isId
        ? 'Daftar'
        : 'Register',

      logout: isId
        ? 'Keluar'
        : 'Logout',

      support: isId
        ? 'Bantuan'
        : 'Help',

      categoryTitle: isId
        ? 'Jelajahi kategori'
        : 'Explore categories',

      categoryHint: isId
        ? 'Pilih yang paling dekat dengan kebutuhanmu.'
        : 'Choose the category closest to what you need.',

      createTitle: isId
        ? 'Mau buat apa?'
        : 'What do you want to do?',

      createHint: isId
        ? 'Pilih salah satu. Kamu bisa lanjut mengisi detail setelahnya.'
        : 'Choose one. You can add the details next.',

      aroundTitle: isId
        ? 'Di sekitar kamu'
        : 'Around you',

      activityTitle: isId
        ? 'Aktivitas'
        : 'Activity',

      all: isId
        ? 'Semua'
        : 'All',

      allHint: isId
        ? 'Lihat semuanya'
        : 'Browse everything',

      seeAll: isId
        ? 'Lihat semua'
        : 'See all',
    }),
    [isId],
  );

  /* ---------------------------------------------------------------------- */
  /* Primary navigation                                                      */
  /* ---------------------------------------------------------------------- */

  const primaryItems =
    useMemo(
      () =>
        buildPrimaryNavItems(
          isAuthenticated,
          localeKey,
        ),
      [
        isAuthenticated,
        localeKey,
      ],
    );

  const desktopPrimaryItems =
    useMemo(
      () =>
        primaryItems.filter(
          item =>
            item.key !==
              'account' &&
            item.key !==
              'create',
        ),
      [primaryItems],
    );

  const activePrimaryKey =
    resolveActivePrimaryNavKey(
      primaryItems,
      pathname,
    );

  /* ---------------------------------------------------------------------- */
  /* Categories                                                              */
  /* ---------------------------------------------------------------------- */

  const categories =
    useMemo(
      () =>
        LAJUKAN_EXPLORE_CATEGORIES.filter(
          category => {
            if (!category.navigation.showInMobileDrawer) {
              return false;
            }

            const source =
              `${category.id} ${category.slug}`.toLowerCase();

            return !(
              source.includes('community') ||
              source.includes('komunit') ||
              source.includes('video') ||
              source.includes('reel')
            );
          },
        ),
      [],
    );

  /* ---------------------------------------------------------------------- */
  /* Account                                                                */
  /* ---------------------------------------------------------------------- */

  const accountItems =
    useMemo<DrawerItem[]>(() => {
      const surface =
        getUmkmSurfaceCopy(
          localeKey,
        );

      if (!isAuthenticated) {
        return [
          {
            href: '/login',
            label: isId ? 'Masuk' : 'Login',
            caption: isId
              ? 'Akses akun dan chat'
              : 'Access account and chat',
            visual: { kind: 'icon', icon: LogIn },
            matchers: ['/login'],
          },
          {
            href: '/register',
            label: isId ? 'Daftar' : 'Register',
            caption: isId
              ? 'Buat akun Lajukan'
              : 'Create your account',
            visual: { kind: 'icon', icon: Plus },
            matchers: ['/register'],
          },
          {
            href: '/support',
            label: isId ? 'Bantuan' : 'Help',
            caption: isId
              ? 'Pusat bantuan'
              : 'Help center',
            visual: { kind: 'icon', icon: CircleHelp },
            matchers: ['/support'],
          },
        ];
      }

      return [
        {
          href: accountHref,
          label: isId ? 'Akun' : 'Account',
          caption: isId
            ? 'Profil dan aktivitas'
            : 'Profile and activity',
          visual: { kind: 'icon', icon: UserRound },
          matchers: ['/profile$', '/profile/edit'],
        },
        {
          href: '/manage',
          label: isId ? 'Pusat Kelola' : 'Manage',
          caption: isId
            ? 'Kelola postingan dan konten'
            : 'Manage posts and content',
          visual: { kind: 'icon', icon: LayoutDashboard },
          matchers: ['/manage'],
        },
        {
          href: '/my-listings',
          label: isId ? 'Postingan' : 'Posts',
          caption: isId
            ? 'Postingan aktif dan draft'
            : 'Live posts and drafts',
          visual: { kind: 'icon', icon: Package },
          matchers: ['/my-listings'],
        },
        {
          href: '/my-listings?filter=favorites',
          label: isId ? 'Tersimpan' : 'Saved',
          caption: isId
            ? 'Postingan yang disimpan'
            : 'Saved posts',
          visual: { kind: 'icon', icon: Heart },
          matchers: ['/my-listings'],
        },
        ...(!PROMO_ONLY_MODE
          ? [
              {
                href: '/payments',
                label: isId ? 'Saldo' : 'Balance',
                caption: isId
                  ? 'Pembayaran dan saldo'
                  : 'Payments and balance',
                visual: { kind: 'icon' as const, icon: Wallet },
                matchers: ['/payments'],
              },
            ]
          : []),
        {
          href: manageHref,
          label:
            surface.owner ||
            (isId ? 'Usaha Saya' : 'My Business'),
          caption: isId
            ? 'Toko, katalog, dan order'
            : 'Store, catalog, and orders',
          visual: { kind: 'icon', icon: BriefcaseBusiness },
          matchers: ['/usaha', LEGACY_UMKM_OWNER_PATH],
        },
        ...(!PROMO_ONLY_MODE
          ? [
              {
                href: '/transactions',
                label: isId ? 'Transaksi' : 'Transactions',
                caption: isId
                  ? 'Deal dan proses berjalan'
                  : 'Deals and active processes',
                visual: { kind: 'icon' as const, icon: ShoppingBag },
                matchers: ['/transactions'],
              },
            ]
          : []),
        {
          href: '/settings',
          label: isId ? 'Pengaturan' : 'Settings',
          caption: isId
            ? 'Bahasa, keamanan, akun'
            : 'Language, security, account',
          visual: { kind: 'icon', icon: Settings },
          matchers: ['/settings'],
        },
      ];
    }, [
      accountHref,
      isAuthenticated,
      isId,
      localeKey,
      manageHref,
    ]);

  /* ---------------------------------------------------------------------- */
  /* Create items                                                           */
  /* ---------------------------------------------------------------------- */

  const createItems =
    useMemo<DrawerItem[]>(
      () => {
        const needHref =
          isAuthenticated
            ? isId
              ? '/create/butuh'
              : '/create/need'
            : '/register';

        const offerHref =
          isAuthenticated
            ? isId
              ? '/create/jual'
              : '/create/sell'
            : '/register';

        return [
          {
            href: needHref,
            label: isId
              ? 'Saya sedang mencari'
              : 'I am looking for',
            caption: isId
              ? 'Cari produk, jasa, alat, tempat, atau peluang.'
              : 'Find products, services, tools, places, or opportunities.',
            visual: {
              kind: 'artwork',
              src: CREATE_ARTWORKS.need,
              circle: true,
            },
            matchers: ['/create/butuh', '/create/need'],
          },
          {
            href: offerHref,
            label: isId
              ? 'Saya punya sesuatu'
              : 'I have something',
            caption: isId
              ? 'Tawarkan produk, jasa, alat, tempat, atau peluang.'
              : 'Offer products, services, tools, places, or opportunities.',
            visual: {
              kind: 'artwork',
              src: CREATE_ARTWORKS.offer,
              circle: true,
            },
            matchers: ['/create/jual', '/create/sell'],
          },
        ];
      },
      [isAuthenticated, isId],
    );

  /* ---------------------------------------------------------------------- */
  /* Quick navigation                                                        */
  /* ---------------------------------------------------------------------- */

  const quickItems =
    useMemo<DrawerItem[]>(
      () => [
        {
          href: '/home',
          label: isId ? 'Beranda' : 'Home',
          visual: { kind: 'icon', icon: Home },
          matchers: ['/home', '/'],
        },
        {
          href: '/explore',
          label: isId ? 'Jelajahi' : 'Explore',
          visual: { kind: 'icon', icon: LayoutGrid },
          matchers: ['/explore'],
        },
        {
          href: '/community',
          label: isId ? 'Komunitas' : 'Community',
          visual: { kind: 'icon', icon: Users },
          matchers: ['/community'],
        },
        {
          href: '/reels',
          label: 'Video',
          visual: { kind: 'icon', icon: Clapperboard },
          matchers: ['/reels'],
        },
        {
          href: chatHref,
          label: 'Chat',
          visual: { kind: 'icon', icon: MessageCircle },
          matchers: ['/chat'],
        },
        {
          href: createHref,
          label: isId ? 'Posting' : 'Post',
          visual: { kind: 'icon', icon: Plus },
          matchers: ['/create'],
        },
      ],
      [chatHref, createHref, isId],
    );

  /* ---------------------------------------------------------------------- */
  /* Around                                                                  */
  /* ---------------------------------------------------------------------- */

  const aroundItems =
    useMemo<DrawerItem[]>(
      () => [
        {
          href: UMKM_DISCOVERY_PATH,
          label: isId
            ? 'Usaha Sekitar'
            : 'Nearby Businesses',
          caption: isId
            ? 'Cari usaha di dekatmu'
            : 'Find businesses near you',
          visual: { kind: 'icon', icon: Store },
          matchers: [UMKM_DISCOVERY_PATH],
        },
        {
          href: '/umkm?view=map',
          label: isId ? 'Peta Usaha' : 'Business Map',
          caption: isId
            ? 'Lihat usaha lewat peta'
            : 'Browse businesses on the map',
          visual: { kind: 'icon', icon: MapPinned },
          matchers: ['/umkm'],
        },
      ],
      [isId],
    );

  /* ---------------------------------------------------------------------- */
  /* Activity                                                                */
  /* ---------------------------------------------------------------------- */

  const activityItems =
    useMemo<DrawerItem[]>(
      () => [
        {
          href: isAuthenticated ? '/notifications' : '/login',
          label: isId ? 'Notifikasi' : 'Notifications',
          caption: isId ? 'Kabar penting' : 'Important updates',
          visual: { kind: 'icon', icon: Bell },
          matchers: ['/notifications'],
        },
        {
          href: isAuthenticated ? '/manage' : '/login',
          label: isId ? 'Pusat Kelola' : 'Manage',
          caption: isId
            ? 'Kelola postingan dan konten'
            : 'Manage posts and content',
          visual: { kind: 'icon', icon: LayoutDashboard },
          matchers: ['/manage'],
        },
        {
          href: isAuthenticated
            ? '/my-listings?filter=favorites'
            : '/login',
          label: isId ? 'Tersimpan' : 'Saved',
          caption: isId
            ? 'Postingan yang disimpan'
            : 'Saved posts',
          visual: { kind: 'icon', icon: Heart },
          matchers: ['/my-listings'],
        },
        {
          href: isAuthenticated
            ? '/my-listings?filter=draft'
            : '/login',
          label: isId ? 'Draft' : 'Drafts',
          caption: isId
            ? 'Lanjutkan postingan'
            : 'Continue posts',
          visual: { kind: 'icon', icon: ClipboardList },
          matchers: ['/my-listings'],
        },
      ],
      [isAuthenticated, isId],
    );

  /* ---------------------------------------------------------------------- */
  /* Global handlers                                                         */
  /* ---------------------------------------------------------------------- */

  const closeAll =
    useCallback(() => {
      setProfileOpen(false);
      setMobileOpen(false);
    }, [setMobileOpen, setProfileOpen]);

  const setGlobalSearch =
    useCallback(
      (value: string) => {
        setGlobalSearchDraft({
          source:
            activeSearchQuery,
          value,
        });
      },
      [activeSearchQuery],
    );

  const handleGlobalSearchSubmit =
    useCallback(
      (submittedQuery: string) => {
        const query =
          submittedQuery.trim();

        const nextHref =
          query
            ? `/explore?q=${encodeURIComponent(query)}`
            : '/explore';

        closeAll();

        router.push(
          localizeHref(
            nextHref,
            locale,
          ),
        );
      },
      [
        closeAll,
        locale,
        router,
      ],
    );

  const toggleMobileMenu =
    useCallback(() => {
      setMobileOpen(
        previous => !previous,
      );
    }, []);

  /* ---------------------------------------------------------------------- */
  /* Effects                                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown =
      (event: MouseEvent) => {
        const target =
          event.target;

        if (!(target instanceof Node)) {
          return;
        }

        if (
          !profileMenuRef.current?.contains(
            target,
          )
        ) {
          setProfileOpen(false);
        }
      };

    document.addEventListener(
      'mousedown',
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handlePointerDown,
      );
    };
  }, [profileOpen]);

  useEffect(() => {
    if (
      !profileOpen &&
      !mobileOpen
    ) {
      return;
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key !== 'Escape'
        ) {
          return;
        }

        setProfileOpen(false);
        setMobileOpen(false);
      };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    mobileOpen,
    profileOpen,
  ]);

  useBodyScrollLock(
    mobileOpen,
  );

  /* ---------------------------------------------------------------------- */
  /* Mobile create card                                                      */
  /* ---------------------------------------------------------------------- */

  const renderCreateCard = (
    item: DrawerItem,
  ) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={closeAll}
      className="group min-w-0 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5 text-center transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_16px_32px_-24px_rgba(15,23,42,0.35)]"
    >
      <div className="flex h-[86px] items-center justify-center">
        <DrawerVisual visual={item.visual} artworkSize="large" />
      </div>

      <h3 className="mt-2.5 line-clamp-2 min-h-[34px] text-[13px] font-black leading-4 text-[color:var(--app-text)]">
        {item.label}
      </h3>

      {item.caption ? (
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
          {item.caption}
        </p>
      ) : null}
    </Link>
  );

  /* ---------------------------------------------------------------------- */
  /* Mobile quick card                                                       */
  /* ---------------------------------------------------------------------- */

  const renderQuickCard = (
    item: DrawerItem,
  ) => {
    const active = (
      item.matchers &&
      item.matchers.length > 0
        ? item.matchers
        : [hrefPath(item.href)]
    ).some(
      matcher =>
        matchesRoute(
          cleanPath,
          matcher,
        ),
    );

    return (
      <Link
        key={`${item.href}-${item.label}`}
        href={item.href}
        onClick={closeAll}
        aria-current={
          active
            ? 'page'
            : undefined
        }
        className={cn(
          'flex min-h-[74px] min-w-0 flex-col items-center justify-center rounded-[15px] border px-1 py-2 text-center transition',
          active
            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]',
        )}
      >
        <div className="flex h-10 items-center justify-center">
          <DrawerVisual visual={item.visual} active={active} />
        </div>

        <span
          className={cn(
            'mt-1.5 line-clamp-1 text-[10.5px] font-black',
            active
              ? 'text-[color:var(--app-accent)]'
              : 'text-[color:var(--app-text)]',
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  /* ---------------------------------------------------------------------- */
  /* Mobile drawer                                                           */
  /* ---------------------------------------------------------------------- */

  const mobileDrawer =
    typeof document !==
      'undefined' &&
    mobileOpen
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={
                isId
                  ? 'Tutup menu'
                  : 'Close menu'
              }
              onClick={() =>
                setMobileOpen(false)
              }
              className="ui-layer-popover fixed inset-0 bg-slate-950/35"
            />

            <aside
              className="ui-layer-drawer fixed inset-y-0 right-0 flex h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] w-[min(94vw,410px)] flex-col overflow-hidden border-l border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_28px_86px_-34px_rgba(15,23,42,0.56)] dark:border-[color:var(--app-border-strong)] lg:inset-y-4 lg:right-4 lg:h-[calc(var(--app-viewport-height)-2rem)] lg:w-[410px] lg:rounded-[26px] lg:border"
            >
              <div className="shrink-0 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.7rem)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[color:var(--app-surface-muted)]">
                      <LajuloLogo
                        markOnly
                        className="h-7 w-7"
                        markClassName="h-7 w-7"
                      />
                    </span>

                    <h2 className="text-[17px] font-black text-[color:var(--app-text)]">
                      Menu
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMobileOpen(false)
                    }
                    aria-label={
                      isId
                        ? 'Tutup'
                        : 'Close'
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-3">
                  <NavbarGlobalSearch
                    locale={localeKey}
                    pathname={cleanPath}
                    value={globalSearch}
                    onValueChange={setGlobalSearch}
                    onSubmit={handleGlobalSearchSubmit}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--app-surface-muted)] px-2.5 py-2.5 pb-4">
                <section className="grid grid-cols-3 gap-1.5">
                  {quickItems.map(
                    renderQuickCard,
                  )}
                </section>

                <section className="mt-2.5 rounded-[17px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2.5">
                      <Image
                        src={avatarSrc}
                        alt={
                          isId
                            ? 'Foto profil'
                            : 'Profile photo'
                        }
                        width={40}
                        height={40}
                        unoptimized={
                          avatarRemote
                        }
                        className="h-10 w-10 rounded-full object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-[color:var(--app-text)]">
                          {user?.username ||
                            user?.fullName ||
                            user?.full_name ||
                            'User'}
                        </p>

                        <p className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                          {user?.email ||
                            (isId
                              ? 'Akun aktif'
                              : 'Active account')}
                        </p>
                      </div>

                      <Link
                        href="/profile"
                        onClick={closeAll}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)]"
                        aria-label={
                          isId
                            ? 'Buka profil'
                            : 'Open profile'
                        }
                      >
                        <UserRound className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-black text-[color:var(--app-text)]">
                        {isId
                          ? 'Simpan chat dan draft'
                          : 'Save chats and drafts'}
                      </p>

                      <Link
                        href="/login"
                        onClick={closeAll}
                        className="flex min-h-9 items-center rounded-[11px] bg-[color:var(--app-surface-muted)] px-3 text-[11px] font-black"
                      >
                        {text.login}
                      </Link>

                      <Link
                        href="/register"
                        onClick={closeAll}
                        className="flex min-h-9 items-center rounded-[11px] bg-[color:var(--app-accent-strong)] px-3 text-[11px] font-black text-white"
                      >
                        {text.register}
                      </Link>
                    </div>
                  )}
                </section>

                <section className="mt-3">
                  <div className="px-1">
                    <h3 className="text-[14px] font-black text-[color:var(--app-text)]">
                      {text.createTitle}
                    </h3>

                    <p className="mt-0.5 text-[10px] text-[color:var(--app-text-soft)]">
                      {text.createHint}
                    </p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {createItems.map(
                      renderCreateCard,
                    )}
                  </div>
                </section>

                <section className="mt-3">
                  <div className="px-1">
                    <h3 className="text-[13px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                      {text.categoryTitle}
                    </h3>

                    <p className="mt-0.5 text-[10px] text-[color:var(--app-text-soft)]">
                      {text.categoryHint}
                    </p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link
                      href="/explore?tab=all&side=supply"
                      onClick={closeAll}
                      className="group rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5 transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)]"
                    >
                      <div className="flex h-[82px] items-center justify-center">
                        <MenuArtwork
                          src={MENU_ARTWORKS.all}
                          size="large"
                        />
                      </div>

                      <h3 className="mt-2.5 text-[13px] font-black text-[color:var(--app-text)]">
                        {text.all}
                      </h3>

                      <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                        {text.allHint}
                      </p>
                    </Link>

                    {categories.map(
                      category => {
                        const href =
                          buildExploreCategoryHref(
                            category,
                          );

                        const active =
                          cleanPath ===
                            href ||
                          cleanPath.startsWith(
                            `${href}/`,
                          );

                        const image =
                          category.image ||
                          getCategoryArtwork(
                            category.id,
                            category.slug,
                          );

                        const label =
                          categoryLabel(
                            category,
                            localeKey,
                          );

                        const description =
                          isId
                            ? category.descriptionId
                            : category.descriptionEn;

                        return (
                          <Link
                            key={category.id}
                            href={href}
                            onClick={closeAll}
                            aria-current={
                              active
                                ? 'page'
                                : undefined
                            }
                            className={cn(
                              'group rounded-[18px] border p-3.5 transition hover:-translate-y-0.5',
                              active
                                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:border-[color:var(--app-accent-border)]',
                            )}
                          >
                            <div className="flex h-[82px] items-center justify-center">
                              <MenuArtwork
                                src={image}
                                size="large"
                              />
                            </div>

                            <h3
                              className={cn(
                                'mt-2.5 line-clamp-2 text-[13px] font-black leading-4',
                                active
                                  ? 'text-[color:var(--app-accent)]'
                                  : 'text-[color:var(--app-text)]',
                              )}
                            >
                              {label}
                            </h3>

                            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                              {description}
                            </p>
                          </Link>
                        );
                      },
                    )}
                  </div>

                  <Link
                    href="/explore"
                    onClick={closeAll}
                    className="mt-2 flex min-h-10 items-center justify-center rounded-[14px] bg-[color:var(--app-surface-strong)] text-[11px] font-black text-[color:var(--app-accent)]"
                  >
                    {text.seeAll}
                  </Link>
                </section>

                <section className="mt-3">
                  <div className="px-1">
                    <h3 className="text-[14px] font-black text-[color:var(--app-text)]">
                      {text.aroundTitle}
                    </h3>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {aroundItems.map(
                      renderCreateCard,
                    )}
                  </div>
                </section>

                <section className="mt-3">
                  <div className="px-1">
                    <h3 className="text-[14px] font-black text-[color:var(--app-text)]">
                      {text.activityTitle}
                    </h3>
                  </div>

                  <div className="mt-2 overflow-hidden rounded-[17px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
                    {activityItems.map(
                      (
                        item,
                        index,
                      ) => {
                        const active =
                          (
                            item.matchers ||
                            []
                          ).some(
                            matcher =>
                              matchesRoute(
                                cleanPath,
                                matcher,
                              ),
                          );

                        return (
                          <Link
                            key={`${item.href}-${item.label}`}
                            href={item.href}
                            onClick={closeAll}
                            className={cn(
                              'flex min-h-[58px] items-center gap-2.5 px-3',
                              index <
                                activityItems.length -
                                  1 &&
                                'border-b border-[color:var(--app-border)]',
                              active
                                ? 'bg-[color:var(--app-accent-soft)]'
                                : 'hover:bg-[color:var(--app-surface-muted)]',
                            )}
                          >
                            <DrawerVisual visual={item.visual} active={active} />

                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block truncate text-[12px] font-black',
                                  active
                                    ? 'text-[color:var(--app-accent)]'
                                    : 'text-[color:var(--app-text)]',
                                )}
                              >
                                {item.label}
                              </span>

                              {item.caption ? (
                                <span className="mt-0.5 block truncate text-[10px] text-[color:var(--app-text-soft)]">
                                  {item.caption}
                                </span>
                              ) : null}
                            </span>

                            <ChevronRight
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]"
                            />
                          </Link>
                        );
                      },
                    )}
                  </div>
                </section>
              </div>

              <div className="shrink-0 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)]">
                <div
                  className={cn(
                    'grid gap-1',
                    isAuthenticated
                      ? 'grid-cols-4'
                      : 'grid-cols-3',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      openLanguageModal();
                    }}
                    className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-[11px] bg-[color:var(--app-surface-muted)] text-[10px] font-black"
                  >
                    <Languages className="h-4 w-4" />
                    {currentLocale?.toUpperCase() ||
                      localeKey.toUpperCase()}
                  </button>

                  <Link
                    href="/support"
                    onClick={closeAll}
                    className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-[11px] bg-[color:var(--app-surface-muted)] text-[10px] font-black"
                  >
                    <CircleHelp className="h-4 w-4" />
                    {text.support}
                  </Link>

                  <Link
                    href="/settings"
                    onClick={closeAll}
                    className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-[11px] bg-[color:var(--app-surface-muted)] text-[10px] font-black"
                  >
                    <Settings className="h-4 w-4" />
                    {isId
                      ? 'Setelan'
                      : 'Settings'}
                  </Link>

                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeAll();
                        void logout();
                      }}
                      className="flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-[11px] bg-[color:var(--app-surface-muted)] text-[10px] font-black text-[color:var(--app-danger)]"
                    >
                      <LogOut className="h-4 w-4" />
                      {text.logout}
                    </button>
                  ) : null}
                </div>
              </div>
            </aside>
          </>,
          document.body,
        )
      : null;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      <header
        className="ui-layer-header fixed inset-x-0 top-0 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]/95 backdrop-blur-xl"
        data-tour="www-header"
      >
        <div
          style={{
            height:
              'env(safe-area-inset-top,0px)',
          }}
        />

        <div className="lajukan-header-shell page-shell flex h-12 items-center gap-2 sm:h-14">
          <Link
            href="/home"
            onClick={closeAll}
            aria-label="Lajukan"
            className="shrink-0 flex justify-center items-center"
          >
            <span className="inline-flex max-w-[40px] 2xl:max-w-[128px]">
              <LajuloLogo
                textClassName="hidden 2xl:inline"
              />
            </span>
          </Link>

          <nav
            className="hidden shrink-0 items-center gap-0.5 lg:flex"
            aria-label={
              isId
                ? 'Navigasi utama'
                : 'Main navigation'
            }
          >
            {desktopPrimaryItems.map(
              item => {
                if (
                  item.key ===
                  'explore'
                ) {
                  return (
                    <ExploreMegaMenu
                      key={item.key}
                      locale={localeKey}
                      pathname={cleanPath}
                      onNavigate={closeAll}
                    />
                  );
                }

                const Icon =
                  item.icon;

                const active =
                  activePrimaryKey ===
                  item.key;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={closeAll}
                    aria-current={
                      active
                        ? 'page'
                        : undefined
                    }
                    className={cn(
                      'inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[14px] px-2 text-sm font-semibold transition xl:px-2.5',
                      active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        active
                          ? 'bg-white text-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span
                      className={
                        item.key ===
                        'home'
                          ? 'hidden xl:inline'
                          : 'hidden 2xl:inline'
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              },
            )}
          </nav>

          {matchesRoute(
            cleanPath,
            '/explore',
          ) ? (
            <div className="hidden flex-1 lg:block" />
          ) : (
            <div className="hidden min-w-[220px] flex-1 lg:block 2xl:min-w-[360px]">
              <NavbarGlobalSearch
                locale={localeKey}
                pathname={cleanPath}
                value={globalSearch}
                onValueChange={setGlobalSearch}
                onSubmit={handleGlobalSearchSubmit}
              />
            </div>
          )}

          <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileOpen}
              aria-label={text.menu}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border transition',
                mobileOpen
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]',
              )}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>

            {isAuthenticated ? (
              <>
                <HeaderInboxDropdown
                  kind="chat"
                  isId={isId}
                  active={matchesRoute(
                    cleanPath,
                    '/chat',
                  )}
                />

                <HeaderInboxDropdown
                  kind="notifications"
                  isId={isId}
                  active={matchesRoute(
                    cleanPath,
                    '/notifications',
                  )}
                />
              </>
            ) : null}

            <Link
              href={createHref}
              onClick={closeAll}
              className="flex h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-3 text-sm font-black text-white transition hover:brightness-105"
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
              />

              <span className="hidden xl:inline">
                {text.create}
              </span>
            </Link>

            {isAuthenticated ? (
              <div
                ref={profileMenuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() =>
                    setProfileOpen(
                      previous =>
                        !previous,
                    )
                  }
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className="flex h-11 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2"
                >
                  <Image
                    src={avatarSrc}
                    alt={
                      isId
                        ? 'Foto profil'
                        : 'Profile photo'
                    }
                    width={32}
                    height={32}
                    unoptimized={
                      avatarRemote
                    }
                    className="h-8 w-8 rounded-full object-cover"
                  />

                  <span className="hidden max-w-[90px] truncate text-sm font-semibold 2xl:inline">
                    {user?.username ||
                      user?.fullName ||
                      user?.full_name ||
                      'User'}
                  </span>
                </button>

                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[320px] rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-2xl"
                  >
                    <div className="flex items-center gap-2 rounded-[14px] bg-[color:var(--app-surface-muted)] p-2">
                      <Image
                        src={avatarSrc}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized={
                          avatarRemote
                        }
                        className="h-10 w-10 rounded-full object-cover"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {user?.username ||
                            user?.fullName ||
                            user?.full_name ||
                            'User'}
                        </p>

                        <p className="truncate text-[11px] text-[color:var(--app-text-soft)]">
                          {user?.email ||
                            (isId
                              ? 'Akun aktif'
                              : 'Active account')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {accountItems.map(
                        item => {
                          const active =
                            (
                              item.matchers ||
                              []
                            ).some(
                              matcher =>
                                matchesRoute(
                                  cleanPath,
                                  matcher,
                                ),
                            );

                          return (
                            <Link
                              key={`${item.href}-${item.label}`}
                              href={item.href}
                              role="menuitem"
                              aria-current={
                                active
                                  ? 'page'
                                  : undefined
                              }
                              onClick={() =>
                                setProfileOpen(
                                  false,
                                )
                              }
                              className={cn(
                                'flex min-h-[46px] items-center gap-2 rounded-[12px] px-2',
                                active
                                  ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                  : 'hover:bg-[color:var(--app-surface-muted)]',
                              )}
                            >
                              <DrawerVisual visual={item.visual} active={active} />

                              <span className="min-w-0 truncate text-[11px] font-black">
                                {item.label}
                              </span>
                            </Link>
                          );
                        },
                      )}
                    </div>

                    <div className="my-2 border-t border-[color:var(--app-border)]" />

                    <div className="grid grid-cols-[1fr_auto] gap-1">
                      <LanguageSwitcherButton />
                      <ThemeToggle />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setProfileOpen(
                          false,
                        );
                      }}
                      className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-[12px] text-xs font-black text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
                    >
                      <LogOut className="h-4 w-4" />
                      {text.logout}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <LanguageSwitcherButton />
                <ThemeToggle />

                <Link
                  href="/login"
                  onClick={closeAll}
                  className="flex h-11 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-black"
                >
                  <LogIn
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  {text.login}
                </Link>
              </>
            )}
          </div>

          <div className="ml-auto flex lg:hidden">
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileOpen}
              aria-label={
                mobileOpen
                  ? isId
                    ? 'Tutup menu'
                    : 'Close menu'
                  : isId
                    ? 'Buka menu'
                    : 'Open menu'
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]"
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

      {mobileDrawer}
    </>
  );
}
