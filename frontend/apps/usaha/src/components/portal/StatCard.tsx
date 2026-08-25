import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string | number;
  note?: string;
  icon?: LucideIcon;
};

export function StatCard({ label, value, note, icon: Icon }: StatCardProps) {
  return (
    <article className="portal-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-portal-soft">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.045em] text-portal-ink">{value}</p>
        </div>
        {Icon ? <span className="portal-icon-tile"><Icon className="h-4 w-4" /></span> : null}
      </div>
      {note ? <p className="mt-3 text-xs leading-5 text-portal-soft">{note}</p> : null}
    </article>
  );
}
