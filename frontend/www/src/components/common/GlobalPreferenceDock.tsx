'use client';

import { Languages, Moon, Settings2, Sun, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguageModal } from '@/components/modal/LanguageModal/LanguageModalContext';
import { useTheme } from '@/context/ThemeContext';
import { getPageMeta } from '@/config/pageMeta';
import { cn } from '@/lib/utils';

function normalizePathname(pathname: string) {
  const clean = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

export function GlobalPreferenceDock() {
  const pathname = usePathname();
  const { isDark, isReady, setColorScheme } = useTheme();
  const { open, currentLocale } = useLanguageModal();
  const [isOpen, setIsOpen] = useState(false);
  const cleanPath = normalizePathname(pathname || '/');
  const routeMeta = getPageMeta(pathname || '/');

  if (cleanPath === '/home' || cleanPath === '/' || routeMeta.immersive) {
    return null;
  }

  const toggleTheme = () => {
    setColorScheme(isDark ? 'light' : 'dark');
  };

  const openLanguage = () => {
    setIsOpen(false);
    open();
  };

  return (
    <>
      <div className="ui-layer-sticky pointer-events-none fixed right-0 top-1/2 z-[1250] hidden -translate-y-1/2 md:flex">
        <div
          className={cn(
            'pointer-events-auto mr-2 w-[min(82vw,238px)] origin-right rounded-[22px] border border-[color:var(--app-border)]',
            'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2.5 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
            'transition duration-200',
            isOpen
              ? 'translate-x-0 scale-100 opacity-100'
              : 'translate-x-4 scale-95 opacity-0 pointer-events-none',
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                Preferences
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
              aria-label="Close preferences"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              disabled={!isReady}
              className={cn(
                'inline-flex h-10 w-full items-center justify-between rounded-full border px-3 text-xs font-black uppercase tracking-[0.08em] transition',
                'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] disabled:opacity-50',
              )}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              <span className="inline-flex items-center gap-2">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>
            <button
              type="button"
              onClick={openLanguage}
              className={cn(
                'inline-flex h-10 w-full items-center justify-between rounded-full border px-3 text-xs font-black uppercase tracking-[0.08em] transition',
                'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
              )}
              aria-label="Change language"
              title="Language"
            >
              <span className="inline-flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {currentLocale?.toUpperCase() || 'ID'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                Language
              </span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(value => !value)}
          className={cn(
            'pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-l-[18px] border border-r-0 border-[color:var(--app-border)]',
            'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] text-[color:var(--app-text)] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
            'transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
          )}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close preferences' : 'Open preferences'}
          title="Preferences"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        </button>
      </div>

      {/* <div className="ui-layer-sticky pointer-events-none fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+5.8rem)] z-[1250] md:hidden">
        <div
          className={cn(
            'mb-2 w-[min(84vw,250px)] origin-bottom-right rounded-[20px] border border-[color:var(--app-border)]',
            'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
            'transition duration-200',
            isOpen
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-2 scale-95 opacity-0',
          )}
        >
          <div className="grid gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              disabled={!isReady}
              className={cn(
                'inline-flex h-10 w-full items-center justify-between rounded-full border px-3 text-xs font-black uppercase tracking-[0.08em] transition',
                'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] disabled:opacity-50',
              )}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              <span className="inline-flex items-center gap-2">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>
            <button
              type="button"
              onClick={openLanguage}
              className={cn(
                'inline-flex h-10 w-full items-center justify-between rounded-full border px-3 text-xs font-black uppercase tracking-[0.08em] transition',
                'border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
              )}
              aria-label="Change language"
              title="Language"
            >
              <span className="inline-flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {currentLocale?.toUpperCase() || 'ID'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                Language
              </span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(value => !value)}
          className={cn(
            'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--app-border)]',
            'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] text-[color:var(--app-text)] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
            'transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
          )}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close preferences' : 'Open preferences'}
          title="Preferences"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        </button>
      </div> */}
    </>
  );
}
