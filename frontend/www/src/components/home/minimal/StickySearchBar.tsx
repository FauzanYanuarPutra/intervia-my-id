import { FormEvent } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';

type StickySearchBarProps = {
  isId: boolean;
  query: string;
  setQuery: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
};

export function StickySearchBar({ isId, query, setQuery, onSearch }: StickySearchBarProps) {
  return (
    <section className="ui-page-section ui-sticky-controls z-30">
      <div className="ui-feed-section rounded-[1.75rem] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] p-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] backdrop-blur dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.92))]">
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row" role="search" aria-label="Sticky home search">
          <label className="ui-feed-row flex min-w-0 flex-1 items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={
                isId
                  ? 'Cari supplier, distributor, bahan baku, sewa alat, atau jasa usaha'
                  : 'Search suppliers, distributors, raw materials, tool rental, or business services'
              }
              className="min-h-[42px] w-full min-w-0 appearance-none border-0 bg-transparent text-sm font-semibold text-[color:var(--app-text)] shadow-none outline-none ring-0 placeholder:text-[color:var(--app-text-soft)] focus:border-0 focus:outline-none focus:ring-0 dark:text-[color:var(--app-text-soft)]"
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
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[1.3rem] bg-blue-600 px-5 text-sm font-black text-white shadow-[0_18px_36px_-26px_rgba(37,99,235,0.45)] transition hover:bg-blue-700"
          >
            {isId ? 'Cari' : 'Search'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="px-2 pt-2 text-[11px] font-medium text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]">
          {isId ? 'Mulai dari kebutuhan usaha, lalu lanjutkan ke supplier, alat, jasa, atau talent yang paling relevan.' : 'Start from a business need, then move into the most relevant suppliers, tools, services, or talent.'}
        </p>
      </div>
    </section>
  );
}
