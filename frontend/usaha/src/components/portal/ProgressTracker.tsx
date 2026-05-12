import { CheckCircle2, Circle } from 'lucide-react';
import type { ProgressStep } from '@/lib/portal-types';

type ProgressTrackerProps = {
  steps: ProgressStep[];
};

export function ProgressTracker({ steps }: ProgressTrackerProps) {
  const completedSteps = steps.filter(step => step.done).length;
  const completionLabel = `${completedSteps}/${steps.length} selesai`;
  const nextStepIndex = steps.findIndex(step => !step.done);

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-portal-line/70 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="portal-label">Progress setup</p>
            <p className="mt-1 text-sm font-semibold text-portal-ink">{completionLabel}</p>
            <p className="mt-1 text-sm text-portal-soft">
              {nextStepIndex >= 0
                ? `Berikutnya: ${steps[nextStepIndex].label}.`
                : 'Semua langkah inti sudah terisi.'}
            </p>
          </div>
          <div className="h-3 w-full max-w-[220px] overflow-hidden rounded-full bg-portal-sand sm:w-[220px]">
            <div
              className="h-full rounded-full bg-portal-forest"
              style={{ width: `${(completedSteps / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {steps.map((step, index) => (
          <article
            key={step.id}
            className={`rounded-[24px] border p-4 ${
              step.done
                ? 'border-portal-forest/25 bg-[linear-gradient(180deg,rgba(29,106,67,0.08),rgba(255,255,255,1))]'
                : index === nextStepIndex
                  ? 'border-portal-amber/30 bg-[linear-gradient(180deg,rgba(200,141,47,0.12),rgba(255,255,255,1))]'
                  : 'border-portal-line/70 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                  step.done
                    ? 'border-portal-forest bg-portal-forest text-white'
                    : 'border-portal-line bg-white text-portal-soft'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>
              <div>
                <p className="portal-label">Langkah {index + 1}</p>
                <h3 className="text-sm font-semibold text-portal-ink">{step.label}</h3>
              </div>
            </div>
            <div className="mt-3">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
                  step.done
                    ? 'bg-portal-forest text-white'
                    : index === nextStepIndex
                      ? 'bg-portal-amber text-white'
                      : 'border border-portal-line/70 bg-portal-paper text-portal-ink'
                }`}
              >
                {step.done ? 'Beres' : index === nextStepIndex ? 'Berikutnya' : 'Menunggu'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-portal-soft">{step.hint}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
