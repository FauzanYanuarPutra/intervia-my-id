import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { UsahaFlowNavItem } from '../types';

export function WorkspaceNavGrid({ items }: { items: UsahaFlowNavItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(item => (
        <WorkspaceNavCard item={item} key={item.id} />
      ))}
    </div>
  );
}

function WorkspaceNavCard({ item }: { item: UsahaFlowNavItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex min-h-[86px] items-start gap-3 rounded-[16px] border p-3 transition hover:-translate-y-0.5',
        item.selected
          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
          : 'border-[color:var(--app-border)] bg-white hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/80',
      )}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-surface)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-border)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-black ui-text">
            {item.title}
          </span>
          {item.selected ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
          ) : null}
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] leading-5 ui-text-soft">
          {item.desc}
        </span>
        <span className="mt-2 inline-flex text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
          {item.badge}
        </span>
      </span>
    </Link>
  );
}
