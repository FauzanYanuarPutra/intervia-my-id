import { CheckCircle2, Circle, MapPinned } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { OverviewFlowStep, OverviewModel } from '../types';

export function OverviewFlowRail({
  isId,
  mapAction,
  steps,
}: {
  isId: boolean;
  mapAction: OverviewModel['mapAction'];
  steps: OverviewFlowStep[];
}) {
  return (
    <section className="rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-900 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Langkah' : 'Steps'}
              </p>
              <h2 className="mt-1 text-[1rem] font-bold text-[color:var(--app-text)]">
                {isId ? 'Langsung beresin' : 'Get it done'}
              </h2>
            </div>
            <p className="max-w-xl text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {isId ? 'Mulai dari yang aktif.' : 'Start from the active step.'}
            </p>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {steps.map((step, index) => (
              <FlowStepCard
                index={index}
                key={`${step.href}:${step.label}`}
                step={step}
              />
            ))}
          </div>
        </div>

        <Link
          href={mapAction.href}
          className="group flex min-h-[148px] min-w-0 flex-col justify-between overflow-hidden rounded-[20px] border border-emerald-200 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_32%),linear-gradient(135deg,#0f766e,#0f172a)] p-4 text-white shadow-[0_22px_46px_-36px_rgba(15,118,110,0.48)] transition hover:-translate-y-0.5 lg:w-[260px]"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/16 text-white ring-1 ring-white/18">
              <MapPinned className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em]">
              {mapAction.badge}
            </span>
          </span>
          <span>
            <span className="block text-[15px] font-bold">
              {mapAction.label}
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-5 text-white/78">
              {mapAction.desc}
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function FlowStepCard({
  index,
  step,
}: {
  index: number;
  step: OverviewFlowStep;
}) {
  return (
    <Link
      href={step.href}
      className={cn(
        'group relative min-h-[126px] overflow-hidden rounded-[18px] border p-3 transition hover:-translate-y-0.5',
        step.active
          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
          : step.done
            ? 'border-emerald-200 bg-emerald-50/78 dark:border-emerald-400/20 dark:bg-emerald-400/10'
            : 'border-slate-200 bg-slate-50/80 hover:border-[color:var(--app-accent-border)] dark:border-white/10 dark:bg-slate-950/72',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-[14px] text-[12px] font-bold',
            step.done
              ? 'bg-emerald-600 text-white'
              : step.active
                ? 'bg-[color:var(--app-accent)] text-white'
                : 'bg-white text-[color:var(--app-accent)] ring-1 ring-slate-200 dark:bg-white/8 dark:ring-white/10',
          )}
        >
          {step.done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            String(index + 1).padStart(2, '0')
          )}
        </span>
        <Circle
          className={cn(
            'h-3 w-3',
            step.active
              ? 'fill-[color:var(--app-accent)] text-[color:var(--app-accent)]'
              : 'text-slate-300',
          )}
        />
      </span>
      <span className="mt-3 block">
        <span className="block text-[13px] font-bold text-[color:var(--app-text)]">
          {step.label}
        </span>
        <span className="mt-1 block text-[11px] leading-5 text-[color:var(--app-text-soft)]">
          {step.desc}
        </span>
      </span>
    </Link>
  );
}
