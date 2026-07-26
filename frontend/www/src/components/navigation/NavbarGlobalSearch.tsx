'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock3, Search, TrendingUp, X } from 'lucide-react';

import { CategoryIcon } from '@/components/navigation/CategoryIcon';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  categoryLabel,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { cn } from '@/lib/utils';

type NavbarGlobalSearchProps = {
  locale: LajukanLocale;
  pathname: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

type Suggestion = {
  id: string;
  label: string;
  hint: string;
  href?: string;
  kind: 'recent' | 'trending' | 'suggestion' | 'category';
  categoryIcon?: (typeof LAJUKAN_EXPLORE_CATEGORIES)[number]['icon'];
};

const RECENT_SEARCHES_KEY = 'lajukan:recent-searches:v2';

function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(
      window.localStorage.getItem(RECENT_SEARCHES_KEY) || '[]',
    );
    return Array.isArray(value)
      ? value.filter(item => typeof item === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function rememberSearch(query: string) {
  if (typeof window === 'undefined' || query.length < 2) return;
  try {
    const next = [
      query,
      ...readRecentSearches().filter(
        item => item.toLowerCase() !== query.toLowerCase(),
      ),
    ].slice(0, 5);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Recent searches are a local convenience and may fail in private mode.
  }
}

export function NavbarGlobalSearch({
  locale,
  pathname,
  value,
  onValueChange,
  onSubmit,
}: NavbarGlobalSearchProps) {
  const isId = locale === 'id';
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [remoteSuggestions, setRemoteSuggestions] = useState<Suggestion[]>([]);
  const cleanQuery = value.replace(/\s+/g, ' ').trim();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecentSearches());
    if (trending.length > 0) return;

    const controller = new AbortController();
    void fetch('/api/search/trending', {
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then(response => response.json())
      .then(payload => {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setTrending(
          items
            .map((item: { label?: unknown }) =>
              String(item?.label || '').trim(),
            )
            .filter(Boolean)
            .slice(0, 5),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, trending.length]);

  useEffect(() => {
    if (!open || cleanQuery.length < 2) {
      setRemoteSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?${new URLSearchParams({
            q: cleanQuery,
            limit: '6',
          }).toString()}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        const payload = await response.json().catch(() => null);
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRemoteSuggestions(
          items
            .map((item: Record<string, unknown>, index: number) => {
              const label = String(
                locale === 'id'
                  ? item.label_id || item.value || ''
                  : item.label_en || item.value || '',
              ).trim();
              if (!label) return null;
              return {
                id: `suggestion-${index}-${label}`,
                label,
                hint: isId ? 'Saran pencarian' : 'Search suggestion',
                kind: 'suggestion' as const,
              };
            })
            .filter((item: Suggestion | null): item is Suggestion =>
              Boolean(item),
            ),
        );
      } catch {
        if (!controller.signal.aborted) setRemoteSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cleanQuery, isId, locale, open]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const needle = cleanQuery.toLowerCase();
    const seen = new Set<string>();
    const add = (items: Suggestion[]) =>
      items.filter(item => {
        const key = item.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!needle) {
      return [
        ...add(
          recent.map((label, index) => ({
            id: `recent-${index}-${label}`,
            label,
            hint: isId ? 'Pencarian terakhir' : 'Recent search',
            kind: 'recent' as const,
          })),
        ),
        ...add(
          trending.map((label, index) => ({
            id: `trending-${index}-${label}`,
            label,
            hint: isId ? 'Sedang dicari' : 'Trending',
            kind: 'trending' as const,
          })),
        ),
        ...add(
          LAJUKAN_EXPLORE_CATEGORIES.slice(0, 4).map(category => ({
            id: `category-${category.id}`,
            label: categoryLabel(category, locale),
            hint: isId ? 'Jelajahi kategori' : 'Explore category',
            href: buildExploreCategoryHref(category),
            kind: 'category' as const,
            categoryIcon: category.icon,
          })),
        ),
      ].slice(0, 10);
    }

    const localMatches: Suggestion[] = [
      ...trending
        .filter(label => label.toLowerCase().includes(needle))
        .map((label, index) => ({
          id: `trending-${index}-${label}`,
          label,
          hint: isId ? 'Sedang dicari' : 'Trending',
          kind: 'trending' as const,
        })),
      ...LAJUKAN_EXPLORE_CATEGORIES.filter(category =>
        `${category.labelId} ${category.labelEn} ${category.descriptionId}`
          .toLowerCase()
          .includes(needle),
      ).map(category => ({
        id: `category-${category.id}`,
        label: categoryLabel(category, locale),
        hint: isId ? 'Jelajahi kategori' : 'Explore category',
        href: buildExploreCategoryHref(category),
        kind: 'category' as const,
        categoryIcon: category.icon,
      })),
    ];

    return [...add(remoteSuggestions), ...add(localMatches)].slice(0, 8);
  }, [cleanQuery, isId, locale, recent, remoteSuggestions, trending]);

  useEffect(() => setActiveIndex(-1), [cleanQuery, open]);

  const runSearch = (query: string) => {
    const next = query.replace(/\s+/g, ' ').trim();
    if (next.length < 2) return;
    rememberSearch(next);
    setRecent(readRecentSearches());
    setOpen(false);
    void trackLajukanEvent('navbar_search_submit', {
      properties: {
        locale,
        source: 'desktop_navbar',
        route: pathname,
        query: next,
      },
    });
    onSubmit(next);
  };

  const selectSuggestion = (suggestion: Suggestion, position: number) => {
    setOpen(false);
    void trackLajukanEvent('search_suggestion_click', {
      properties: {
        locale,
        source: 'desktop_navbar',
        route: pathname,
        query: cleanQuery,
        position,
        contentType: suggestion.kind,
      },
    });
    if (suggestion.href) {
      window.location.assign(`/${locale}${suggestion.href}`);
      return;
    }
    onValueChange(suggestion.label);
    runSearch(suggestion.label);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        role="search"
        onSubmit={event => {
          event.preventDefault();
          runSearch(cleanQuery);
        }}
      >
        <label className="flex h-10 w-full items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 transition focus-within:border-[color:var(--app-accent-border)] focus-within:bg-[color:var(--app-surface-strong)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
          <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
          <input
            type="search"
            value={value}
            onChange={event => onValueChange(event.target.value)}
            onFocus={() => {
              setOpen(true);
              void trackLajukanEvent('navbar_search_focus', {
                properties: {
                  locale,
                  source: 'desktop_navbar',
                  route: pathname,
                },
              });
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setOpen(false);
                event.currentTarget.blur();
                return;
              }
              if (event.key === 'ArrowDown' && suggestions.length > 0) {
                event.preventDefault();
                setOpen(true);
                setActiveIndex(index => (index + 1) % suggestions.length);
              }
              if (event.key === 'ArrowUp' && suggestions.length > 0) {
                event.preventDefault();
                setActiveIndex(index =>
                  index <= 0 ? suggestions.length - 1 : index - 1,
                );
              }
              if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                selectSuggestion(suggestions[activeIndex], activeIndex);
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            placeholder={
              isId ? 'Cari kebutuhan usaha...' : 'Search business needs...'
            }
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
            data-testid="app-header-search-input"
          />
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--app-accent-border)] border-t-transparent" />
          ) : value ? (
            <button
              type="button"
              onClick={() => onValueChange('')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)]"
              aria-label={isId ? 'Hapus pencarian' : 'Clear search'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </form>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="ui-layer-popover absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1.5 shadow-[0_24px_64px_-30px_rgba(15,23,42,0.44)]"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion, index)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-[6px] px-3 text-left transition',
                  activeIndex === index
                    ? 'bg-[color:var(--app-accent-soft)]'
                    : 'hover:bg-[color:var(--app-surface-muted)]',
                )}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]">
                  {suggestion.categoryIcon ? (
                    <CategoryIcon
                      name={suggestion.categoryIcon}
                      className="h-4 w-4"
                    />
                  ) : suggestion.kind === 'recent' ? (
                    <Clock3 className="h-4 w-4" />
                  ) : suggestion.kind === 'trending' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[color:var(--app-text)]">
                    {suggestion.label}
                  </span>
                  <span className="block truncate text-[10px] text-[color:var(--app-text-soft)]">
                    {suggestion.hint}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-[color:var(--app-text-soft)]">
              {cleanQuery.length === 1
                ? isId
                  ? 'Ketik satu karakter lagi untuk melihat saran lengkap.'
                  : 'Type one more character for complete suggestions.'
                : isId
                  ? 'Ketik apa yang ingin kamu cari.'
                  : 'Type what you want to find.'}
            </div>
          )}
          {cleanQuery.length >= 2 ? (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => runSearch(cleanQuery)}
              className="mt-1 flex min-h-10 w-full items-center justify-center rounded-[6px] border-t border-[color:var(--app-border)] px-3 text-xs font-bold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)]"
            >
              {isId
                ? `Lihat semua hasil untuk \"${cleanQuery}\"`
                : `View all results for \"${cleanQuery}\"`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
