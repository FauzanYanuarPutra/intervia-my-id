import { InlineBadge } from '@/components/super-app/manage/UmkmManagePrimitives';
import type { OverviewModel } from '../types';
import { OverviewActionCardGrid } from './OverviewActionCardGrid';
import { OverviewActionLink } from './OverviewActionLink';

export function OverviewHero({
  isId,
  model,
}: {
  isId: boolean;
  model: OverviewModel;
}) {
  return (
    <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_46px_-40px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
            {isId ? 'Usaha' : 'Business'}
          </p>
          <h1 className="mt-1 text-[1.35rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.7rem]">
            {model.title}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[color:var(--app-text-soft)]">
            {model.subtitle}
          </p>
        </div>
        <InlineBadge tone={model.activeBadgeTone}>
          {model.activeBadge}
        </InlineBadge>
      </div>

      <OverviewActionCardGrid cards={model.actionCards} />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <OverviewActionLink action={model.primaryAction} primary />
        <OverviewActionLink action={model.secondaryAction} />
      </div>
    </section>
  );
}
