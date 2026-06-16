'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BusinessSetupLayoutStep = {
  id: string;
  title: string;
  desc: string;
  summary: string;
  active: boolean;
  done: boolean;
  unlocked: boolean;
};

type BusinessPreview = {
  title: string;
  fallbackTitle: string;
  categoryLabel: string;
  description: string;
  fallbackDescription: string;
};

type BusinessSetupLayoutProps = {
  action?: ReactNode;
  currentStepSummary: string;
  currentStepTitle: string;
  isId: boolean;
  onStepSelect: (stepId: string) => void;
  progressBadge: ReactNode;
  steps: BusinessSetupLayoutStep[];
  subtitle: string;
  title: string;
};

function StepNumber({
  done,
  index,
  active,
}: {
  active: boolean;
  done: boolean;
  index: number;
}) {
  return (
    <span
      className={cn(
        'grid h-8 w-8 place-items-center rounded-full text-xs font-black transition',
        active || done
          ? 'bg-emerald-700 text-white ring-emerald-700'
          : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/8 dark:text-slate-300 dark:ring-white/10',
      )}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
    </span>
  );
}

export function BusinessSetupRail({
  isId,
  onStepSelect,
  steps,
}: {
  isId: boolean;
  onStepSelect: (stepId: string) => void;
  steps: BusinessSetupLayoutStep[];
}) {
  return (
    <aside className="hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950 xl:block">
      <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
        {isId ? 'Buat Profil Usaha' : 'Create Business Profile'}
      </p>
      <div className="mt-5 space-y-1">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepSelect(step.id)}
            disabled={!step.unlocked}
            className="group flex w-full gap-3 rounded-[18px] px-2 py-3 text-left transition hover:bg-emerald-50/70 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-emerald-400/8"
          >
            <span className="relative flex shrink-0 flex-col items-center">
              <StepNumber
                active={step.active}
                done={step.done}
                index={index}
              />
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    'mt-1 h-10 w-px',
                    step.done ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-white/10',
                  )}
                />
              ) : null}
            </span>
            <span className="min-w-0 pb-2">
              <span
                className={cn(
                  'block text-[13px] font-black leading-5',
                  step.active
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-900 dark:text-white',
                )}
              >
                {step.title}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                {step.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function BusinessSetupHorizontalSteps({
  onStepSelect,
  steps,
}: {
  onStepSelect: (stepId: string) => void;
  steps: BusinessSetupLayoutStep[];
}) {
  return (
    <div className="mt-3 flex min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onStepSelect(step.id)}
          disabled={!step.unlocked}
          className={cn(
            'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-3',
            step.active
              ? 'border-emerald-200 bg-emerald-700 text-white shadow-[0_12px_24px_-20px_rgba(21,128,61,0.75)] dark:border-emerald-400/30'
              : step.done
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300',
          )}
        >
          <span
            className={cn(
              'grid h-5 w-5 place-items-center rounded-full text-[10px] font-black transition',
              step.active || step.done
                ? 'bg-white/18 text-current ring-1 ring-white/35'
                : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-white/10',
            )}
          >
            {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className="max-w-[112px] truncate">{step.title}</span>
        </button>
      ))}
    </div>
  );
}

export function BusinessPreviewCard({
  isId,
  preview,
}: {
  isId: boolean;
  preview: BusinessPreview;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950">
      <p className="text-sm font-black text-slate-950 dark:text-white">
        {isId ? 'Preview Usaha' : 'Business Preview'}
      </p>
      <div className="mt-4 rounded-[22px] bg-[linear-gradient(135deg,#f8fffb_0%,#f7f8f4_100%)] p-4 ring-1 ring-slate-100 dark:bg-white/[0.04] dark:ring-white/10">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/20">
          <Store className="h-9 w-9" />
        </div>
        <h3 className="mt-4 line-clamp-2 text-center text-lg font-black text-slate-950 dark:text-white">
          {preview.title || preview.fallbackTitle}
        </h3>
        <div className="mt-2 flex justify-center">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
            {preview.categoryLabel}
          </span>
        </div>
        <p className="mt-3 line-clamp-3 text-center text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
          {preview.description || preview.fallbackDescription}
        </p>
      </div>
    </div>
  );
}

export function BusinessTipsCard({
  isId,
  tips,
}: {
  isId: boolean;
  tips: string[];
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950">
      <p className="text-sm font-black text-slate-950 dark:text-white">
        {isId ? 'Tips Mengisi' : 'Filling Tips'}
      </p>
      <div className="mt-3 space-y-3">
        {tips.map(tip => (
          <div key={tip} className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
              {tip}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BusinessSetupIntroLayout({
  action,
  currentStepSummary,
  currentStepTitle,
  isId,
  onStepSelect,
  progressBadge,
  steps,
  subtitle,
  title,
}: BusinessSetupLayoutProps) {
  return (
    <div className="min-w-0">
      <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-slate-950 sm:p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/20">
                <Store className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[1.05rem] font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-xl">
                  {title}
                </h2>
                <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-[13px]">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0">{action}</div>
        </div>

        <BusinessSetupHorizontalSteps
          onStepSelect={onStepSelect}
          steps={steps}
        />

        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 rounded-[14px] border border-emerald-100 bg-emerald-50/60 px-3 py-2 dark:border-emerald-400/14 dark:bg-emerald-400/10">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-emerald-800 dark:text-emerald-100 sm:text-[13px]">
              {currentStepTitle}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-emerald-700/78 dark:text-emerald-100/70">
              {currentStepSummary}
            </p>
          </div>
          <div className="shrink-0">{progressBadge}</div>
        </div>
      </div>
    </div>
  );
}
