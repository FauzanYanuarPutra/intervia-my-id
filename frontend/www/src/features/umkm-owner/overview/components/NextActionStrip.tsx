import { InlineBadge } from '@/components/super-app/manage/UmkmManagePrimitives';
import type { OverviewNextAction } from '../types';

export function NextActionStrip({
  action,
  isId,
}: {
  action?: OverviewNextAction;
  isId: boolean;
}) {
  if (!action) return null;

  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
            {isId ? 'Langkah berikutnya' : 'Next step'}
          </p>
          <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">
            {action.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {action.desc}
          </p>
        </div>
        <InlineBadge tone="accent">{action.badge}</InlineBadge>
      </div>
    </section>
  );
}
