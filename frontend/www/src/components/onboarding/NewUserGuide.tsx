// Path: frontend/www/src/components/onboarding/NewUserGuide.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

type Step = {
  title: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    title: 'Choose your sector',
    desc: 'Pick an industry to personalize listings and match results.',
  },
  {
    title: 'Verify identity',
    desc: 'Complete basic verification to unlock chat and transactions.',
  },
  {
    title: 'Start your first deal',
    desc: 'Post a listing or request and move to secure escrow.',
  },
];

export default function NewUserGuide() {
  const { user } = useAuth();
  const pathname = usePathname();

  const locale = useMemo(() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  }, [pathname]);

  const primaryHref = user ? '/dashboard' : '/register';
  const secondaryHref = user ? '/profile' : '/login';

  return (
    <section className="rounded-[32px] border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--app-accent)]">
            Start Here
          </p>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            New to the ecosystem? Follow a simple 3-step path.
          </h2>
          <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            We keep onboarding light so you can reach value fast.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--app-accent)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-inverse)] shadow-lg shadow-[var(--app-shadow)] transition hover:bg-[color:var(--app-accent-strong)]"
          >
            {user ? 'Open Dashboard' : 'Create Account'}
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] transition hover:border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)]"
          >
            {user ? 'Complete Profile' : 'Sign In'}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {STEPS.map((step, idx) => (
          <div
            key={step.title}
            className="rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_5%,_transparent)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
              Step {idx + 1}
            </p>
            <p className="mt-2 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {step.title}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}