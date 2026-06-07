// Path: frontend/www/src/components/onboarding/OnboardingChecklist.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Step = {
  id: string;
  title: string;
  desc: string;
  done?: boolean;
  href?: string;
};

type Props = {
  title?: string;
  steps?: Step[];
};

const DEFAULT_STEPS: Step[] = [
  {
    id: 'profile',
    title: 'Complete profile',
    desc: 'Add sector, location, and basic details.',
    href: '/profile',
  },
  {
    id: 'verification',
    title: 'Verify identity',
    desc: 'Upload ID and pass liveness to unlock transactions.',
    href: '/settings',
  },
  {
    id: 'first-action',
    title: 'Post or request',
    desc: 'Create a listing or request to start matching.',
    href: '/search?type=product&q=supplier',
  },
  {
    id: 'trust',
    title: 'Build trust score',
    desc: 'Complete your first transaction and get rated.',
    href: '/transactions',
  },
];

export default function OnboardingChecklist({
  title = 'Your onboarding path',
  steps = DEFAULT_STEPS,
}: Props) {
  const pathname = usePathname();
  const locale = (() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  })();

  return (
    <section className="rounded-[32px] border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--app-accent)]">
            Onboarding
          </p>
          <h3 className="text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {title}
          </h3>
        </div>
        <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
          Fast Track
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map(step => {
          const href = step.href ? `/${locale}${step.href}` : undefined;
          return (
            <div
              key={step.id}
              className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_5%,_transparent)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] p-4"
            >
              <div
                className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                  step.done
                    ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                    : 'bg-[color:var(--app-surface-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-overlay)_30%,_transparent)] text-[color:var(--app-text)]'
                }`}
              >
                {step.done ? 'OK' : 'GO'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {step.title}
                </p>
                <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {step.desc}
                </p>
              </div>
              {href && (
                <Link
                  href={href}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)] hover:text-[color:var(--app-accent)]"
                >
                  Open
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
