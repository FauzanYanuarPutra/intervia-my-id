'use client';

import { Icon, IconEnum } from '@/components/ui-kit';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleDarkMode, isReady } = useTheme();

  if (!isReady) return null;

  return (
    <button
      onClick={toggleDarkMode}
      aria-label="Toggle Dark Mode"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Icon name={IconEnum.Sun} className="w-5 h-5 text-[color:var(--app-warning)]" />
      ) : (
        <Icon
          name={IconEnum.Moon}
          className="w-5 h-5 text-[color:var(--app-accent)]"
        />
      )}
    </button>
  );
}
