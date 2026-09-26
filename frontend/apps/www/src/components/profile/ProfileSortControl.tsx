'use client';

import { Settings2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ProfileSortMode = 'newest' | 'most_viewed' | 'oldest';

type ProfileSortControlProps = {
  value: ProfileSortMode;
  onChange: (value: ProfileSortMode) => void;
  isId: boolean;
};

export function ProfileSortControl({
  value,
  onChange,
  isId,
}: ProfileSortControlProps) {
  return (
    <label className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-[color:var(--app-text)] transition hover:bg-emerald-50 dark:bg-white/5 dark:text-[color:var(--app-text-inverse)] dark:hover:bg-emerald-500/10 sm:min-h-9 sm:w-auto sm:rounded-full sm:px-2.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <Settings2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)] sm:hidden">
          {isId ? 'Urutan' : 'Sort'}
        </span>
        <span className="sr-only sm:not-sr-only sm:text-[10px] sm:font-black sm:text-[color:var(--app-text-soft)]">
          {isId ? 'Urutkan' : 'Sort'}
        </span>
      </span>

      <select
        value={value}
        onChange={event => onChange(event.target.value as ProfileSortMode)}
        className="min-w-0 bg-transparent text-[11px] font-black outline-none sm:max-w-36 sm:text-xs"
        aria-label={isId ? 'Urutkan postingan' : 'Sort posts'}
      >
        <option value="newest">{isId ? 'Terbaru' : 'Newest'}</option>
        <option value="most_viewed">
          {isId ? 'Paling dilihat' : 'Most viewed'}
        </option>
        <option value="oldest">{isId ? 'Terlama' : 'Oldest'}</option>
      </select>
    </label>
  );
}
