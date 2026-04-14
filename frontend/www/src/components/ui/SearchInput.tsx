'use client';

import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type SearchInputProps = {
  placeholder?: string;
  className?: string;
  compact?: boolean;
  showSubmitButton?: boolean;
};

export function SearchInput({
  placeholder,
  className,
  compact = false,
  showSubmitButton = true,
}: SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(clean)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'flex items-center gap-1 rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-1.5 shadow-sm shadow-[var(--app-shadow)] backdrop-blur dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)]',
        className,
      )}
      role="search"
      aria-label="Global search"
    >
      <label className="relative block min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
        <input
          aria-label="Search input"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={placeholder || 'Cari produk, jasa, atau lowongan'}
          className={cn(
            'w-full appearance-none rounded-xl border-0 bg-transparent pl-9 pr-2 text-sm font-medium text-[color:var(--app-text)] shadow-none outline-none ring-0 placeholder:text-[color:var(--app-text-soft)] focus:border-0 focus:outline-none focus:ring-0 dark:text-[color:var(--app-text-soft)] dark:placeholder:text-[color:var(--app-text)]',
            compact ? 'min-h-[44px]' : 'min-h-[44px]',
          )}
        />
      </label>
      <button
        type="submit"
        aria-label="Submit search"
        className={cn(
          'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--app-accent)] text-xs font-semibold text-[color:var(--app-text-inverse)] shadow-sm shadow-[var(--app-shadow)] hover:bg-[color:var(--app-accent-strong)] dark:bg-[color:var(--app-accent)] dark:hover:bg-[color:var(--app-accent)]',
          showSubmitButton ? 'px-3' : 'min-w-[44px] px-2',
        )}
      >
        {showSubmitButton ? 'Search' : <Search className="h-4 w-4" />}
      </button>
    </form>
  );
}
