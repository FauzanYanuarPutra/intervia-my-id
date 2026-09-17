import type { ReactNode } from 'react';

type MetricStripItem = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
};

type MetricStripProps = {
  items: MetricStripItem[];
  className?: string;
};

export function MetricStrip({ items, className = '' }: MetricStripProps) {
  return (
    <section className={`merchant-surface-bordered overflow-hidden ${className}`} aria-label="Ringkasan">
      <div className="grid divide-y divide-portal-line/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map(item => (
          <div key={item.label} className="merchant-kpi">
            <p className="text-[11px] font-semibold text-portal-soft">{item.label}</p>
            <div className="mt-1 text-xl font-bold tracking-[-0.03em] text-portal-ink">{item.value}</div>
            {item.note ? <div className="mt-1 text-[11px] leading-5 text-portal-soft">{item.note}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
