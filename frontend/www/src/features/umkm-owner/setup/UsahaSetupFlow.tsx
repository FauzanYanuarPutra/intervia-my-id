'use client';

import type { UsahaSetupFlowProps } from './types';
import { SetupStepRail } from './components/SetupStepRail';

export function UsahaSetupFlow({
  actions,
  desc,
  eyebrow,
  steps,
  title,
}: UsahaSetupFlowProps) {
  return (
    <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.16)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] ui-accent-text">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-black ui-text sm:text-[1.35rem]">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 ui-text-soft">{desc}</p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[190px]">
          {actions}
        </div>
      </div>
      <SetupStepRail steps={steps} />
    </div>
  );
}
