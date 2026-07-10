import { CheckCircle2, Store } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { OverviewAction, OverviewStoreChoice } from '../types';
import { OverviewActionLink } from './OverviewActionLink';

export function OverviewStoreList({
  addStoreAction,
  isId,
  stores,
}: {
  addStoreAction: OverviewAction;
  isId: boolean;
  stores: OverviewStoreChoice[];
}) {
  if (stores.length === 0) return null;

  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
            {isId ? 'Daftar usaha kamu' : 'Your businesses'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Kamu bisa punya banyak usaha. Pilih satu sebagai fokus kerja sekarang.'
              : 'You can manage many businesses. Pick one as the current work focus.'}
          </p>
        </div>
        <OverviewActionLink action={addStoreAction} />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map(store => (
          <StoreChoiceCard key={store.id} isId={isId} store={store} />
        ))}
      </div>
    </section>
  );
}

function StoreChoiceCard({
  isId,
  store,
}: {
  isId: boolean;
  store: OverviewStoreChoice;
}) {
  return (
    <Link
      href={store.href}
      className={cn(
        'flex min-h-[64px] items-center gap-3 rounded-[14px] border px-3 py-2 transition hover:border-[color:var(--app-accent-border)]',
        store.selected
          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
          : 'border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-slate-950/70',
      )}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-[color:var(--app-accent)] ring-1 ring-slate-200 dark:bg-white/8 dark:ring-white/10">
        {store.selected ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Store className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="block truncate text-[13px] font-bold text-[color:var(--app-text)]">
            {store.name}
          </span>
          {store.selected ? (
            <span className="shrink-0 rounded-full bg-[color:var(--app-accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
              {isId ? 'Fokus' : 'Focus'}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[color:var(--app-text-soft)]">
          {store.meta}
        </span>
      </span>
    </Link>
  );
}
