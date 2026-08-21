import React from 'react';

type GuidanceStep = {
  title: string;
  desc: string;
};

type Props = {
  badge?: string;
  title: string;
  subtitle: string;
  steps: GuidanceStep[];
  highlightsTitle?: string;
  highlights?: string[];
};

export default function AuthGuidancePanel({
  badge,
  title,
  subtitle,
  steps,
  highlightsTitle,
  highlights = [],
}: Props) {
  return (
    <aside className="w-full rounded-2xl bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%),color-mix(in_srgb,var(--app-surface)_92%,transparent))] p-5 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.16)] ring-1 ring-[color:color-mix(in_srgb,var(--app-border)_76%,transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_94%,transparent),color-mix(in_srgb,var(--app-surface)_88%,transparent))] dark:ring-[color:color-mix(in_srgb,_var(--app-border-strong)_64%,_transparent)] sm:rounded-3xl sm:p-6 lg:p-6">
      <div className="mb-5 sm:mb-6">
        {badge && (
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[color:var(--app-accent)]">
            {badge}
          </p>
        )}
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mt-1">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text-soft)]">
          {subtitle}
        </p>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {steps.map((step, idx) => (
          <div
            key={`${step.title}-${idx}`}
            className="flex gap-3 rounded-xl bg-[color:color-mix(in_srgb,var(--app-surface-muted)_88%,white_12%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface)_82%,transparent)] sm:rounded-2xl sm:p-3.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] text-xs font-bold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
              {String(idx + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {step.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-5 text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text-soft)]">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {highlights.length > 0 && (
        <div className="mt-5 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_68%,white_32%)] p-3.5 ring-1 ring-[color:color-mix(in_srgb,_var(--app-accent-border)_34%,_transparent)] sm:mt-6 sm:rounded-2xl sm:p-4">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
            {highlightsTitle ?? 'Security Highlights'}
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {highlights.map(item => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent)] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
