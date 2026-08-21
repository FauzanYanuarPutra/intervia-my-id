'use client';

import { ChevronLeft, Share2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { cn } from '@/lib/utils';

type DetailMobileTopBarProps = {
  title: string;
  eyebrow?: string;
  onShare?: () => void;
  shareLabel?: string;
  backLabel?: string;
  className?: string;
};

export function DetailMobileTopBar({
  title,
  eyebrow,
  onShare,
  shareLabel = 'Share',
  backLabel = 'Back',
  className,
}: DetailMobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fallbackHomePath = pathname?.startsWith('/en') ? '/en/home' : '/id/home';
  const handleBack = useAppBack(router, fallbackHomePath);

  return (
    <>
      <header
        className={cn(
          'ui-layer-mobile-topbar fixed inset-x-0 top-0 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2.5 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] shadow-[0_14px_28px_-26px_rgba(15,23,42,0.26)]  lg:hidden dark:border-[color:var(--app-border-strong)]',
          className,
        )}
      >
        <div className="mx-auto grid min-h-[40px] max-w-[720px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
            aria-label={backLabel}
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

          {onShare ? (
            <button
              type="button"
              onClick={onShare}
              className="ui-pressable inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-sm active:scale-95 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950 dark:text-white"
              aria-label={shareLabel}
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
          ) : (
            <span aria-hidden className="h-10 w-10" />
          )}
        </div>
      </header>
      <div
        aria-hidden="true"
        className="h-[calc(1rem+env(safe-area-inset-top))] lg:hidden"
      />
    </>
  );
}
