'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUp,
  CircleHelp,
  Compass,
  LayoutDashboard,
  MessageCircle,
  PlusSquare,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { buildUsahaPath } from '@/lib/umkmSurface';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type AssistAction = {
  href?: string;
  label: string;
  icon: typeof Compass;
  onClick?: () => void;
  primary?: boolean;
};

type AssistConfig = {
  title: string;
  description: string;
  actions: AssistAction[];
};

function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

export function PageAssistDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const locale = resolveLocaleFromPathname(pathname);
  const cleanPath = normalizePathname(pathname);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [open, setOpen] = useState(false);
  const [openingAdminChat, setOpeningAdminChat] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = () => {
      setCanGoBack(window.history.length > 1);
      setShowTop(window.scrollY > 420);
    };

    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [cleanPath]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const config = useMemo<AssistConfig>(() => {
    const isId = locale === 'id';
    const fallbackSearch: AssistAction = {
      href: '/search',
      label: isId ? 'Cari kebutuhan' : 'Search needs',
      icon: Compass,
    };
    const fallbackSupport: AssistAction = {
      href: '/support',
      label: isId ? 'Minta bantuan' : 'Get support',
      icon: CircleHelp,
    };

    if (cleanPath.startsWith('/create')) {
      return {
        title: isId ? 'Isi singkat dulu.' : 'Answer briefly, we will help clean it up.',
        description: isId
          ? 'Yang penting isi intinya. Kalau belum lengkap, simpan dulu.'
          : 'If it is not complete yet, save it first. It does not need to be perfect upfront.',
        actions: [
          {
            href: '/my-listings',
            label: isId ? 'Lihat draft' : 'See my drafts',
            icon: LayoutDashboard,
            primary: true,
          },
          fallbackSupport,
        ],
      };
    }

    if (cleanPath.startsWith('/search')) {
      return {
        title: isId ? 'Cari yang dekat dulu.' : 'Start from the closest results first.',
        description: isId
          ? 'Pilih yang jelas, mudah dihubungi, dan paling masuk akal dulu.'
          : 'Search first, then narrow it down only if needed.',
        actions: [
          user
            ? {
                href: '/create?mode=quick',
                label: isId ? 'Posting kebutuhan' : 'Post a need',
                icon: PlusSquare,
                primary: true,
              }
            : {
                href: '/register',
                label: isId ? 'Daftar gratis' : 'Start free',
                icon: ShieldCheck,
                primary: true,
              },
          fallbackSupport,
          ...(user
            ? [
                {
                  href: '/dashboard',
                  label: isId ? 'Lihat yang aktif' : 'See today tasks',
                  icon: LayoutDashboard,
                },
              ]
            : []),
        ],
      };
    }

    if (
      cleanPath.startsWith('/dashboard') ||
      cleanPath.startsWith('/transactions') ||
      cleanPath.startsWith('/usaha')
    ) {
      return {
        title: isId ? 'Lanjut yang paling dekat hasilnya.' : 'Today, continue what is closest to results.',
        description: isId
          ? 'Balas chat, cek transaksi, atau bikin posting baru.'
          : 'Reply to chats, check transactions, or post a new offer.',
        actions: [
          {
            href: '/create?mode=quick',
            label: isId ? 'Posting cepat' : 'Post quickly',
            icon: PlusSquare,
            primary: true,
          },
          fallbackSearch,
        ],
      };
    }

    if (cleanPath.startsWith('/profile') && user) {
      return {
        title: isId ? 'Rapikan satu area dulu.' : 'Tidy one area at a time.',
        description: isId
          ? 'Profil, listing, dan usaha tetap bisa dibuka cepat dari sini.'
          : 'Profile, listings, and business tools stay one tap away here.',
        actions: [
          {
            href: '/my-listings',
            label: isId ? 'Listing Saya' : 'My Listings',
            icon: ShoppingBag,
            primary: true,
          },
          {
            href: buildUsahaPath('home'),
            label: isId ? 'Usaha Saya' : 'My Business',
            icon: Store,
          },
          {
            href: '/profile',
            label: isId ? 'Lihat profil' : 'View profile',
            icon: LayoutDashboard,
          },
        ],
      };
    }

    if (cleanPath.startsWith('/support') || cleanPath.startsWith('/help')) {
      return {
        title: isId ? 'Bantuan dibuat singkat.' : 'Support kept concise',
        description: isId ? 'Pilih masalah yang paling mirip dulu.' : 'Search or go back.',
        actions: [fallbackSearch],
      };
    }

    return {
      title: isId ? 'Mau mulai dari mana dulu?' : 'Where do you want to start?',
      description: isId
        ? 'Cari, posting, atau minta bantuan.'
        : 'Search needs, post an offer, or ask for human help.',
      actions: [
        user
          ? {
              href: '/create?mode=quick',
              label: isId ? 'Posting cepat' : 'Post quickly',
              icon: PlusSquare,
              primary: true,
            }
          : {
              href: '/register',
              label: isId ? 'Daftar gratis' : 'Start free',
              icon: ShieldCheck,
              primary: true,
            },
        ...(user
          ? [
              {
                href: '/dashboard',
                label: isId ? 'Yang aktif' : 'Today tasks',
                icon: LayoutDashboard,
              },
            ]
          : []),
        fallbackSearch,
        fallbackSupport,
      ],
    };
  }, [cleanPath, locale, user]);

  const handleBack = useAppBack(router, '/home');

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAdminChat = async () => {
    if (openingAdminChat) return;

    if (!user?.id) {
      router.push('/support');
      return;
    }

    setOpeningAdminChat(true);
    setOpen(false);

    try {
      await authFetch('/api/chat/support-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: 'support:agent',
          room_name: 'Human Support',
          member_ids: [user.id],
        }),
      }).catch(() => null);

      router.push(`/chat/${encodeURIComponent('support:agent')}`);
    } finally {
      setOpeningAdminChat(false);
    }
  };

  const showAdminChatLauncher =
    !cleanPath.startsWith('/chat') && !cleanPath.startsWith('/support');
  const panelActions =
    showAdminChatLauncher && user
      ? [
          ...config.actions,
          {
            label: locale === 'id' ? 'Chat admin' : 'Chat admin',
            icon: MessageCircle,
            onClick: () => {
              void openAdminChat();
            },
          },
        ]
      : config.actions;
  const primaryAction =
    panelActions.find(action => action.primary) ?? panelActions[0] ?? null;
  const secondaryActions = panelActions.filter(action => action !== primaryAction);

  if (cleanPath === '/' || cleanPath.startsWith('/home') || cleanPath.startsWith('/search')) {
    return null;
  }

  const renderAction = (action: AssistAction, compact = false) => {
    const Icon = action.icon;
    const className = action.primary
      ? compact
        ? 'ui-button-primary inline-flex w-full min-w-0 items-center justify-center gap-2 px-4 py-3 text-xs font-semibold'
        : 'ui-button-primary inline-flex min-w-0 items-center gap-2 px-3 text-xs'
      : compact
        ? 'ui-shell-button inline-flex min-w-0 items-center gap-2 px-3 py-2 text-[11px] font-semibold'
        : 'ui-shell-button inline-flex min-w-0 items-center gap-2 px-3 text-xs font-semibold';

    const handleClick = () => {
      action.onClick?.();
      setOpen(false);
    };

    if (action.href) {
      return (
        <Link
          key={action.label}
          href={action.href}
          className={className}
          onClick={() => setOpen(false)}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{action.label}</span>
        </Link>
      );
    }

    return (
      <button
        key={action.label}
        type="button"
        onClick={handleClick}
        className={className}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{action.label}</span>
      </button>
    );
  };

  return (
    <aside
      className="ui-layer-sticky pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-[max(env(safe-area-inset-right),1.25rem)] hidden items-end justify-end lg:flex"
      style={{
        maxWidth: 'calc(100vw - 1rem)',
      }}
    >
      <div className="pointer-events-none relative flex flex-col items-end gap-2">
        <div className="pointer-events-none relative flex flex-col items-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={locale === 'id' ? 'Buka bantuan cepat' : 'Open quick help'}
            aria-expanded={open}
            aria-controls="page-assist-dock-panel"
            className={cn(
              'group pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--app-accent-border)] bg-[radial-gradient(circle_at_30%_30%,color-mix(in_srgb,var(--app-accent-soft)_92%,white_8%),color-mix(in_srgb,var(--app-accent)_82%,var(--app-surface-strong)_18%))] text-[color:var(--app-accent)] shadow-[0_18px_44px_color-mix(in_srgb,var(--app-accent)_26%,transparent)] transition-all duration-300 ease-out motion-reduce:transition-none sm:h-[52px] sm:w-[52px]',
              open
                ? 'pointer-events-none translate-y-4 scale-75 opacity-0'
                : 'translate-y-0 scale-100 opacity-100 hover:-translate-y-1 hover:scale-105'
            )}
          >
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--app-accent-soft)_78%,transparent),transparent_72%)] opacity-80" />
            <span className="absolute inset-[5px] rounded-full border border-white/50 opacity-70" />
            <CircleHelp className="relative h-5 w-5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-12 sm:h-[22px] sm:w-[22px]" />
          </button>

          <div
            id="page-assist-dock-panel"
            aria-hidden={!open}
            className={cn(
              'absolute bottom-full right-0 mb-3 origin-bottom-right transition-all duration-300 ease-out motion-reduce:transition-none',
              open
                ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none invisible translate-y-6 scale-[0.78] opacity-0'
            )}
          >
            <div className="ui-assist-dock relative w-[min(86vw,320px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-accent-border)_70%,var(--app-border)_30%)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%),color-mix(in_srgb,var(--app-accent-soft)_28%,var(--app-surface-strong)_72%))] px-4 py-4 shadow-[0_26px_80px_color-mix(in_srgb,var(--app-accent)_16%,transparent)] sm:w-[min(88vw,340px)] sm:rounded-[28px]">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--app-accent-soft)_62%,transparent),transparent_72%)] blur-2xl" />

              <div className="relative flex items-start gap-3">
                <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-accent-border)_76%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-accent-soft)_92%,white_8%),color-mix(in_srgb,var(--app-surface-strong)_88%,var(--app-accent-soft)_12%))] text-[color:var(--app-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:h-11 sm:w-11">
                  <CircleHelp className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {locale === 'id' ? 'Bantuan cepat' : 'Quick help'}
                  </p>
                  <h2 className="mt-2 text-sm font-black leading-tight tracking-[-0.03em] text-[color:var(--app-text)] sm:text-base">
                    {config.title}
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                    {config.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ui-shell-button h-9 w-9 shrink-0 rounded-full px-0"
                  aria-label={locale === 'id' ? 'Tutup bantuan cepat' : 'Close quick help'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative mt-4 rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-accent-border)_40%,var(--app-border)_60%)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_84%,white_16%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                {primaryAction ? (
                  <div className="min-w-0">{renderAction(primaryAction, true)}</div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {secondaryActions.map(action => renderAction(action))}
                  {canGoBack ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="ui-shell-button px-3 text-xs font-semibold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {locale === 'id' ? 'Kembali' : 'Back'}
                    </button>
                  ) : null}
                  {showTop ? (
                    <button
                      type="button"
                      onClick={scrollToTop}
                      className="ui-shell-button px-3 text-xs font-semibold"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      {locale === 'id' ? 'Ke atas' : 'Top'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
