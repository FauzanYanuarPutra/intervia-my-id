'use client';

import { useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type ProfileFilterStripItem<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

type ProfileFilterStripProps<T extends string> = {
  ariaLabel: string;
  items: Array<ProfileFilterStripItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
  mobileLabel?: string;
  mobileTitle?: string;
  mobileDescription?: string;
  mobileDoneLabel?: string;
  mobileCloseLabel?: string;
};

export function ProfileFilterStrip<T extends string>({
  ariaLabel,
  items,
  activeKey,
  onChange,
  className,
  mobileLabel = 'Filter',
  mobileTitle = 'Pilih filter',
  mobileDescription = 'Tampilkan jenis konten yang ingin kamu lihat.',
  mobileDoneLabel = 'Selesai',
  mobileCloseLabel = 'Tutup',
}: ProfileFilterStripProps<T>) {
  const [open, setOpen] = useState(false);
  const activeItem = items.find(item => item.key === activeKey) || items[0];
  const activeCount =
    typeof activeItem?.count === 'number' ? activeItem.count : undefined;

  const selectItem = (key: T) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <>
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn('min-w-0', className)}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={activeItem ? `${mobileLabel}: ${activeItem.label}` : mobileLabel}
          className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-left text-[color:var(--app-text)] shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:hidden"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                {mobileLabel}
              </span>
              <span className="block truncate text-xs font-black">
                {activeItem?.label || mobileTitle}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {activeCount !== undefined ? (
              <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
                {activeCount}
              </span>
            ) : null}
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">
              Ubah
            </span>
          </span>
        </button>

        <div className="relative hidden min-w-0 overflow-x-auto overscroll-x-contain pr-3 [scrollbar-width:none] sm:block [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1.5">
            {items.map(item => {
              const active = item.key === activeKey;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange(item.key)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition',
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                      : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:bg-emerald-50 hover:text-emerald-700 dark:bg-white/5 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300',
                  )}
                >
                  {item.label}
                  {typeof item.count === 'number' ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-black',
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-black/5 text-[color:var(--app-text-soft)] dark:bg-white/10',
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[1350] flex items-end bg-slate-950/45 backdrop-blur-sm sm:hidden"
          role="presentation"
          onMouseDown={event => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={mobileTitle}
            className="max-h-[88svh] w-full overflow-hidden rounded-t-[26px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_-24px_64px_-34px_rgba(15,23,42,0.55)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] px-4 pb-3 pt-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  {mobileLabel}
                </p>
                <h2 className="mt-1 text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {mobileTitle}
                </h2>
                <p className="mt-1 max-w-md text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                  {mobileDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={mobileCloseLabel}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[64svh] overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => {
                  const active = item.key === activeKey;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectItem(item.key)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-2xl border px-3 text-left transition',
                        active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-emerald-200 hover:bg-emerald-50/50',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black">
                          {item.label}
                        </span>
                        {typeof item.count === 'number' ? (
                          <span className="mt-0.5 block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                            {item.count} posting
                          </span>
                        ) : null}
                      </span>
                      <span className="grid h-6 w-6 shrink-0 place-items-center">
                        {active ? (
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="h-5 w-5 rounded-full border border-[color:var(--app-border)]" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[color:var(--app-border)] px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-emerald-50"
              >
                {mobileDoneLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
