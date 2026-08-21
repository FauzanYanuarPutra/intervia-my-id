import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { UsahaFlowNavItem } from '../types';

export function WorkspaceNavGrid({
  isId,
  items,
}: {
  isId: boolean;
  items: UsahaFlowNavItem[];
}) {
  return (
    <section className="rounded-[20px] border border-[color:var(--app-border)] bg-white/92 p-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.14)] dark:bg-slate-900/80">
      <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
            {isId ? 'Alur kerja' : 'Work flow'}
          </p>
          <h2 className="mt-1 text-[1rem] font-bold ui-text">
            {isId
              ? 'Pilih bagian sesuai urutan kerja'
              : 'Pick a section in work order'}
          </h2>
        </div>
        <p className="max-w-xl text-[11px] leading-5 ui-text-soft">
          {isId
            ? 'Profil dulu, lalu katalog, operasional, dan tim. Kamu tetap bisa lompat ke bagian mana pun.'
            : 'Start with profile, then catalog, operations, and team. You can still jump to any section.'}
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <WorkspaceNavCard index={index} item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function WorkspaceNavCard({
  index,
  item,
}: {
  index: number;
  item: UsahaFlowNavItem;
}) {
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
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span>{item.badge}</span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="truncate text-sm font-bold ui-text">
            {item.title}
          </span>
          {item.selected ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
          ) : null}
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] leading-5 ui-text-soft">
          {item.desc}
        </span>
      </span>
    </Link>
  );
}
