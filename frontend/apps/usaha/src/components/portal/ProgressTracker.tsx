import { Check, Circle } from 'lucide-react';
import { StatusBadge } from '@/components/portal/StatusBadge';
import type { ProgressStep } from '@/lib/portal-types';

type ProgressTrackerProps = { steps: ProgressStep[] };

export function ProgressTracker({ steps }: ProgressTrackerProps) {
  const completedSteps = steps.filter(step => step.done).length;
  const nextStepIndex = steps.findIndex(step => !step.done);
  const percentage = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-portal-soft"><span>{completedSteps}/{steps.length} langkah selesai</span><span>{percentage}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-portal-mist"><div className="h-full rounded-full bg-portal-forest transition-all" style={{ width: `${percentage}%` }} /></div>
        <p className="mt-2 text-xs leading-5 text-portal-soft">{nextStepIndex >= 0 ? `Berikutnya: ${steps[nextStepIndex].label}` : 'Semua langkah inti sudah selesai.'}</p>
      </div>

      <div className="divide-y divide-portal-line rounded-[16px] border border-portal-line">
        {steps.map((step, index) => (
          <article key={step.id} className="flex items-start gap-3 px-3.5 py-3.5 sm:px-4">
            <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-portal-forest text-white' : 'border border-portal-line bg-white text-portal-soft'}`}>
              {step.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-portal-ink">{step.label}</p><StatusBadge tone={step.done ? 'success' : index === nextStepIndex ? 'warning' : 'neutral'}>{step.done ? 'Selesai' : index === nextStepIndex ? 'Berikutnya' : 'Menunggu'}</StatusBadge></div>
              <p className="mt-1 text-xs leading-5 text-portal-soft">{step.hint}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
