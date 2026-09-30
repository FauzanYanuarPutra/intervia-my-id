import type { ReactNode } from 'react';
import { EmblaInlineRail } from '@/components/portal/EmblaInlineRail';

type MetricStripItem = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
};

type MetricStripProps = {
  items: MetricStripItem[];
  className?: string;
};

function MetricCell({ item }: { item: MetricStripItem }) {
  return (
    <div className="merchant-kpi min-h-[78px] rounded-[14px] border border-portal-line/70 bg-white px-3 py-2.5 sm:min-h-0 sm:rounded-none sm:border-0 sm:px-4 sm:py-3.5">
      <p className="truncate text-[11px] font-semibold text-portal-soft">{item.label}</p>
      <div className="mt-1 truncate text-lg font-bold tracking-[-0.03em] text-portal-ink sm:text-xl">
        {item.value}
      </div>
      {item.note ? (
        <div className="mt-1 line-clamp-1 text-[10px] leading-4 text-portal-soft">
          {item.note}
        </div>
      ) : null}
    </div>
  );
}

export function MetricStrip({ items, className = '' }: MetricStripProps) {
  return (
    <section className={`merchant-surface-bordered overflow-hidden ${className}`} aria-label="Ringkasan">
      <div className="sm:hidden">
        <EmblaInlineRail
          contentClassName="gap-2 p-2"
          itemClassName="w-[min(72vw,14rem)] shrink-0"
        >
          {items.map(item => (
            <MetricCell key={item.label} item={item} />
          ))}
        </EmblaInlineRail>
      </div>

      <div className="hidden divide-y divide-portal-line/70 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map(item => (
          <MetricCell key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}
