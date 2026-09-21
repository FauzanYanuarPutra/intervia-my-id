'use client';

import { StatusBadge } from 'lajukan-ui';
import type { OperationsDestination, OperationsPriority } from './operationsPriority';

export function OperationsPriorityPanel({
  items,
  onOpen,
}: {
  items: OperationsPriority[];
  onOpen: (destination: OperationsDestination) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <p className="text-base font-black text-slate-950">Yang perlu dikerjakan</p>
          <p className="mt-0.5 text-xs text-slate-400">Antrean real dari CRM.</p>
        </div>
        <StatusBadge tone={items.length ? 'warning' : 'success'}>
          {items.length ? items.length : 'Aman'}
        </StatusBadge>
      </div>

      {items.length ? (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 6).map(item => (
            <button
              key={item.kind}
              type="button"
              onClick={() => onOpen(item.destination)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
            >
              <span
                className={
                  item.priority >= 80
                    ? 'h-2 w-2 shrink-0 rounded-full bg-rose-500'
                    : item.priority >= 60
                      ? 'h-2 w-2 shrink-0 rounded-full bg-amber-500'
                      : 'h-2 w-2 shrink-0 rounded-full bg-emerald-500'
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">{item.description}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-7 text-center text-sm font-semibold text-slate-400 sm:px-5">
          Tidak ada antrean mendesak.
        </div>
      )}
    </section>
  );
}
