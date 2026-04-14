'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Bell,
  ChevronRight,
  MapPinned,
  Menu,
  MessageCircle,
  Plus,
  Search as SearchIcon,
  Settings,
  ShoppingBag,
  Store,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { LanguageSwitcherButton } from '@/components/modal/LanguageModal/LanguageSwitcherButton';
import { useChatInbox } from '@/context/ChatInboxContext';
import LajuloLogo from '@/components/logo/LajuloLogo';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { WalletHeaderShortcut } from '@/components/wallet/WalletHeaderShortcut';
import { resolveLocaleFromPathname } from '@/lib/locale';
import {
  LEGACY_UMKM_OWNER_PATH,
  UMKM_DISCOVERY_PATH,
  UMKM_OWNER_PATH,
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

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchers: string[];
};

type DrawerItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchers?: string[];
};

export function Header() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { totalUnread } = useChatInbox();
  const { unreadCount } = useNotificationInbox();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const locale = resolveLocaleFromPathname(pathname);
  const localeKey = locale === 'id' ? 'id' : 'en';
  const cleanPath = normalizePathname(pathname);
  const createHref = isAuthenticated ? '/create' : '/register';
  const mapHref = UMKM_DISCOVERY_PATH;
  const manageHref = UMKM_OWNER_PATH;
  const accountHref = isAuthenticated ? '/profile' : '/login';
  const chatHref = isAuthenticated ? '/chat' : '/login';
  const surfaceCopy = getUmkmSurfaceCopy(locale);

  const text = {
    brand: locale === 'id' ? 'Lajukan UMKM' : 'Lajukan',
    brandHint:
      locale === 'id'
        ? 'Supplier, jasa, dan peluang usaha'
        : 'Suppliers, services, and business opportunities',
    search: locale === 'id' ? 'Cari' : 'Search',
    mapLong: surfaceCopy.discovery,
    manage: surfaceCopy.owner,
    create: locale === 'id' ? 'Posting' : 'Post',
    createLong:
      locale === 'id'
        ? 'Posting kebutuhan atau tawaran baru'
        : 'Post a new need or offer',
    chat: locale === 'id' ? 'Chat' : 'Chat',
    account: locale === 'id' ? 'Akun' : 'Account',
    login: locale === 'id' ? 'Masuk' : 'Login',
    register: locale === 'id' ? 'Daftar' : 'Register',
    logout: locale === 'id' ? 'Keluar' : 'Logout',
    support: locale === 'id' ? 'Bantuan' : 'Get help',
    primary: locale === 'id' ? 'Jalur utama' : 'Main paths',
    accountTools: locale === 'id' ? 'Akun & aktivitas' : 'Account and activity',
  } as const;

  const desktopMenuItems = useMemo<NavItem[]>(
    () => [
      {
        href: '/search',
        label: text.search,
        icon: SearchIcon,
        matchers: [
          '/search',
          '/jobs',
          '/freelancers',
          '/marketplace',
          '/property',
          '/microgigs',
        ],
      },
      {
        href: mapHref,
        label: text.mapLong,
        icon: MapPinned,
        matchers: ['/umkm', '/toko', '/super-app'],
      },
    ],
    [mapHref, text.mapLong, text.search],
  );

  const coreDrawerItems = useMemo(
    () => buildPrimaryNavItems(isAuthenticated, localeKey),
    [isAuthenticated, localeKey],
  );
  const coreDrawerLinks = useMemo(
    () => coreDrawerItems.filter(item => item.key !== 'account'),
    [coreDrawerItems],
  );
  const coreDrawerActiveKey = resolveActivePrimaryNavKey(
    coreDrawerItems,
    pathname,
  );

  const accountDrawerItems = useMemo<DrawerItem[]>(
    () =>
      isAuthenticated
        ? [
            {
              href: '/my-listings',
              label: localeKey === 'id' ? 'Listing Saya' : 'My Listings',
              icon: ShoppingBag,
              matchers: ['/my-listings'],
            },
            {
              href: '/payments',
              label:
                localeKey === 'id' ? 'Saldo & Top Up' : 'Balance and Top-ups',
              icon: Wallet,
              matchers: ['/payments'],
            },
            {
              href: manageHref,
              label: text.manage,
              icon: MapPinned,
              matchers: ['/usaha', LEGACY_UMKM_OWNER_PATH],
            },
            {
              href: '/transactions',
              label: localeKey === 'id' ? 'Transaksi' : 'Transactions',
              icon: Store,
              matchers: ['/transactions'],
            },
            {
              href: '/settings',
              label: localeKey === 'id' ? 'Pengaturan' : 'Settings',
              icon: Settings,
              matchers: ['/settings'],
            },
          ]
        : [],
    [isAuthenticated, localeKey, manageHref, text.manage],
  );

  const closeAll = () => {
    setProfileOpen(false);
    setMobileOpen(false);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        profileOpen &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileOpen(false);
      setMobileOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

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

  const mobileDrawerLayer =
    typeof document !== 'undefined' && mobileOpen
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close mobile menu overlay"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[85] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_45%,_transparent)] backdrop-blur-sm lg:hidden"
            />
            <aside className="fixed right-0 top-0 z-[86] flex h-[100dvh] w-[min(88vw,360px)] flex-col border-l border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] shadow-2xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] lg:hidden">
              <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] px-4 py-4 dark:border-[color:var(--app-border-strong)]">
                <div>
                  <p className="text-sm font-black text-[color:var(--app-text)]">{text.brand}</p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {text.brandHint}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="ui-pressable inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="ui-panel-muted rounded-[24px] border border-[color:var(--app-border)]/80 p-3">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-3">
                      <Image
                        src={user?.avatarUrl || '/default-avatar.svg'}
                        alt="Profile avatar"
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                          {user?.username || user?.fullName || 'User'}
                        </p>
                        <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                          {user?.email || '-'}
                        </p>
                      </div>
                      <Link
                        href={accountHref}
                        onClick={closeAll}
                        className="ui-inline-meta ui-accent-border ui-accent-text"
                      >
                        {text.account}
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--app-text)]">
                        {text.account}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Masuk biar chat, draft, dan transaksi di Lajukan tetap nyambung.'
                          : 'Sign in so your chats, drafts, and transactions stay in sync.'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link
                          href="/login"
                          onClick={closeAll}
                          className="ui-pressable inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold text-[color:var(--app-text)]"
                        >
                          {text.login}
                        </Link>
                        <Link
                          href="/register"
                          onClick={closeAll}
                          className="ui-pressable inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] px-3 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                        >
                          {text.register}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {isAuthenticated ? (
                  <WalletHeaderShortcut
                    locale={locale}
                    variant="drawer"
                    onNavigate={closeAll}
                  />
                ) : null}

                <div>
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    {text.primary}
                  </p>
                  <div className="mt-2 space-y-2">
                    {coreDrawerLinks.map(item => {
                      const Icon = item.icon;
                      const active = coreDrawerActiveKey === item.key;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={closeAll}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'ui-pressable ui-pressable-card flex min-h-[48px] items-center gap-3 rounded-2xl border px-3 py-2 transition',
                            active
                              ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
                          )}
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {item.label}
                          </span>
                          <ChevronRight className="h-4 w-4 opacity-70" />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {accountDrawerItems.length > 0 ? (
                  <div>
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      {text.accountTools}
                    </p>
                    <div className="mt-2 space-y-2">
                      {accountDrawerItems.map(item => {
                        const Icon = item.icon;
                        const active =
                          item.matchers?.some(matcher =>
                            matchesRoute(cleanPath, matcher),
                          ) ?? false;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeAll}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'ui-pressable ui-pressable-card flex min-h-[46px] items-center gap-3 rounded-2xl border px-3 py-2 transition',
                              active
                                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]',
                            )}
                          >
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {item.label}
                            </span>
                            <ChevronRight className="h-4 w-4 opacity-70" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] p-4 dark:border-[color:var(--app-border-strong)]">
                <div className="flex items-center gap-2">
                  <LanguageSwitcherButton />
                  <ThemeToggle />
                </div>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      setMobileOpen(false);
                    }}
                    className="ui-pressable mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 text-sm font-semibold text-[color:var(--app-danger)]"
                  >
                    {text.logout}
                  </button>
                ) : (
                  <Link
                    href="/support"
                    onClick={closeAll}
                    className="ui-pressable mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold text-[color:var(--app-text)]"
                  >
                    {text.support}
                  </Link>
                )}
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
        className="fixed inset-x-0 top-0 z-[90] border-b border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-strong)] sm:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_82%,_transparent)] sm:backdrop-blur-xl dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_82%,_transparent)]"
        data-tour="www-header"
      >
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <div className="page-shell page-shell-inset flex h-14 items-center gap-2 sm:h-16">
          <Link
            href="/home"
            className="ui-pressable inline-flex shrink-0 items-center gap-2.5"
            onClick={closeAll}
          >
            <span className="inline-flex max-w-[128px] select-none sm:max-w-[150px]">
              <LajuloLogo />
            </span>
            <span className="hidden min-w-0 xl:flex xl:flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {text.brand}
              </span>
              <span className="max-w-[220px] truncate text-[11px] font-medium text-[color:var(--app-text-soft)]">
                {text.brandHint}
              </span>
            </span>
          </Link>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <nav className="flex items-center gap-1">
              {desktopMenuItems.map(item => {
                const Icon = item.icon;
                const active =
                  item.matchers.some(matcher => matchesRoute(cleanPath, matcher)) &&
                  !(
                    item.href === mapHref &&
                    (matchesRoute(cleanPath, '/usaha') ||
                      matchesRoute(cleanPath, LEGACY_UMKM_OWNER_PATH))
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeAll}
                    className="ui-nav-pill text-sm font-semibold"
                    data-active={active ? 'true' : 'false'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {isAuthenticated ? (
              <>
                <WalletHeaderShortcut locale={locale} />

                <Link
                  href="/chat"
                  onClick={closeAll}
                  className={cn(
                    'ui-pressable relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
                    matchesRoute(cleanPath, '/chat')
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                  aria-label="Chat"
                >
                  <MessageCircle className="h-4 w-4" />
                  {totalUnread > 0 ? (
                    <span className="absolute right-0 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[9px] font-black text-[color:var(--app-text-inverse)]">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  ) : null}
                </Link>

                <Link
                  href="/notifications"
                  onClick={closeAll}
                  className={cn(
                    'ui-pressable relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
                    matchesRoute(cleanPath, '/notifications')
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                  aria-label={locale === 'id' ? 'Notifikasi' : 'Notifications'}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-0 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[9px] font-black text-[color:var(--app-text-inverse)]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </Link>
              </>
            ) : null}

            <Link
              href={createHref}
              className="ui-pressable inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[var(--app-shadow)]"
              onClick={closeAll}
              aria-label={text.createLong}
              data-tour="www-create"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,_var(--app-text-inverse)_14%,_transparent)]">
                <Plus className="h-4 w-4" />
              </span>
              <span>{text.create}</span>
            </Link>

            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(prev => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className={cn(
                    'ui-pressable inline-flex h-10 items-center gap-2 rounded-full border px-2 pr-3 transition',
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
                  <span className="max-w-[84px] truncate text-sm font-semibold">
                    {user?.username || user?.fullName || 'User'}
                  </span>
                </button>

                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-lg"
                  >
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                        {user?.username || user?.fullName || 'User'}
                      </p>
                      <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                        {user?.email || '-'}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      className="ui-pressable mt-1 flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                      onClick={() => setProfileOpen(false)}
                      role="menuitem"
                    >
                      {text.account}
                    </Link>
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
                'ui-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border transition sm:h-11 sm:w-11',
                matchesRoute(cleanPath, '/search')
                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]',
              )}
              onClick={closeAll}
              data-tour="www-search-mobile"
              aria-label={text.search}
            >
              <SearchIcon className="h-4 w-4" />
            </Link>

            <Link
              href={chatHref}
              onClick={closeAll}
              className={cn(
                'ui-pressable relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition sm:h-11 sm:w-11',
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
              className="ui-pressable inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] shadow-[var(--app-shadow)] sm:h-11 sm:w-11"
              aria-label={text.createLong}
              data-tour="www-create-mobile"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(prev => !prev)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="ui-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] sm:h-11 sm:w-11"
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
