'use client';

import { Icon, IconEnum } from '@/components/ui-kit';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggleDarkMode, isReady } = useTheme();

  if (!isReady) return null;

  return (
    <button
      onClick={toggleDarkMode}
      aria-label="Toggle Dark Mode"
      className={cn(
        'inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.42)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]',
        className,
      )}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Icon
          name={IconEnum.Sun}
          className="h-4.5 w-4.5 text-[color:var(--app-warning)]"
        />
      ) : (
        <Icon
          name={IconEnum.Moon}
          className="h-4.5 w-4.5 text-[color:var(--app-accent)]"
        />
      )}
    </button>
  );
}
