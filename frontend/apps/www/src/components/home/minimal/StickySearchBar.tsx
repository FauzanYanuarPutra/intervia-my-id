import { FormEvent } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';

type StickySearchBarProps = {
  isId: boolean;
  query: string;
  setQuery: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
};

export function StickySearchBar({
  isId,
  query,
  setQuery,
  onSearch,
}: StickySearchBarProps) {
  return (
    <section className="ui-page-section ui-sticky-controls z-30">
      <div className="ui-feed-section rounded-[1.75rem] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,244,0.96))] p-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)]  dark:border-[color:var(--app-border)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.96),rgba(10,10,10,0.94))]">
        <form
          onSubmit={onSearch}
          className="flex flex-col gap-2 sm:flex-row"
          role="search"
          aria-label="Sticky home search"
        >
          <label className="ui-field-shell ui-feed-row flex min-w-0 flex-1 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={
                isId
                  ? 'Cari supplier, bahan baku, alat, jasa'
                  : 'Search suppliers, distributors, raw materials, tool rental, or business services'
              }
              className="min-h-[36px] w-full min-w-0 appearance-none border-0 bg-transparent text-[13px] font-semibold text-[color:var(--app-text)] shadow-none outline-none ring-0 placeholder:text-[color:var(--app-text-soft)] focus:border-0 focus:outline-none focus:ring-0 dark:text-[color:var(--app-text-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                aria-label={isId ? 'Hapus pencarian' : 'Clear search'}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[13px] font-bold text-white shadow-[0_14px_28px_-24px_rgba(18,138,69,0.45)] transition hover:brightness-105"
          >
            {isId ? 'Cari' : 'Search'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="px-2 pt-2 text-[11px] font-medium text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]">
          {isId
            ? 'Cari dulu. Pilih. Lanjut chat.'
            : 'Start from a business need, then move into the most relevant suppliers, tools, services, or talent.'}
        </p>
      </div>
    </section>
  );
}
