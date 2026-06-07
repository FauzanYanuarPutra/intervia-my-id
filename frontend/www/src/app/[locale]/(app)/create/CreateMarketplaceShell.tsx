'use client';

import { type ReactNode } from 'react';
import {
  ClipboardList,
  FolderKanban,
  Home,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Store,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { resolveMarketplaceCreatePath } from '@/lib/createRoutes';
import { cn } from '@/lib/utils';
import { buildCreateBasePath } from './createPageUtils';

type CreateMarketplaceShellProps = {
  children: ReactNode;
};

type CreateNavItem = {
  href: string;
  label: string;
  caption: string;
  icon: LucideIcon;
};

function normalizeCreatePathname(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return withoutLocale === '' ? '/' : withoutLocale;
}

function CreateDesktopSidebar({
  locale,
  pathname,
  isAuthenticated,
}: {
  locale: 'id' | 'en';
  pathname: string;
  isAuthenticated: boolean;
}) {
  const isId = locale === 'id';
  const currentPath = normalizeCreatePathname(pathname);
  const supplyCreateHref = buildCreateBasePath({
    locale,
    sideId: 'supply',
  });
  const demandCreateHref = buildCreateBasePath({
    locale,
    sideId: 'demand',
  });
  const primaryItems: CreateNavItem[] = [
    {
      href: '/home',
      label: isId ? 'Beranda' : 'Home',
      caption: isId ? 'Kembali ke market' : 'Back to market',
      icon: Home,
    },
    {
      href: '/create',
      label: isId ? 'Mulai Buat' : 'Start Create',
      caption: isId ? 'Tawarkan atau cari' : 'Choose offer or need',
      icon: Plus,
    },
    {
      href: supplyCreateHref,
      label: isId ? 'Tawarkan' : 'Offer',
      caption: isId ? 'Produk, jasa, lokasi' : 'Products, services, spaces',
      icon: ClipboardList,
    },
    {
      href: demandCreateHref,
      label: isId ? 'Cari Kebutuhan' : 'Need Something',
      caption: isId
        ? 'Supplier, jasa, talent'
        : 'Find suppliers, services, talent',
      icon: Target,
    },
    {
      href: '/my-listings',
      label: isId ? 'Posting Saya' : 'My posts',
      caption: isId ? 'Posting, favorit, riwayat' : 'Posts, saved, history',
      icon: FolderKanban,
    },
  ];
  const businessItems: CreateNavItem[] = [
    {
      href: resolveMarketplaceCreatePath(locale, 'company', 'supply'),
      label: isId ? 'Profil Usaha' : 'Business profile',
      caption: isId ? 'Profil usaha' : 'Business profile',
      icon: Store,
    },
    {
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'product',
      }),
      label: isId ? 'Produk' : 'Products',
      caption: isId ? 'Stok, harga, foto' : 'Stock, price, photos',
      icon: Package,
    },
    {
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'service',
      }),
      label: isId ? 'Jasa' : 'Services',
      caption: isId ? 'Paket dan layanan' : 'Packages and services',
      icon: Wrench,
    },
    {
      href: resolveMarketplaceCreatePath(locale, 'talent', 'supply'),
      label: isId ? 'Talent' : 'Talent',
      caption: isId
        ? 'Skill, level, verifikasi'
        : 'Skills, level, verification',
      icon: Users,
    },
    {
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'property',
      }),
      label: isId ? 'Lokasi' : 'Spaces',
      caption: isId ? 'Ruko, booth, kios' : 'Shops and booths',
      icon: MapPin,
    },
  ];
  const renderNavItem = (item: CreateNavItem) => {
    const itemPath = item.href.split('?')[0];
    const active =
      itemPath === supplyCreateHref
        ? currentPath === supplyCreateHref ||
          currentPath.startsWith(`${supplyCreateHref}/`)
        : itemPath === demandCreateHref
          ? currentPath === demandCreateHref ||
            currentPath.startsWith(`${demandCreateHref}/`)
          : itemPath === '/create'
            ? currentPath === '/create'
            : currentPath === itemPath ||
              currentPath.startsWith(`${itemPath}/`);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-[44px] items-center gap-2.5 rounded-[12px] border px-2.5 py-2 transition',
          active
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_12px_24px_-22px_rgba(22,163,74,0.42)]'
            : 'border-transparent text-[color:var(--app-text-soft)] hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
        )}
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]',
            active
              ? 'bg-white text-emerald-600'
              : 'bg-slate-50 text-[color:var(--app-text-soft)]',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">
            {item.label}
          </span>
          <span className="mt-0.5 block truncate text-[10px] leading-4 text-[color:var(--app-text-soft)]">
            {item.caption}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:block lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div
        className="flex h-full max-h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6 pr-1"
        data-auto-scrollbar
      >
        <nav className="shrink-0 rounded-[22px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.14)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="px-2 py-1.5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Menu utama' : 'Main menu'}
            </p>
          </div>
          <div className="space-y-1">{primaryItems.map(renderNavItem)}</div>
          <div className="my-2 h-px bg-[color:var(--app-border)]" />
          <div className="px-2 py-1">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Kelola usaha' : 'Business tools'}
            </p>
          </div>
          <div className="space-y-1">{businessItems.map(renderNavItem)}</div>
          <Link
            href="/create"
            aria-current={currentPath === '/create' ? 'page' : undefined}
            className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[12px] border border-[color:var(--app-accent-border)] bg-white px-3 text-xs font-semibold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)] dark:bg-slate-950/50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isId ? 'Buat posting baru' : 'Create new post'}
          </Link>
        </nav>
        <div className="m-2 shrink-0 overflow-hidden rounded-[18px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fff9_0%,#ffffff_100%)] p-3 text-emerald-800 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.22)] dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white/90">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[0.92rem] font-black tracking-[-0.03em]">
                {isId ? 'Bingung mulai?' : 'Not sure where to start?'}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-emerald-800/78 dark:text-emerald-100/78">
                {isId
                  ? 'Pilih Tawarkan kalau Anda menyediakan sesuatu. Pilih Cari Kebutuhan kalau sedang mencari vendor.'
                  : 'Choose Want to Sell when offering. Choose Need Something when looking.'}
              </p>
            </div>
          </div>
        </div>
        {!isAuthenticated ? (
          <Link
            href="/register"
            className="mt-3 inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-xs font-semibold text-[color:var(--app-text-inverse)]"
          >
            {isId ? 'Daftar gratis' : 'Create account'}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

export function CreateMarketplaceShell({
  children,
}: CreateMarketplaceShellProps) {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  return (
    <div className="lajukan-home-compact lajukan-market-page lajukan-market-create lajukan-create-compact relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] sm:px-2 lg:h-[calc(100svh-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="lajukan-home-shell lajukan-create-shell relative mx-auto lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
        <div className="lajukan-home-desktop-grid lajukan-create-desktop-grid relative z-0 mx-auto grid min-h-0 w-full max-w-[1540px] flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)] 2xl:grid-cols-[244px_minmax(0,1fr)]">
          <CreateDesktopSidebar
            locale={locale}
            pathname={pathname || '/create'}
            isAuthenticated={isAuthenticated}
          />
          <main
            className="min-w-0 pt-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:overscroll-contain"
            data-auto-scrollbar
          >
            <div className="space-y-3 pb-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default CreateMarketplaceShell;
