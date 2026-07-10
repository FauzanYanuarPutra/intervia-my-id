'use client';

import { ChevronLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ClientBottomNav from '@/components/layout/ClientBottomNav';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAppBack } from '@/lib/navigation/useAppBack';

type LocaleCode = 'id' | 'en';

export type MobileRouteChromeConfig = {
  showTopBar: boolean;
  showBottomNav: boolean;
  title: string;
  eyebrow?: string;
};

function MobileRouteTopBar({
  title,
  eyebrow,
  locale,
}: {
  title: string;
  eyebrow?: string;
  locale: string;
}) {
  const router = useRouter();
  const isId = locale === 'id';
  const handleBack = useAppBack(router, `/${isId ? 'id' : 'en'}/home`);

  return (
    <header className="lajukan-mobile-topbar ui-layer-mobile-topbar fixed inset-x-0 top-0 border-x-0 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1 pt-[calc(env(safe-area-inset-top)+0.25rem)] shadow-[0_10px_24px_-24px_rgba(15,23,42,0.22)]  lg:hidden dark:border-[color:var(--app-border-strong)]">
      <div className="mx-auto grid min-h-[36px] max-w-[720px] grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-1.5">
        <button
          type="button"
          onClick={handleBack}
          className="ui-pressable inline-flex h-[38px] min-h-[38px] w-[38px] min-w-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
          aria-label={isId ? 'Kembali' : 'Back'}
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>

        <div className="min-w-0 text-center">
          {eyebrow ? (
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <p className="truncate text-sm font-bold text-[color:var(--app-text)] dark:text-white">
            {title}
          </p>
        </div>

        <Link
          href="/home"
          className="ui-pressable inline-flex h-[38px] min-h-[38px] w-[38px] min-w-[38px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
          aria-label={isId ? 'Ke beranda' : 'Go home'}
        >
          <Home className="h-4.5 w-4.5" />
        </Link>
      </div>
    </header>
  );
}

export function MobileRouteChrome({
  config,
  locale,
}: {
  config: MobileRouteChromeConfig;
  locale: string;
}) {
  return (
    <>
      {config.showTopBar ? (
        <MobileRouteTopBar
          title={config.title}
          eyebrow={config.eyebrow}
          locale={locale}
        />
      ) : null}

      {config.showBottomNav ? <ClientBottomNav /> : null}
    </>
  );
}
