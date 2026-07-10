import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UsahaSetupStep } from '../types';

export function SetupStepRail({ steps }: { steps: UsahaSetupStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {steps.map((step, index) => (
        <SetupStepPill
          index={index}
          key={`${step.label}-${index}`}
          step={step}
        />
      ))}
    </div>
  );
}

function SetupStepPill({
  index,
  step,
}: {
  index: number;
  step: UsahaSetupStep;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-bold',
        step.active
          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
          : step.done
            ? 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] ui-success-text'
            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface)] ui-text-soft',
      )}
    >
      <span>
        {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
      </span>
      <span>{step.label}</span>
    </span>
  );
}
