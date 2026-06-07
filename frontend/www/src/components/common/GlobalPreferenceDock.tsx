'use client';

import { Languages, Moon, Settings2, Sun, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguageModal } from '@/components/modal/LanguageModal/LanguageModalContext';
import { useTheme } from '@/context/ThemeContext';
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

  if (cleanPath === '/home' || cleanPath === '/') {
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
    <div className="ui-layer-sticky pointer-events-none fixed right-3 flex flex-col items-end gap-2 bottom-[calc(env(safe-area-inset-bottom)+5.8rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5.8rem)] md:right-5 lg:bottom-5">
      <div
        className={cn(
          'flex origin-bottom-right items-center gap-1.5 rounded-full border border-[color:var(--app-border)]',
          'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-1.5 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
          'transition duration-200 md:translate-y-0 md:scale-100 md:opacity-100',
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-95 opacity-0 md:pointer-events-auto',
        )}
      >
        <button
          type="button"
          onClick={toggleTheme}
          disabled={!isReady}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--app-text)] transition',
            'hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] disabled:opacity-50',
          )}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={openLanguage}
          className={cn(
            'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 text-xs font-black uppercase tracking-[0.08em]',
            'text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
          )}
          aria-label="Change language"
          title="Language"
        >
          <Languages className="h-4 w-4" />
          {currentLocale?.toUpperCase() || 'ID'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(value => !value)}
        className={cn(
          'pointer-events-auto inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-[color:var(--app-border)]',
          'bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] px-3 text-[color:var(--app-text)] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl',
          'transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)] md:hidden',
        )}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close preferences' : 'Open preferences'}
        title="Preferences"
      >
        {isOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        <span className="ml-1.5 text-xs font-black uppercase tracking-[0.08em]">
          {currentLocale?.toUpperCase() || 'ID'}
        </span>
      </button>
    </div>
  );
}
