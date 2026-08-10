'use client';

import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  Clapperboard,
  Compass,
  Home,
  MessageCircle,
  Plus,
  SquarePen,
  Store,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { useRouteLayout } from '@/lib/useRouteLayout';
import { cn } from '@/lib/utils';

type MobileNavItem = {
  key: 'home' | 'explore' | 'chat' | 'profile';
  label: string;
  href: string;
  icon: LucideIcon;
  matchers: string[];
};

type CreateAction = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

function normalizePathname(pathname: string | null) {
  const cleanPath = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '');
  return cleanPath || '/';
}

function matchesRoute(pathname: string, matcher: string) {
  const exact = matcher.endsWith('$');
  const route = exact ? matcher.slice(0, -1) || '/' : matcher;
  if (route === '/') return pathname === '/';
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

function authHref(href: string, isAuthenticated: boolean, locale: 'id' | 'en') {
  if (isAuthenticated) return href;
  return `/login?callbackUrl=${encodeURIComponent(`/${locale}${href}`)}`;
}

export default function ClientBottomNav() {
  const { pathname, showBottomNavMobile } = useRouteLayout();
  const locale = resolveLocaleFromPathname(pathname);
  const isId = locale === 'id';
  const { user, isAuthenticated } = useAuth();
  const { totalUnread } = useChatInbox();
  const [sheetOpen, setSheetOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const cleanPath = normalizePathname(pathname);
  const profileAvatar = profileAvatarSrc(
    user?.avatarUrl || user?.avatar_url,
    readProfileAvatarStyle(user),
    user?.fullName || user?.full_name || user?.username || 'Profile',
  );

  useBodyScrollLock(sheetOpen);

  const items = useMemo<MobileNavItem[]>(
    () => [
      {
        key: 'home',
        label: isId ? 'Beranda' : 'Home',
        href: '/home',
        icon: Home,
        matchers: ['/home', '/'],
      },
      {
        key: 'explore',
        label: isId ? 'Jelajahi' : 'Explore',
        href: '/explore',
        icon: Compass,
        matchers: ['/explore'],
      },
      {
        key: 'chat',
        label: 'Chat',
        href: authHref('/chat', isAuthenticated, locale),
        icon: MessageCircle,
        matchers: ['/chat'],
      },
      {
        key: 'profile',
        label: isId ? 'Akun' : 'Account',
        href: authHref('/profile', isAuthenticated, locale),
        icon: User,
        matchers: isAuthenticated
          ? [
              '/profile$',
              '/profile/edit',
              '/settings',
              '/dashboard',
              '/manage',
              '/my-listings',
              ...(PROMO_ONLY_MODE ? [] : ['/transactions', '/payments']),
            ]
          : ['/login', '/register'],
      },
    ],
    [isAuthenticated, isId, locale],
  );

  const createActions = useMemo<CreateAction[]>(
    () => [
      {
        key: 'offer',
        label: isId ? 'Tawarkan sesuatu' : 'Offer something',
        description: isId
          ? 'Produk, jasa, alat, tempat, atau peluang usaha.'
          : 'Products, services, tools, places, or opportunities.',
        href: authHref('/create?side=supply', isAuthenticated, locale),
        icon: SquarePen,
      },
      {
        key: 'need',
        label: isId ? 'Buat kebutuhan' : 'Post a need',
        description: isId
          ? 'Tulis apa yang dicari agar penyedia bisa merespons.'
          : 'Describe what you need so providers can respond.',
        href: authHref('/create?side=demand', isAuthenticated, locale),
        icon: SquarePen,
      },
      {
        key: 'business',
        label: isId ? 'Tambahkan usaha' : 'Add a business',
        description: isId
          ? 'Daftarkan profil dan lokasi usahamu.'
          : 'Register your business profile and location.',
        href: authHref('/usaha/onboarding', isAuthenticated, locale),
        icon: Store,
      },
      {
        key: 'community',
        label: isId ? 'Posting di komunitas' : 'Community post',
        description: isId
          ? 'Bagikan pertanyaan, kabar, atau pengalaman.'
          : 'Share a question, update, or experience.',
        href: authHref('/community?compose=post', isAuthenticated, locale),
        icon: Users,
      },
      {
        key: 'video',
        label: isId ? 'Unggah video' : 'Upload video',
        description: isId
          ? 'Bagikan tutorial atau cerita usahamu.'
          : 'Share a tutorial or your business story.',
        href: authHref('/community?compose=reel', isAuthenticated, locale),
        icon: Clapperboard,
      },
    ],
    [isAuthenticated, isId, locale],
  );

  const closeSheet = () => {
    setSheetOpen(false);
    window.setTimeout(() => createButtonRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!sheetOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.setTimeout(
      () => sheetRef.current?.querySelector<HTMLAnchorElement>('a')?.focus(),
      0,
    );
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sheetOpen]);

  if (!showBottomNavMobile) return null;

  const handleFocusTrap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusable = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(
        'a,button:not([disabled])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderItem = (item: MobileNavItem) => {
    const Icon = item.icon;
    const active = item.matchers.some(matcher =>
      matchesRoute(cleanPath, matcher),
    );
    const profile = item.key === 'profile';

    return (
      <li key={item.key} className="min-w-0">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          aria-label={active ? `${item.label} aktif` : item.label}
          onClick={() => {
            void trackLajukanEvent('bottom_nav_click', {
              properties: {
                locale,
                source: 'mobile_bottom_nav',
                route: cleanPath,
                contentType: item.key,
              },
            });
          }}
          className={cn(
            'ui-pressable relative z-10 flex min-h-[58px] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-1 text-[10.5px] font-bold leading-none transition',
            active
              ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
              : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]',
          )}
          data-testid={`mobile-nav-${item.key}`}
        >
          <span className="relative inline-flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
            {profile && isAuthenticated ? (
              <Image
                src={profileAvatar}
                alt={isId ? 'Foto profil' : 'Profile photo'}
                width={34}
                height={34}
                className="h-[31px] w-[31px] rounded-full object-contain"
                unoptimized={profileAvatar.startsWith('https://')}
              />
            ) : (
              <Icon className="h-[19px] w-[19px]" />
            )}
            {item.key === 'chat' && totalUnread > 0 ? (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
            ) : null}
          </span>
          <span className="max-w-full whitespace-nowrap px-0.5 text-center">
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav
        className="ui-layer-bottom-nav fixed inset-x-0 bottom-0 overflow-visible border-t border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_97%,transparent)] px-1.5 pt-2 shadow-[0_-10px_24px_-24px_rgba(15,23,42,0.28)] lg:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.35rem)' }}
        aria-label={
          isId ? 'Navigasi utama mobile' : 'Mobile primary navigation'
        }
        data-testid="mobile-bottom-nav"
        data-lajukan-mobile-nav="true"
      >
        <ul className="mx-auto grid w-full max-w-[720px] grid-cols-5 items-stretch gap-1">
          {items.slice(0, 2).map(renderItem)}
          <li className="min-w-0">
            <button
              ref={createButtonRef}
              type="button"
              onClick={() => {
                setSheetOpen(true);
                void trackLajukanEvent('create_menu_open', {
                  properties: {
                    locale,
                    source: 'mobile_bottom_nav',
                    route: cleanPath,
                  },
                });
              }}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="ui-pressable relative z-10 flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[16px] text-[10.5px] font-bold text-[color:var(--app-accent)]"
              data-testid="mobile-create-fab"
            >
              <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[15px] bg-[color:var(--app-accent)] text-white shadow-[0_14px_26px_-18px_rgba(22,163,74,0.86)]">
                <Plus className="h-5 w-5 stroke-[3]" />
              </span>
              <span>{isId ? 'Buat' : 'Create'}</span>
            </button>
          </li>
          {items.slice(2).map(renderItem)}
        </ul>
      </nav>

      {sheetOpen ? (
  <>
    {/* Backdrop */}
    <button
      type="button"
      aria-label={isId ? 'Tutup menu pembuatan' : 'Close create menu'}
      onClick={closeSheet}
      className="ui-layer-popover fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
    />

    {/* Bottom sheet */}
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-create-title"
      onKeyDown={handleFocusTrap}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        dragStartY.current = event.clientY;
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (dragStartY.current === null) return;

        const delta = event.clientY - dragStartY.current;
        dragStartY.current = null;

        if (delta > 64) closeSheet();
      }}
      className="ui-layer-drawer fixed inset-x-0 bottom-0 max-h-[min(88dvh,760px)] overflow-y-auto rounded-t-[28px] border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-30px_90px_-35px_rgba(15,23,42,0.55)] lg:hidden"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] px-4 pb-4 pt-2 backdrop-blur-xl">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-[color:var(--app-border-strong)]" />

        <div className="mx-auto mt-4 flex max-w-[680px] items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
              {isId ? 'Buat di Lajukan' : 'Create on Lajukan'}
            </p>

            <h2
              id="mobile-create-title"
              className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"
            >
              {isId ? 'Mau membuat apa?' : 'What do you want to create?'}
            </h2>

            <p className="mt-1 max-w-md text-sm leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Pilih sesuai kebutuhanmu. Kamu akan diarahkan ke formulir yang tepat.'
                : 'Choose what you need. We will take you to the right form.'}
            </p>
          </div>

          <button
            type="button"
            onClick={closeSheet}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
            aria-label={isId ? 'Tutup' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Action list */}
      <div className="mx-auto max-w-[680px] px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {createActions.map((action, index) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.key}
                href={action.href}
                onClick={closeSheet}
                className="group relative flex min-h-[92px] items-center gap-3 overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] hover:shadow-[0_16px_36px_-28px_rgba(16,185,129,0.7)] active:translate-y-0"
              >
                {/* Decorative background */}
                <span
                  aria-hidden="true"
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[color:var(--app-accent-soft)] opacity-0 transition group-hover:opacity-100"
                />

                {/* Icon */}
                <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] shadow-sm transition group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>

                {/* Content */}
                <span className="relative min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="block text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {action.label}
                    </span>

                    <span className="shrink-0 rounded-full bg-[color:var(--app-surface-strong)] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                      {isId ? 'Pilih' : 'Select'}
                    </span>
                  </span>

                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {action.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Helper */}
        <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-center">
          <p className="text-xs leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Belum yakin? Pilih yang paling mendekati. Informasinya masih bisa diubah nanti.'
              : 'Not sure? Choose the closest option. You can change the information later.'}
          </p>
        </div>
      </div>
    </div>
  </>
) : null}
    </>
  );
}
