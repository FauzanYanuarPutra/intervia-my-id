'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImageIcon, Search, Trash2, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EmptyState } from '@/components/system/feedback/EmptyState';
import {
  readSearchCartSession,
  removeSearchCartItem,
  subscribeSearchCartSession,
  type SearchCartItem,
} from '@/lib/searchCartSession';
import {
  readListingViewHistory,
  removeListingViewHistoryItem,
  subscribeListingViewHistory,
  type ListingViewHistoryItem,
} from '@/lib/listingViewHistory';

type CollectionMode = 'saved' | 'history';

type Props = {
  mode: CollectionMode;
};

function filterSaved(items: SearchCartItem[], query: string): SearchCartItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter(item =>
    [
      item.title,
      item.summary,
      item.typeLabel,
      item.actionLabel,
      item.location,
      item.priceLabel,
      item.storeName,
      item.kind,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

function filterHistory(items: ListingViewHistoryItem[], query: string): ListingViewHistoryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter(item =>
    [
      item.title,
      item.summary,
      item.typeLabel,
      item.actionLabel,
      item.location,
      item.priceLabel,
      item.storeName,
      item.kind,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

export default function MyContentCollectionClient({ mode }: Props) {
  const [query, setQuery] = useState('');
  const [savedItems, setSavedItems] = useState<SearchCartItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ListingViewHistoryItem[]>([]);

  useEffect(() => {
    if (mode === 'saved') {
      const sync = () => setSavedItems(readSearchCartSession().items);
      sync();
      return subscribeSearchCartSession(sync);
    }

    const sync = () => setHistoryItems(readListingViewHistory());
    sync();
    return subscribeListingViewHistory(sync);
  }, [mode]);

  const saved = useMemo(() => filterSaved(savedItems, query), [query, savedItems]);
  const history = useMemo(
    () => filterHistory(historyItems, query),
    [historyItems, query],
  );

  const isSaved = mode === 'saved';
  const items = isSaved ? saved : history;
  const title = isSaved ? 'Disimpan' : 'Riwayat';
  const description = isSaved
    ? 'Yang kamu simpan dari pencarian untuk dibuka lagi.'
    : 'Yang baru kamu buka dari pencarian atau Explore.';
  const emptyTitle = isSaved ? 'Belum ada yang disimpan' : 'Riwayat masih kosong';
  const emptyDescription = isSaved
    ? 'Simpan produk, jasa, atau usaha dari Explore supaya mudah ditemukan lagi.'
    : 'Listing atau konten yang kamu buka akan muncul di sini.';

  const removeSaved = (id: string) => {
    setSavedItems(removeSearchCartItem(id).items);
  };

  const removeHistory = (id: string) => {
    setHistoryItems(removeListingViewHistoryItem(id));
  };

  return (
    <main className="page-shell min-w-0 max-w-full overflow-x-clip pb-8 pt-4 sm:py-6">
      <div className="mx-auto w-full max-w-5xl px-0 sm:px-2 lg:px-3">
        <header className="border-b border-slate-200 bg-white px-3 pb-3 pt-2 dark:border-white/10 dark:bg-slate-950 sm:rounded-t-[20px] sm:px-4 sm:pt-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-[-0.025em] text-slate-950 dark:text-white sm:text-xl">
                {title}
              </h1>
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-800 sm:px-4 sm:text-sm"
            >
              <Search className="h-4 w-4" />
              Jelajahi
            </Link>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[13px] border border-slate-200 bg-white px-3 transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:focus-within:ring-emerald-400/15">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={isSaved ? 'Cari yang disimpan' : 'Cari riwayat'}
                className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                aria-label="Cari"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-white"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
        </header>

        <section className="bg-white dark:bg-slate-950 sm:rounded-b-[20px] sm:border-x sm:border-b sm:border-slate-200 sm:dark:border-white/10">
          {items.length === 0 ? (
            <EmptyState
              className="px-4 py-12"
              title={query ? 'Tidak ditemukan' : emptyTitle}
              description={query ? 'Coba kata lain atau hapus pencarian.' : emptyDescription}
              action={
                !query ? (
                  <Link
                    href="/explore"
                    className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
                  >
                    Jelajahi
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/8">
              {isSaved
                ? saved.map(item => (
                    <article
                      key={item.id}
                      className="flex min-w-0 items-center gap-3 p-3 sm:p-4"
                    >
                      <Link
                        href={item.href}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[13px] bg-slate-100 bg-cover bg-center ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10"
                        style={
                          item.image
                            ? {
                                backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                              }
                            : undefined
                        }
                      >
                        {!item.image ? (
                          <span className="absolute inset-0 grid place-items-center">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </span>
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={item.href}
                          className="line-clamp-2 text-sm font-bold text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {[item.typeLabel, item.priceLabel, item.location]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSaved(item.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-400/10"
                        aria-label="Hapus dari simpanan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  ))
                : history.map(item => (
                    <article
                      key={item.id}
                      className="flex min-w-0 items-center gap-3 p-3 sm:p-4"
                    >
                      <Link
                        href={item.href}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[13px] bg-slate-100 bg-cover bg-center ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10"
                        style={
                          item.image
                            ? {
                                backgroundImage: `url("${item.image.replace(/"/g, '%22')}")`,
                              }
                            : undefined
                        }
                      >
                        {!item.image ? (
                          <span className="absolute inset-0 grid place-items-center">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </span>
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={item.href}
                          className="line-clamp-2 text-sm font-bold text-slate-950 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {[item.typeLabel, item.priceLabel, item.location]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHistory(item.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-white"
                        aria-label="Hapus dari riwayat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
