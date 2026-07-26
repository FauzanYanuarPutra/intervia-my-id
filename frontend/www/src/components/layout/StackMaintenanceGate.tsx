'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Construction,
  RefreshCw,
  ServerCog,
  Sparkles,
} from 'lucide-react';
import type { StackStartupState } from '@/lib/system/startupState';
import { cn } from '@/lib/utils';

type StackMaintenanceGateProps = {
  children: ReactNode;
  chrome?: ReactNode;
  footer?: ReactNode;
  initialState?: StackStartupState;
  locale: string;
};

type MaintenanceScreenProps = {
  locale: string;
  state?: StackStartupState;
};

const inactiveState: StackStartupState = {
  active: false,
  status: 'idle',
  phase: 'idle',
};

function formatTime(value?: string, locale?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getPhaseLabel(state: StackStartupState | undefined, isId: boolean) {
  const phase = state?.phase || state?.status || 'starting';
  if (phase.includes('build')) {
    return isId ? 'Membangun service' : 'Building services';
  }
  if (phase.includes('start')) {
    return isId ? 'Menyalakan service' : 'Starting services';
  }
  if (phase.includes('failed')) {
    return isId ? 'Perlu dicek' : 'Needs attention';
  }
  return isId ? 'Menyiapkan sistem' : 'Preparing system';
}

function MaintenanceScreen({ locale, state }: MaintenanceScreenProps) {
  const isId = locale === 'id';
  const updatedTime = formatTime(state?.updatedAt, locale);
  const services = state?.services?.slice(0, 4) || [];

  return (
    <main className="grid min-h-[var(--app-document-viewport-height)] place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_38%,#f8fafc_100%)] px-5 py-8 text-[color:var(--app-text)] dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16)_0%,#07111d_42%,#020617_100%)]">
      <section className="relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] p-5 text-center shadow-[0_34px_80px_-48px_rgba(15,23,42,0.42)]  dark:border-[color:var(--app-border-strong)] sm:p-7">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-[0_22px_48px_-34px_rgba(16,185,129,0.5)] dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
          <ServerCog className="h-9 w-9" />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)]">
          <Construction className="h-3.5 w-3.5" />
          Maintenance
        </div>

        <h1 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-[-0.03em] text-[color:var(--app-text)] dark:text-white sm:text-[2rem]">
          {isId
            ? 'Lajukan lagi disiapkan'
            : 'Lajukan is getting ready'}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Service sedang disiapkan. Halaman asli muncul otomatis.'
            : 'Docker or a startup script is still running. The page remains reachable, and the real app will return automatically when every service is ready.'}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[18px] border border-[color:var(--app-border)] bg-white/80 px-3 py-3 text-left dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/45">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
              {isId ? 'Status' : 'Status'}
            </p>
            <p className="mt-1 text-xs font-bold text-[color:var(--app-text)] dark:text-white">
              {getPhaseLabel(state, isId)}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--app-border)] bg-white/80 px-3 py-3 text-left dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/45">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
              {isId ? 'Update' : 'Updated'}
            </p>
            <p className="mt-1 text-xs font-bold text-[color:var(--app-text)] dark:text-white">
              {updatedTime || (isId ? 'Baru saja' : 'Just now')}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--app-border)] bg-white/80 px-3 py-3 text-left dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/45">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
              {isId ? 'Refresh' : 'Refresh'}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--app-text)] dark:text-white">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[color:var(--app-accent)]" />
              {isId ? 'Otomatis' : 'Automatic'}
            </p>
          </div>
        </div>

        {services.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {services.map(service => (
              <span
                key={service}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-white/82 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/50"
              >
                <Sparkles className="h-3 w-3 text-[color:var(--app-accent)]" />
                {service}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
          <CheckCircle2 className="h-4 w-4 text-[color:var(--app-accent)]" />
          {isId
            ? 'Begitu proses selesai, layar ini hilang sendiri.'
            : 'This screen disappears by itself when startup finishes.'}
        </div>
      </section>
    </main>
  );
}

export function StackMaintenanceGate({
  children,
  chrome,
  footer,
  initialState,
  locale,
}: StackMaintenanceGateProps) {
  const [state, setState] = useState<StackStartupState>(
    initialState || inactiveState,
  );
  const active = state.active === true;

  useEffect(() => {
    let cancelled = false;
    let wasActive = active;
    let timeoutId: number | undefined;

    const load = async () => {
      if (document.visibilityState === 'hidden' && !wasActive) {
        return;
      }
      try {
        const response = await fetch('/api/system/startup', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const nextState = (await response.json()) as StackStartupState;
        if (cancelled) return;
        setState(nextState);
        if (wasActive && !nextState.active) {
          window.location.reload();
        }
        wasActive = nextState.active === true;
      } catch {
        if (!cancelled) setState(inactiveState);
      }
    };

    void load();
    const scheduleNext = () => {
      const delay = active ? 2500 : document.visibilityState === 'visible' ? 9000 : 15000;
      timeoutId = window.setTimeout(async () => {
        await load();
        if (!cancelled) scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [active]);

  const content = useMemo(() => {
    if (active) return <MaintenanceScreen locale={locale} state={state} />;
    return (
      <>
        {chrome}
        <div className="flex min-h-0 flex-1 flex-col">
          {children}
          {footer ? <div className="mt-auto">{footer}</div> : null}
        </div>
      </>
    );
  }, [active, children, chrome, footer, locale, state]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        active && 'min-h-[var(--app-document-viewport-height)]',
      )}
    >
      {content}
    </div>
  );
}

export default StackMaintenanceGate;
