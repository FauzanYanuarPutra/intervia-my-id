import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonBlock } from '@/components/system/feedback/SkeletonBlock';

function Pulse({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-2xl', className)} />;
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell page-rhythm py-6" data-skeleton-route="true">
      {children}
    </div>
  );
}

function HeroCard() {
  return (
    <section className="ui-panel ui-hero-panel rounded-[32px] p-6">
      <Pulse className="h-4 w-28 rounded-full" />
      <Pulse className="mt-4 h-10 w-full max-w-[520px]" />
      <Pulse className="mt-3 h-4 w-full max-w-[720px]" />
      <Pulse className="mt-2 h-4 w-4/5 max-w-[620px]" />
      <div className="mt-5 flex flex-wrap gap-2">
        <Pulse className="h-9 w-28 rounded-full" />
        <Pulse className="h-9 w-24 rounded-full" />
        <Pulse className="h-9 w-32 rounded-full" />
      </div>
    </section>
  );
}

function CardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} className="ui-panel rounded-[28px] p-5">
          <Pulse className="h-12 w-12" />
          <Pulse className="mt-4 h-6 w-3/4" />
          <SkeletonBlock lines={3} className="mt-3" />
          <Pulse className="mt-5 h-11 w-32" />
        </article>
      ))}
    </div>
  );
}

export function LocaleRouteSkeleton() {
  return (
    <ShellFrame>
      <HeroCard />
      <CardGrid />
    </ShellFrame>
  );
}

export function SharedPageSkeleton() {
  return (
    <ShellFrame>
      <section className="ui-panel ui-hero-panel rounded-[32px] p-6 sm:p-8">
        <Pulse className="h-4 w-28 rounded-full" />
        <Pulse className="mt-4 h-10 w-full max-w-[620px]" />
        <SkeletonBlock lines={3} className="mt-4 max-w-[760px]" />
        <div className="mt-5 flex flex-wrap gap-2">
          <Pulse className="h-9 w-28 rounded-full" />
          <Pulse className="h-9 w-24 rounded-full" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="ui-panel rounded-[24px] p-4">
            <Pulse className="h-11 w-11 rounded-2xl" />
            <Pulse className="mt-4 h-5 w-2/3" />
            <SkeletonBlock lines={3} className="mt-3" />
          </article>
        ))}
      </section>

      <section className="ui-panel-muted rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Pulse className="h-4 w-24 rounded-full" />
            <Pulse className="mt-3 h-7 w-56" />
          </div>
          <Pulse className="h-9 w-28 rounded-full" />
        </div>
        <SkeletonBlock lines={4} className="mt-4 max-w-[820px]" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Pulse className="h-28 w-full rounded-[24px]" />
          <Pulse className="h-28 w-full rounded-[24px]" />
        </div>
      </section>
    </ShellFrame>
  );
}

export function AppPageSkeleton() {
  return (
    <div
      className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]"
      data-skeleton-route="true"
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-5 sm:py-5">
        <section className="ui-panel rounded-[32px] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Pulse className="h-14 w-14 rounded-[20px]" />
              <div>
                <Pulse className="h-4 w-28 rounded-full" />
                <Pulse className="mt-3 h-8 w-56" />
                <Pulse className="mt-3 h-4 w-72 max-w-full" />
              </div>
            </div>
            <Pulse className="h-10 w-28 rounded-full" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <article
                key={index}
                className="ui-panel-muted rounded-[24px] p-4"
              >
                <Pulse className="h-3 w-24 rounded-full" />
                <Pulse className="mt-3 h-7 w-20 rounded-full" />
                <Pulse className="mt-3 h-3 w-32 rounded-full" />
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="ui-panel rounded-[28px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Pulse className="h-5 w-36" />
              <Pulse className="h-8 w-24 rounded-full" />
            </div>
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-4 w-40 rounded-full" />
                      <SkeletonBlock lines={2} className="mt-3 max-w-[420px]" />
                    </div>
                    <Pulse className="h-8 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="ui-panel-muted rounded-[28px] p-5">
            <Pulse className="h-4 w-24" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Pulse key={index} className="h-10 w-full rounded-full" />
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <Pulse className="h-24 w-full rounded-[24px]" />
              <Pulse className="h-24 w-full rounded-[24px]" />
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="min-h-svh bg-[linear-gradient(180deg,#fff8ef_0%,#fef7ed_26%,#f8fbff_62%,#eef6ff_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#081225_46%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-3">
          <Pulse className="h-11 w-36 rounded-full" />
          <Pulse className="h-8 w-32 rounded-full" />
        </div>

        <div className="mt-5 grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-6">
          <section className="order-2 space-y-4 lg:order-1">
            <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(255,255,255,0.95)_0%,rgba(255,247,237,0.94)_44%,rgba(239,246,255,0.92)_100%)] p-5 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.3)] ring-1 ring-white/60 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.88)_0%,rgba(30,41,59,0.86)_44%,rgba(2,6,23,0.92)_100%)] dark:ring-slate-800/70 sm:p-6">
              <Pulse className="h-3 w-24 rounded-full" />
              <Pulse className="mt-4 h-11 w-full max-w-[420px]" />
              <SkeletonBlock lines={3} className="mt-4 max-w-[640px]" />
              <Pulse className="mt-5 h-14 w-full rounded-[22px]" />
            </div>

            <div className="rounded-[28px] bg-white/70 p-5 shadow-[0_22px_52px_-42px_rgba(15,23,42,0.28)] ring-1 ring-white/60 dark:bg-slate-950/45 dark:ring-slate-800/60">
              <Pulse className="h-3 w-24 rounded-full" />
              <Pulse className="mt-3 h-7 w-56" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[22px] border border-white/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/55"
                  >
                    <div className="flex items-start gap-3">
                      <Pulse className="h-8 w-8 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <Pulse className="h-4 w-36 rounded-full" />
                        <Pulse className="mt-2 h-3 w-5/6 rounded-full" />
                        <Pulse className="mt-2 h-3 w-3/4 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pulse className="h-7 w-28 rounded-full" />
                <Pulse className="h-7 w-24 rounded-full" />
                <Pulse className="h-7 w-24 rounded-full" />
              </div>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_100%)] p-5 shadow-[0_30px_72px_-42px_rgba(15,23,42,0.38)] ring-1 ring-white/65 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.92)_0%,rgba(2,6,23,0.94)_100%)] dark:ring-slate-800/70 sm:p-6">
              <Pulse className="h-4 w-28 rounded-full" />
              <Pulse className="mt-4 h-8 w-40" />
              <Pulse className="mt-3 h-4 w-full rounded-full" />
              <div className="mt-6 space-y-4">
                <Pulse className="h-12 w-full rounded-2xl" />
                <Pulse className="h-12 w-full rounded-2xl" />
                <Pulse className="h-12 w-full rounded-2xl" />
              </div>
              <div className="mt-4 flex gap-2">
                <Pulse className="h-12 flex-1 rounded-2xl" />
                <Pulse className="h-12 w-24 rounded-2xl" />
              </div>
              <Pulse className="mt-6 h-4 w-40 rounded-full" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div
      className="page-shell page-rhythm py-4 sm:py-6"
      data-skeleton-route="true"
    >
      <section className="ui-panel ui-hero-panel rounded-[32px] p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Pulse className="h-9 w-28 rounded-full" />
          <Pulse className="h-9 w-28 rounded-full" />
        </div>
        <Pulse className="mt-4 h-4 w-28 rounded-full" />
        <Pulse className="mt-3 h-10 w-full max-w-[560px]" />
        <SkeletonBlock lines={2} className="mt-4 max-w-[720px]" />

        <div className="mt-5 flex flex-col gap-3 rounded-[26px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] sm:flex-row sm:items-center">
          <Pulse className="h-11 flex-1 rounded-full" />
          <Pulse className="h-11 w-full rounded-full sm:w-32" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Pulse key={index} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="ui-panel rounded-[28px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Pulse className="h-4 w-24 rounded-full" />
              <Pulse className="mt-3 h-7 w-44" />
            </div>
            <Pulse className="h-9 w-24 rounded-full" />
          </div>
          <div className="mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="w-[216px] min-w-[216px] rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <Pulse className="h-8 w-8 rounded-xl" />
                  <Pulse className="h-8 w-8 rounded-xl" />
                </div>
                <Pulse className="mt-4 h-5 w-3/4" />
                <SkeletonBlock lines={2} className="mt-3" />
                <Pulse className="mt-4 h-4 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </article>

        <div className="space-y-4">
          <article className="ui-panel-muted rounded-[28px] p-5">
            <Pulse className="h-4 w-24" />
            <Pulse className="mt-3 h-7 w-40" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Pulse className="h-10 w-10 rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <Pulse className="h-4 w-28 rounded-full" />
                        <Pulse className="mt-2 h-3 w-36 rounded-full" />
                      </div>
                    </div>
                    <Pulse className="h-4 w-4 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="ui-panel rounded-[28px] p-5">
            <Pulse className="h-4 w-28" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                >
                  <Pulse className="h-4 w-16 rounded-full" />
                  <Pulse className="mt-3 h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="ui-panel rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Pulse className="h-4 w-28 rounded-full" />
            <Pulse className="mt-3 h-7 w-52" />
          </div>
          <Pulse className="h-8 w-24 rounded-full" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
            >
              <div className="flex gap-3">
                <Pulse className="h-24 w-28 shrink-0 rounded-[20px]" />
                <div className="min-w-0 flex-1">
                  <Pulse className="h-4 w-24 rounded-full" />
                  <Pulse className="mt-2 h-6 w-4/5" />
                  <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pulse className="h-7 w-20 rounded-full" />
                    <Pulse className="h-7 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CommunityPageSkeleton({
  variant = 'feed',
}: {
  variant?: 'feed' | 'group';
} = {}) {
  return (
    <main
      className="lajukan-home-compact min-h-screen min-h-[100svh] bg-[radial-gradient(circle_at_top,#eef9f1_0%,#f8fbff_34%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(var(--app-viewport-height)-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0"
      data-skeleton-route="true"
      aria-busy="true"
    >
      <div className="lajukan-home-shell mx-auto flex h-full flex-col lg:overflow-hidden">
        <div
          className={cn(
            'lajukan-home-desktop-grid relative z-0 mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 gap-4 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]',
            variant === 'group'
              ? 'xl:grid-cols-[280px_minmax(0,1fr)_340px]'
              : 'xl:grid-cols-[260px_minmax(0,1fr)_320px] 2xl:grid-cols-[280px_minmax(0,1fr)_340px]',
          )}
        >
          <aside className="hidden space-y-3 lg:block">
            <div className="ui-panel rounded-[24px] p-4">
              <Pulse className="h-5 w-32" />
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="mt-4 flex items-center gap-3">
                  <Pulse className="h-9 w-9 rounded-xl" />
                  <Pulse className="h-4 flex-1 rounded-full" />
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0 space-y-3">
            <section className="ui-panel rounded-[24px] p-4">
              <div className="flex items-center gap-3">
                <Pulse className="h-11 w-11 shrink-0 rounded-full" />
                <Pulse className="h-11 flex-1 rounded-full" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Pulse key={index} className="h-8 rounded-full" />
                ))}
              </div>
            </section>

            {Array.from({ length: 3 }).map((_, index) => (
              <article
                key={index}
                className="ui-panel overflow-hidden rounded-[24px]"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <Pulse className="h-11 w-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-4 w-36 rounded-full" />
                      <Pulse className="mt-2 h-3 w-24 rounded-full" />
                    </div>
                    <Pulse className="h-9 w-9 rounded-full" />
                  </div>
                  <Pulse className="mt-4 h-5 w-4/5 rounded-full" />
                  <SkeletonBlock lines={2} className="mt-3" />
                </div>
                <Pulse
                  className={cn(
                    'w-full rounded-none',
                    index === 1
                      ? 'aspect-[16/10]'
                      : 'aspect-[4/3] sm:aspect-video',
                  )}
                />
                <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--app-border)] p-4">
                  {Array.from({ length: 3 }).map((_, actionIndex) => (
                    <Pulse
                      key={actionIndex}
                      className="mx-auto h-4 w-16 rounded-full"
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="hidden space-y-3 lg:block">
            <div className="ui-panel rounded-[24px] p-4">
              <Pulse className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="mt-4 flex items-center gap-3">
                  <Pulse className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-4 w-4/5 rounded-full" />
                    <Pulse className="mt-2 h-3 w-2/3 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-5"
      data-skeleton-route="true"
    >
      <section className="rounded-[32px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Pulse className="h-14 w-14 rounded-[20px]" />
            <div>
              <Pulse className="h-3 w-24 rounded-full" />
              <Pulse className="mt-3 h-8 w-56" />
              <Pulse className="mt-3 h-4 w-80 max-w-full" />
            </div>
          </div>
          <Pulse className="h-10 w-28 rounded-full" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <article
              key={index}
              className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
            >
              <Pulse className="h-3 w-20 rounded-full" />
              <Pulse className="mt-3 h-7 w-16 rounded-full" />
              <Pulse className="mt-3 h-3 w-24 rounded-full" />
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pulse className="h-5 w-40" />
            <Pulse className="h-8 w-24 rounded-full" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-4 w-40 rounded-full" />
                    <Pulse className="mt-2 h-3 w-32 rounded-full" />
                    <SkeletonBlock lines={2} className="mt-3 max-w-[420px]" />
                  </div>
                  <Pulse className="h-8 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Pulse className="h-4 w-28 rounded-full" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Pulse key={index} className="h-10 w-full rounded-full" />
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Pulse className="h-4 w-32 rounded-full" />
            <div className="mt-4 space-y-3">
              <Pulse className="h-24 w-full rounded-[24px]" />
              <Pulse className="h-24 w-full rounded-[24px]" />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SettingsRowSkeleton({
  controlClassName = 'h-10 w-28 rounded-xl',
}: {
  controlClassName?: string;
}) {
  return (
    <div className="ui-feed-row flex flex-col gap-2 border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
      <div className="space-y-2">
        <Pulse className="h-4 w-36 rounded-full" />
        <Pulse className="h-3 w-64 max-w-full rounded-full" />
      </div>
      <Pulse className={controlClassName} />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-5 sm:py-6"
      data-skeleton-route="true"
    >
      <section className="rounded-[32px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Pulse className="h-8 w-40" />
            <Pulse className="mt-3 h-4 w-80 max-w-full rounded-full" />
          </div>
          <Pulse className="h-10 w-24 rounded-full" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-5 w-28 rounded-full" />
        <Pulse className="mt-2 h-3 w-72 max-w-full rounded-full" />
        <div className="mt-4 space-y-3">
          <SettingsRowSkeleton />
          <SettingsRowSkeleton />
          <SettingsRowSkeleton />
        </div>
      </section>

      <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-5 w-32 rounded-full" />
        <Pulse className="mt-2 h-3 w-80 max-w-full rounded-full" />
        <div className="mt-4 space-y-3">
          <SettingsRowSkeleton />
          <SettingsRowSkeleton />
          <SettingsRowSkeleton controlClassName="h-10 w-16 rounded-full" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-5 w-28 rounded-full" />
        <Pulse className="mt-2 h-3 w-72 max-w-full rounded-full" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
            <Pulse className="h-4 w-32 rounded-full" />
            <Pulse className="mt-2 h-3 w-48 rounded-full" />
            <div className="mt-4 space-y-3">
              <Pulse className="h-11 w-full rounded-xl" />
              <Pulse className="h-11 w-full rounded-xl" />
              <Pulse className="h-11 w-full rounded-xl" />
            </div>
            <div className="mt-4 flex gap-2">
              <Pulse className="h-11 w-full rounded-xl" />
              <Pulse className="h-11 w-28 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
            <Pulse className="h-4 w-32 rounded-full" />
            <Pulse className="mt-2 h-3 w-48 rounded-full" />
            <Pulse className="mt-4 h-11 w-full rounded-xl" />
            <Pulse className="h-20 w-full rounded-[20px]" />
            <Pulse className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <section className="mx-auto w-full max-w-[var(--app-max-width)] px-0 py-4 sm:px-3 sm:py-5">
      <div className="ui-feed-section rounded-none border border-x-0 border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 sm:rounded-3xl sm:border-x sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Pulse className="h-3 w-24 rounded-full" />
            <Pulse className="mt-3 h-8 w-56" />
            <Pulse className="mt-3 h-4 w-72 max-w-full rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Pulse className="h-9 w-28 rounded-full" />
            <Pulse className="h-9 w-28 rounded-full" />
            <Pulse className="h-9 w-28 rounded-full" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="ui-feed-row rounded-none border border-x-0 border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3 sm:rounded-2xl sm:border-x"
            >
              <div className="flex items-start gap-3">
                <Pulse className="mt-0.5 h-10 w-10 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Pulse className="h-4 w-48 rounded-full" />
                    <div className="flex flex-wrap gap-2">
                      <Pulse className="h-6 w-20 rounded-full" />
                      <Pulse className="h-3 w-28 rounded-full" />
                    </div>
                  </div>
                  <SkeletonBlock lines={2} className="mt-3 max-w-[760px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReviewPageSkeleton() {
  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-6 lg:px-8">
        <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-6 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-3xl sm:border-x sm:p-8">
          <Pulse className="h-8 w-48" />
          <Pulse className="mt-3 h-4 w-72 max-w-full rounded-full" />

          <div className="mt-8 space-y-6">
            <Pulse className="h-12 w-full rounded-2xl" />

            <div>
              <Pulse className="h-4 w-24 rounded-full" />
              <div className="mt-4 flex gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Pulse key={index} className="h-10 w-10 rounded-full" />
                ))}
              </div>
              <Pulse className="mt-3 h-4 w-24 rounded-full" />
            </div>

            <div>
              <Pulse className="h-4 w-32 rounded-full" />
              <Pulse className="mt-3 h-28 w-full rounded-[20px]" />
            </div>

            <div className="flex gap-3">
              <Pulse className="h-12 w-28 rounded-xl" />
              <Pulse className="h-12 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SuperAppHubSkeleton() {
  return (
    <main className="page-shell py-4 sm:py-5">
      <div className="ui-page-stack mx-auto max-w-[1120px] space-y-4">
        <section className="ui-panel rounded-[32px] p-5 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div>
              <Pulse className="h-4 w-32 rounded-full" />
              <Pulse className="mt-4 h-10 w-full max-w-[520px]" />
              <SkeletonBlock lines={2} className="mt-4 max-w-[640px]" />
              <div className="mt-5 flex flex-wrap gap-2">
                <Pulse className="h-11 w-36 rounded-full" />
                <Pulse className="h-11 w-32 rounded-full" />
              </div>
            </div>

            <aside className="ui-sheet p-4">
              <Pulse className="h-3 w-24 rounded-full" />
              <div className="mt-4 grid gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="ui-feed-row flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Pulse className="h-10 w-10 rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <Pulse className="h-4 w-28 rounded-full" />
                        <Pulse className="mt-2 h-3 w-36 rounded-full" />
                      </div>
                    </div>
                    <Pulse className="h-4 w-4 rounded-full" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="ui-panel rounded-[28px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Pulse className="h-4 w-24 rounded-full" />
              <Pulse className="mt-3 h-8 w-72 max-w-full" />
            </div>
            <Pulse className="h-8 w-24 rounded-full" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-4 dark:border-[color:var(--app-border-strong)]"
              >
                <Pulse className="mx-auto h-12 w-12 rounded-[18px]" />
                <Pulse className="mx-auto mt-3 h-4 w-20 rounded-full" />
                <Pulse className="mx-auto mt-2 h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="ui-panel rounded-[28px] p-5">
            <Pulse className="h-4 w-28 rounded-full" />
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-4 w-36 rounded-full" />
                      <SkeletonBlock lines={2} className="mt-3" />
                    </div>
                    <Pulse className="h-10 w-10 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="ui-panel-muted rounded-[28px] p-5">
            <Pulse className="h-4 w-28 rounded-full" />
            <div className="mt-4 space-y-3">
              <Pulse className="h-28 w-full rounded-[24px]" />
              <Pulse className="h-28 w-full rounded-[24px]" />
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

export function UmkmDiscoverySkeleton() {
  return (
    <main className="page-shell overflow-x-hidden py-0 sm:py-4">
      <div className="ui-page-stack">
        <section
          className="ui-section-shell sm:space-y-3"
          data-section-shell-hero="true"
        >
          <div className="ui-section-shell-content">
            <div className="rounded-[32px] bg-[linear-gradient(145deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.9)_42%,rgba(248,250,252,0.94)_100%)] px-4 py-4 shadow-none dark:bg-[linear-gradient(145deg,rgba(2,6,23,0.96)_0%,rgba(6,78,59,0.18)_42%,rgba(15,23,42,0.92)_100%)] sm:px-5 sm:py-5 sm:shadow-[0_28px_68px_-46px_rgba(15,23,42,0.34)]">
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <Pulse className="h-3 w-24 rounded-full" />
                    <Pulse className="mt-3 h-8 w-full max-w-[420px]" />
                  </div>
                  <Pulse className="h-4 w-80 max-w-full rounded-full" />
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <Pulse className="h-11 w-full rounded-full" />
                  <Pulse className="h-11 w-full rounded-full" />
                  <Pulse className="h-11 w-full rounded-full" />
                </div>

                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Pulse key={index} className="h-8 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <Pulse className="h-[280px] w-full rounded-[32px]" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[26px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-4 w-28 rounded-full" />
                    <Pulse className="mt-3 h-7 w-3/4" />
                    <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />
                  </div>
                  <Pulse className="h-12 w-12 rounded-2xl" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Pulse className="h-8 w-24 rounded-full" />
                  <Pulse className="h-8 w-20 rounded-full" />
                  <Pulse className="h-8 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-3">
            <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-3 w-24 rounded-full" />
              <Pulse className="mt-3 h-8 w-48" />
              <SkeletonBlock lines={3} className="mt-3" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Pulse className="h-10 w-full rounded-full" />
                <Pulse className="h-10 w-full rounded-full" />
              </div>
            </div>

            <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-24 rounded-full" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Pulse key={index} className="h-12 w-full rounded-[18px]" />
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export function UmkmManageSkeleton() {
  return (
    <div className="page-shell py-4 sm:py-6">
      <div className="ui-page-stack">
        <section className="rounded-[32px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Pulse className="h-4 w-28 rounded-full" />
              <Pulse className="mt-3 h-9 w-full max-w-[420px]" />
              <Pulse className="mt-3 h-4 w-80 max-w-full rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Pulse className="h-10 w-44 rounded-full" />
              <Pulse className="h-10 w-32 rounded-full" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
              >
                <Pulse className="h-3 w-20 rounded-full" />
                <Pulse className="mt-3 h-7 w-16 rounded-full" />
                <Pulse className="mt-3 h-3 w-28 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap gap-2">
            <Pulse className="h-10 w-full rounded-full sm:w-32" />
            <Pulse className="h-10 w-32 rounded-full" />
            <Pulse className="h-10 w-32 rounded-full" />
            <Pulse className="h-10 w-32 rounded-full" />
            <Pulse className="h-10 w-32 rounded-full" />
          </div>
          <Pulse className="mt-4 h-4 w-64 max-w-full rounded-full" />
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pulse className="h-5 w-32 rounded-full" />
                <Pulse className="h-8 w-24 rounded-full" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Pulse className="h-12 w-full rounded-xl" />
                <Pulse className="h-12 w-full rounded-xl" />
                <Pulse className="h-28 w-full rounded-[22px] sm:col-span-2" />
              </div>
            </section>

            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-5 w-28 rounded-full" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Pulse key={index} className="h-16 w-full rounded-[22px]" />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-28 rounded-full" />
              <div className="mt-4 space-y-2">
                <Pulse className="h-11 w-full rounded-xl" />
                <Pulse className="h-11 w-full rounded-xl" />
                <Pulse className="h-11 w-full rounded-xl" />
              </div>
            </section>

            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-24 rounded-full" />
              <SkeletonBlock lines={4} className="mt-3" />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function TrackerPageSkeleton() {
  return (
    <div className="page-shell py-4 sm:py-6">
      <div className="ui-page-stack">
        <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Pulse className="h-10 w-10 rounded-full" />
              <div className="min-w-0">
                <Pulse className="h-4 w-40 rounded-full" />
                <Pulse className="mt-2 h-3 w-28 rounded-full" />
              </div>
            </div>
            <Pulse className="h-8 w-24 rounded-full" />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_360px]">
          <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Pulse className="h-[340px] w-full rounded-[24px]" />
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-28 rounded-full" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Pulse className="h-8 w-8 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-3 w-32 rounded-full" />
                      <Pulse className="mt-2 h-3 w-24 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-24 rounded-full" />
              <div className="mt-4 space-y-3">
                <Pulse className="h-16 w-full rounded-[22px]" />
                <Pulse className="h-16 w-full rounded-[22px]" />
              </div>
              <div className="mt-4 flex gap-2">
                <Pulse className="h-10 flex-1 rounded-full" />
                <Pulse className="h-10 flex-1 rounded-full" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function SearchPageSkeleton() {
  return (
    <div
      className="min-h-screen ui-surface-muted ui-text"
      data-skeleton-route="true"
    >
      <div className="page-shell py-4 sm:py-6">
        <section className="ui-panel ui-hero-panel p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <Pulse className="h-3 w-28 rounded-full" />
              <Pulse className="mt-3 h-8 w-4/5" />
              <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />
            </div>
            <div className="ui-panel-muted rounded-2xl border border-[color:var(--app-border)]/70 p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_auto]">
                <Pulse className="h-10 w-full rounded-full" />
                <Pulse className="h-10 w-full rounded-full" />
                <Pulse className="h-10 w-full rounded-full" />
              </div>
              <div className="mt-3 grid gap-2">
                <Pulse className="h-3 w-24 rounded-full" />
                <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Pulse key={index} className="h-7 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <Pulse className="h-28 w-full rounded-[28px]" />
            {Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="ui-panel rounded-2xl p-4">
                <div className="flex gap-3">
                  <Pulse className="h-20 w-24 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-3 w-20 rounded-full" />
                    <Pulse className="mt-2 h-5 w-4/5" />
                    <SkeletonBlock lines={2} className="mt-3" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pulse className="h-7 w-20 rounded-full" />
                      <Pulse className="h-7 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-3">
            <div className="ui-panel rounded-2xl p-4">
              <Pulse className="h-4 w-20 rounded-full" />
              <div className="mt-4 space-y-3">
                <Pulse className="h-16 w-full rounded-2xl" />
                <Pulse className="h-16 w-full rounded-2xl" />
                <Pulse className="h-16 w-full rounded-2xl" />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

export function CreatePageSkeleton() {
  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-2 sm:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 sm:p-5 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Pulse className="h-6 w-48" />
              <Pulse className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />

            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Pulse key={index} className="h-9 w-full rounded-xl" />
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <Pulse className="h-10 w-full rounded-lg" />
              <Pulse className="h-10 w-full rounded-lg" />
              <Pulse className="h-20 w-full rounded-xl" />
              <Pulse className="h-10 w-full rounded-lg" />
              <Pulse className="h-10 w-full rounded-lg" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Pulse className="h-10 w-28 rounded-lg" />
              <Pulse className="h-10 w-28 rounded-lg" />
              <Pulse className="h-10 flex-1 rounded-lg" />
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-28" />
              <Pulse className="mt-3 h-36 w-full rounded-xl" />
              <SkeletonBlock lines={2} className="mt-3" />
            </section>
            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-4 w-24" />
              <div className="mt-4 space-y-2">
                <Pulse className="h-10 w-full rounded-lg" />
                <Pulse className="h-10 w-full rounded-lg" />
                <Pulse className="h-10 w-full rounded-lg" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function TransactionPageSkeleton() {
  return (
    <div
      className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]"
      data-skeleton-route="true"
    >
      <div className="content-width py-5 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Pulse className="h-5 w-40" />
            <Pulse className="mt-2 h-3 w-32" />
          </div>
          <Pulse className="h-9 w-24 rounded-xl" />
        </div>

        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <article
              key={index}
              className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pulse className="h-6 w-20 rounded-full" />
                    <Pulse className="h-6 w-24 rounded-full" />
                    <Pulse className="h-6 w-28 rounded-full" />
                  </div>
                  <Pulse className="mt-3 h-5 w-2/3" />
                  <Pulse className="mt-2 h-3 w-40" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pulse className="h-7 w-24 rounded-full" />
                  <Pulse className="h-7 w-24 rounded-full" />
                </div>
              </div>

              <Pulse className="mt-4 h-32 w-full rounded-xl" />
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((__, idx) => (
                  <Pulse key={idx} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ContentDetailSkeleton() {
  return (
    <div
      className="min-h-[100svh] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)]"
      data-skeleton-route="true"
    >
      <div className="content-width py-5 sm:py-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <Pulse className="h-56 w-full rounded-none sm:h-64" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap gap-2">
                  <Pulse className="h-3 w-20 rounded-full" />
                  <Pulse className="h-6 w-28 rounded-full" />
                  <Pulse className="h-6 w-20 rounded-full" />
                </div>
                <Pulse className="mt-4 h-7 w-4/5" />
                <SkeletonBlock lines={3} className="mt-3 max-w-[560px]" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Pulse className="h-8 w-24 rounded-full" />
                  <Pulse className="h-8 w-28 rounded-full" />
                  <Pulse className="h-8 w-20 rounded-full" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-5 lg:hidden">
              <Pulse className="h-4 w-28" />
              <div className="mt-4 space-y-3">
                <Pulse className="h-12 w-full rounded-xl" />
                <Pulse className="h-10 w-full rounded-xl" />
                <div className="flex gap-2">
                  <Pulse className="h-9 w-full rounded-full" />
                  <Pulse className="h-9 w-24 rounded-full" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pulse className="h-4 w-32 rounded-full" />
                <Pulse className="h-7 w-20 rounded-full" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Pulse key={index} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-5">
              <Pulse className="h-4 w-24 rounded-full" />
              <SkeletonBlock lines={4} className="mt-3" />
            </section>

            <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pulse className="h-4 w-24 rounded-full" />
                <Pulse className="h-4 w-28 rounded-full" />
              </div>
              <div className="mt-4 space-y-3">
                <Pulse className="h-16 w-full rounded-2xl" />
                <Pulse className="h-16 w-full rounded-2xl" />
              </div>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                <Pulse className="h-4 w-28 rounded-full" />
                <Pulse className="mt-3 h-12 w-full rounded-xl" />
                <Pulse className="mt-3 h-10 w-full rounded-xl" />
                <div className="mt-4 flex gap-2">
                  <Pulse className="h-9 w-full rounded-full" />
                  <Pulse className="h-9 w-24 rounded-full" />
                </div>
              </section>
              <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                <Pulse className="h-4 w-24 rounded-full" />
                <div className="mt-4 space-y-3">
                  <Pulse className="h-4 w-full" />
                  <Pulse className="h-4 w-5/6" />
                  <Pulse className="h-4 w-4/5" />
                </div>
              </section>
              <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                <Pulse className="h-4 w-24 rounded-full" />
                <SkeletonBlock lines={3} className="mt-3" />
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function ChatIndexSkeleton() {
  return (
    <section className="hidden h-full min-h-0 flex-1 flex-col bg-gradient-to-br from-[color:color-mix(in_srgb,_var(--app-accent-soft)_80%,_transparent)] via-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] to-[color:color-mix(in_srgb,_var(--app-info-soft)_80%,_transparent)] dark:from-[color:var(--app-surface-strong)] dark:via-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)] dark:to-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] lg:flex">
      <div className="flex min-h-[72px] items-center justify-between border-b border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-6  dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)]">
        <div>
          <Pulse className="h-3 w-28 rounded-full" />
          <Pulse className="mt-3 h-4 w-56 rounded-full" />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 xl:px-8">
        <div className="relative flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl rounded-[32px] border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] p-6 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.32)]  dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] sm:p-8">
            <Pulse className="h-3 w-32 rounded-full" />
            <Pulse className="mt-4 h-8 w-2/3" />
            <SkeletonBlock lines={3} className="mt-4" />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Pulse className="h-10 w-32 rounded-full" />
              <Pulse className="h-4 w-40 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChatDetailSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden overscroll-none bg-[color:var(--app-surface)]"
      data-skeleton-route="true"
    >
      <header className="sticky top-0 z-50 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-5 sm:py-3.5">
          <Pulse className="h-9 w-9 rounded-full lg:hidden" />
          <Pulse className="hidden h-11 w-11 rounded-full sm:block" />
          <div className="min-w-0 flex-1">
            <Pulse className="h-4 w-40 rounded-full" />
            <div className="mt-2 flex items-center gap-2">
              <Pulse className="h-2.5 w-2.5 rounded-full" />
              <Pulse className="h-3 w-32 rounded-full" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Pulse
                key={index}
                className="h-9 w-9 rounded-full sm:h-10 sm:w-10"
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="relative h-full">
          <div className="relative h-full min-w-0 overflow-x-hidden overflow-y-auto px-2.5 py-4 pb-8 sm:px-2 sm:pb-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col space-y-3">
              <div className="flex justify-center">
                <Pulse className="h-5 w-20 rounded-full" />
              </div>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex',
                    index % 2 === 0 ? 'justify-start' : 'justify-end',
                  )}
                >
                  <Pulse className="h-16 w-[min(100%,420px)] rounded-2xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Pulse className="h-9 w-9 rounded-full" />
          <Pulse className="h-9 w-9 rounded-full" />
          <Pulse className="h-10 flex-1 rounded-full" />
          <Pulse className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ChatPageSkeleton() {
  return <ChatDetailSkeleton />;
}

export function MyListingsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Pulse className="h-4 w-40 rounded-full" />
              <Pulse className="mt-2 h-3 w-24 rounded-full" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Pulse className="h-5 w-20 rounded-full" />
                <Pulse className="h-5 w-16 rounded-full" />
                <Pulse className="h-5 w-24 rounded-full" />
              </div>
              <SkeletonBlock lines={2} className="mt-3 max-w-[360px]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pulse className="h-7 w-20 rounded-full" />
              <Pulse className="h-7 w-16 rounded-full" />
            </div>
          </div>
          <Pulse className="mt-3 h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function MyListingsSkeleton() {
  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-2 sm:py-6">
        <section className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Pulse className="h-5 w-40 rounded-full" />
              <Pulse className="mt-2 h-3 w-64 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Pulse className="h-9 w-28 rounded-full" />
              <Pulse className="h-9 w-24 rounded-full" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Pulse key={index} className="h-8 w-20 rounded-full" />
            ))}
          </div>

          <MyListingsListSkeleton />
        </section>
      </div>
    </div>
  );
}

export function MyProjectsSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-2 overflow-x-hidden px-1.5 py-2 sm:px-3">
      <section className="min-w-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Pulse className="h-3 w-24 rounded-full" />
            <Pulse className="mt-2 h-5 w-52 rounded-full" />
          </div>
          <Pulse className="h-9 w-28 rounded-[12px]" />
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="min-w-0 overflow-hidden rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-3"
          >
            <div className="flex items-center justify-between">
              <Pulse className="h-5 w-5 rounded-full" />
              <Pulse className="h-3 w-10 rounded-full sm:w-16" />
            </div>
            <Pulse className="mt-2 h-4 w-12 rounded-full sm:w-20" />
            <Pulse className="mt-1.5 h-3 w-full rounded-full" />
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-2 lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <Pulse className="h-4 w-28 rounded-full" />
          <div className="mt-2 flex max-w-full min-w-0 gap-2 overflow-hidden lg:block lg:space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Pulse
                key={index}
                className="h-20 w-[min(78vw,320px)] shrink-0 rounded-[14px] lg:w-full lg:min-w-0"
              />
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Pulse className="h-5 w-48 rounded-full" />
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Pulse key={index} className="h-12 w-full rounded-[13px]" />
              ))}
            </div>
            <Pulse className="mt-2 h-24 w-full rounded-[14px]" />
          </section>
          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Pulse className="h-4 w-28 rounded-full" />
            <div className="mt-2 grid min-w-0 gap-2 xl:grid-cols-2">
              <Pulse className="h-28 w-full rounded-[14px]" />
              <Pulse className="h-28 w-full rounded-[14px]" />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export function PaymentsPageSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-[var(--app-max-width)] space-y-3 px-0 py-3 sm:p-6"
      data-skeleton-route="true"
    >
      <div className="space-y-3 sm:hidden">
        <div className="hidden rounded-[1.05rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Pulse className="h-2.5 w-16 rounded-full" />
              <Pulse className="mt-2 h-4 w-28 rounded-full" />
            </div>
            <Pulse className="h-8 w-8 rounded-full" />
          </div>
        </div>

        <div className="rounded-[1.05rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Pulse className="h-2.5 w-20 rounded-full" />
              <Pulse className="mt-2 h-4 w-28 rounded-full" />
            </div>
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-2 flex gap-2">
            <Pulse className="h-5 w-20 rounded-full" />
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-2 flex gap-1.5">
            <Pulse className="h-9 flex-1 rounded-[0.95rem]" />
            <Pulse className="h-9 w-20 rounded-[0.95rem]" />
          </div>
        </div>

        <div className="rounded-[1.05rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Pulse className="h-4 w-20 rounded-full" />
            </div>
            <Pulse className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <Pulse className="h-8 w-full rounded-[0.9rem]" />
            <Pulse className="h-8 w-full rounded-[0.9rem]" />
          </div>
          <Pulse className="mt-3 h-11 w-full rounded-[0.95rem]" />
          <div className="mt-2 flex gap-1 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <Pulse key={index} className="h-8 w-20 shrink-0 rounded-full" />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <Pulse key={index} className="h-11 w-full rounded-[0.95rem]" />
            ))}
          </div>
          <Pulse className="mt-3 h-10 w-full rounded-[0.95rem]" />
        </div>

        <div className="hidden rounded-[1.2rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3">
          <Pulse className="h-4 w-20 rounded-full" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
              >
                <Pulse className="h-4 w-28 rounded-full" />
                <Pulse className="mt-2 h-3 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="rounded-[1.5rem] bg-[linear-gradient(155deg,#0f172a_0%,#0f3d68_52%,#0d9488_100%)] p-4 shadow-[0_22px_52px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Pulse className="h-3 w-28 rounded-full bg-white/20" />
              <Pulse className="mt-3 h-10 w-full max-w-[420px] rounded-full bg-white/20" />
              <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[31rem]">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1rem] border border-white/12 bg-white/10 p-3"
                >
                  <Pulse className="h-3 w-16 rounded-full bg-white/20" />
                  <Pulse className="mt-3 h-4 w-24 rounded-full bg-white/20" />
                  <Pulse className="mt-2 h-3 w-full rounded-full bg-white/15" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1rem] border border-white/12 bg-white/10 p-3"
              >
                <Pulse className="h-3 w-20 rounded-full bg-white/20" />
                <Pulse className="mt-3 h-7 w-28 rounded-full bg-white/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="rounded-[1.45rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3.5 lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Pulse className="h-3 w-28 rounded-full" />
                <Pulse className="mt-3 h-7 w-44 rounded-full" />
              </div>
              <Pulse className="h-9 w-9 rounded-full" />
            </div>
            <div className="mt-3 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.2rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
                >
                  <div className="flex items-start gap-3">
                    <Pulse className="h-8 w-8 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-4 w-32 rounded-full" />
                      <Pulse className="mt-2 h-3 w-40 rounded-full" />
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: index === 2 ? 4 : 3 }).map(
                          (__, innerIndex) => (
                            <Pulse
                              key={innerIndex}
                              className="h-10 w-full rounded-xl"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-[1.25rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Pulse className="h-3 w-28 rounded-full" />
                    <Pulse className="mt-3 h-6 w-52 rounded-full" />
                  </div>
                  <Pulse className="h-7 w-24 rounded-full" />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3"
                    >
                      <Pulse className="h-3 w-20 rounded-full" />
                      <Pulse className="mt-3 h-5 w-24 rounded-full" />
                    </div>
                  ))}
                </div>
                <Pulse className="mt-3 h-11 w-full rounded-full" />
              </div>

              <div className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                <Pulse className="h-4 w-36 rounded-full" />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <Pulse className="h-24 w-full rounded-2xl" />
                  <Pulse className="h-24 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-[1.35rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pulse className="h-3 w-32 rounded-full" />
                  <Pulse className="mt-3 h-7 w-48 rounded-full" />
                </div>
                <Pulse className="h-7 w-24 rounded-full" />
              </div>
              <div className="mt-3 rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                <Pulse className="h-3 w-20 rounded-full" />
                <Pulse className="mt-3 h-7 w-32 rounded-full" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pulse className="h-6 w-24 rounded-full" />
                  <Pulse className="h-6 w-28 rounded-full" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5"
                  >
                    <Pulse className="h-3 w-5 rounded-full" />
                    <Pulse className="mt-2 h-3 w-full rounded-full" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pulse className="h-10 w-32 rounded-full" />
                <Pulse className="h-10 w-32 rounded-full" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3.5">
              <Pulse className="h-4 w-28 rounded-full" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Pulse className="h-4 w-32 rounded-full" />
                      <Pulse className="h-5 w-16 rounded-full" />
                    </div>
                    <Pulse className="mt-2 h-3 w-24 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3.5">
              <Pulse className="h-4 w-24 rounded-full" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Pulse className="h-4 w-28 rounded-full" />
                      <Pulse className="h-4 w-20 rounded-full" />
                    </div>
                    <Pulse className="mt-2 h-3 w-32 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProfileEditSkeleton() {
  const fieldSkeletons = [
    { key: 'name', full: false, textarea: false },
    { key: 'handle', full: false, textarea: false },
    { key: 'phone', full: false, textarea: false },
    { key: 'location', full: false, textarea: false },
    { key: 'roles', full: true, textarea: false },
    { key: 'bio', full: true, textarea: true },
  ];

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[color:var(--app-surface-muted)] pb-[calc(8rem+env(safe-area-inset-bottom))] pt-3 dark:bg-[color:var(--app-surface-strong)] sm:pt-5"
      data-skeleton-route="true"
      aria-busy="true"
    >
      <div className="page-shell page-shell-readable mx-auto max-w-6xl overflow-x-hidden">
        <section className="ui-panel mb-4 overflow-hidden p-0">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
            <div className="relative overflow-hidden border-b border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_44%),linear-gradient(180deg,var(--app-surface-strong),var(--app-surface-strong))] p-4 dark:border-[color:var(--app-border-strong)] sm:p-6 lg:border-b-0 lg:border-r">
              <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-300/15 blur-2xl" />

              <div className="relative flex h-full min-h-[280px] flex-col justify-between">
                <div>
                  <Pulse className="h-9 w-36 rounded-xl" />

                  <div className="mt-5 max-w-2xl">
                    <Pulse className="h-3 w-32 rounded-full" />
                    <Pulse className="mt-3 h-8 w-full max-w-[500px] rounded-xl sm:h-9" />
                    <div className="mt-3 max-w-xl space-y-2">
                      <Pulse className="h-4 w-full rounded-full" />
                      <Pulse className="h-4 w-5/6 rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:max-w-md">
                  <Pulse className="h-11 w-full rounded-xl" />
                  <Pulse className="h-11 w-full rounded-xl" />
                </div>
              </div>
            </div>

            <aside className="flex h-full min-h-[280px] flex-col bg-[color:var(--app-surface-strong)]">
              <div className="border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Pulse className="h-3 w-24 rounded-full" />
                    <Pulse className="mt-2 h-4 w-36 rounded-full" />
                  </div>
                  <Pulse className="h-7 w-14 rounded-full" />
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <div className="flex items-center gap-3">
                    <Pulse className="h-16 w-16 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Pulse className="h-5 w-36 rounded-full" />
                      <Pulse className="mt-2 h-3 w-28 rounded-full" />
                      <Pulse className="mt-2 h-3 w-40 max-w-full rounded-full" />
                    </div>
                  </div>

                  <div className="mt-4 min-h-[60px] space-y-2">
                    <Pulse className="h-3.5 w-full rounded-full" />
                    <Pulse className="h-3.5 w-11/12 rounded-full" />
                    <Pulse className="h-3.5 w-3/4 rounded-full" />
                  </div>
                </div>

                <div className="mt-5">
                  <Pulse className="h-2 w-full rounded-full" />
                  <Pulse className="mt-2 h-3 w-56 max-w-full rounded-full" />
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="ui-panel mb-4 overflow-hidden p-0">
          <div className="border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Pulse className="h-4 w-44 rounded-full" />
                <Pulse className="mt-2 h-3 w-full max-w-[430px] rounded-full" />
              </div>
              <Pulse className="h-10 w-full rounded-xl sm:w-56" />
            </div>
          </div>

          <div className="grid auto-rows-fr gap-3 p-3 sm:grid-cols-3 sm:p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex h-full min-h-[112px] flex-col rounded-2xl border p-4',
                  index === 0
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <Pulse className="h-8 w-8 rounded-full" />
                  <Pulse className="h-6 w-12 rounded-full" />
                </div>
                <Pulse className="mt-3 h-4 w-32 rounded-full" />
                <div className="mt-2 min-h-10 space-y-2">
                  <Pulse className="h-3 w-full rounded-full" />
                  <Pulse className="h-3 w-4/5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mb-4 grid auto-rows-fr gap-4 md:grid-cols-2">
          <section className="ui-panel flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Pulse className="h-4 w-40 rounded-full" />
                <Pulse className="mt-2 h-3 w-full max-w-[310px] rounded-full" />
              </div>
              <Pulse className="h-6 w-10 rounded-full" />
            </div>

            <div className="mt-4 grid flex-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--app-surface-muted)] px-3 dark:bg-[color:var(--app-surface)]"
                >
                  <Pulse className="h-4 w-4 shrink-0 rounded-full" />
                  <Pulse className="h-3 flex-1 rounded-full" />
                  {index < 2 ? <Pulse className="h-6 w-9 rounded-lg" /> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="ui-panel flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Pulse className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Pulse className="h-4 w-48 rounded-full" />
                <div className="mt-2 space-y-2">
                  <Pulse className="h-3 w-full rounded-full" />
                  <Pulse className="h-3 w-5/6 rounded-full" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid flex-1 gap-2 sm:grid-cols-2">
              <Pulse className="h-11 w-full rounded-xl" />
              <Pulse className="h-11 w-full rounded-xl" />
            </div>
          </section>
        </div>

        <div className="min-w-0">
          <div className="min-w-0 space-y-4">
            <section className="ui-panel scroll-mt-24 border-emerald-300 p-4 shadow-[0_20px_45px_-32px_rgba(16,185,129,0.35)] dark:border-emerald-900/70 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-[color:var(--app-border)] pb-4 dark:border-[color:var(--app-border-strong)] sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Pulse className="h-11 w-11 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-3 w-20 rounded-full" />
                    <Pulse className="mt-2 h-5 w-40 rounded-full" />
                    <Pulse className="mt-2 h-3 w-full max-w-[520px] rounded-full" />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {fieldSkeletons.map(field => (
                  <div
                    key={field.key}
                    className={cn('min-w-0', field.full && 'sm:col-span-2')}
                  >
                    <div className="flex min-h-[40px] flex-col justify-start">
                      <div className="flex items-center gap-2">
                        <Pulse className="h-4 w-36 rounded-full" />
                        <Pulse className="h-5 w-16 rounded-full" />
                      </div>
                      <Pulse className="mt-2 h-3 w-full max-w-[260px] rounded-full" />
                    </div>
                    <Pulse
                      className={cn(
                        'mt-2 w-full rounded-xl',
                        field.textarea ? 'h-[120px]' : 'h-11',
                      )}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <Pulse className="h-5 w-5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-4 w-32 rounded-full" />
                    <div className="mt-2 space-y-2">
                      <Pulse className="h-3 w-full max-w-[620px] rounded-full" />
                      <Pulse className="h-3 w-4/5 max-w-[520px] rounded-full" />
                    </div>
                    <Pulse className="mt-3 h-11 w-full rounded-xl" />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pulse className="h-4 w-44 rounded-full" />
                      <Pulse className="h-6 w-24 rounded-full" />
                    </div>
                    <div className="mt-2 space-y-2">
                      <Pulse className="h-3 w-full max-w-[600px] rounded-full" />
                      <Pulse className="h-3 w-4/5 max-w-[500px] rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-6 rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)] p-3 shadow-[0_-18px_40px_-32px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-[color:var(--app-border-strong)] sm:bottom-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Pulse className="h-4 w-52 rounded-full" />
              <Pulse className="mt-2 h-3 w-64 max-w-full rounded-full" />
            </div>
            <div className="grid gap-2 sm:flex">
              <Pulse className="h-11 w-full rounded-xl sm:w-32" />
              <Pulse className="h-11 w-full rounded-xl sm:w-44" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OwnerProfileSkeleton() {
  return (
    <main
      className="min-h-screen max-w-full overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8"
      data-skeleton-route="true"
      aria-busy="true"
      aria-label="Loading your profile"
    >
      <div className="mx-auto w-full max-w-[1180px] space-y-3 px-0 py-0 sm:space-y-4 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        {/* Identity */}
        <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border">
          <div className="relative h-36 overflow-hidden sm:h-48 lg:h-56">
            <Pulse className="absolute inset-0 h-full w-full rounded-none" />
            <div className="absolute right-2.5 top-2.5 flex gap-2 sm:right-4 sm:top-4">
              <Pulse className="h-9 w-9 rounded-full sm:h-10 sm:w-10" />
              <Pulse className="h-9 w-9 rounded-full sm:h-10 sm:w-28" />
            </div>
          </div>

          <div className="relative px-3 pb-4 sm:px-6 sm:pb-6">
            <div className="-mt-11 flex items-end gap-3 sm:-mt-14 sm:gap-4">
              <Pulse className="h-[88px] w-[88px] shrink-0 rounded-full ring-[4px] ring-[color:var(--app-surface-strong)] sm:h-28 sm:w-28 sm:ring-[5px]" />
              <div className="min-w-0 flex-1 pb-0.5 sm:pb-2">
                <Pulse className="h-6 w-44 max-w-[70%] rounded-lg sm:h-8 sm:w-64" />
                <Pulse className="mt-2 h-3 w-28 rounded-full sm:w-36" />
              </div>
            </div>

            <div className="mt-3 flex gap-1.5 overflow-hidden">
              <Pulse className="h-6 w-24 shrink-0 rounded-full" />
              <Pulse className="h-6 w-40 shrink-0 rounded-full" />
              <Pulse className="hidden h-6 w-28 rounded-full sm:block" />
            </div>

            <div className="mt-3 space-y-2">
              <Pulse className="h-3.5 w-full max-w-[700px] rounded-full" />
              <Pulse className="h-3.5 w-[72%] max-w-[520px] rounded-full" />
            </div>

            <div className="mt-4 grid grid-cols-4 divide-x divide-[color:var(--app-border)] border-y border-[color:var(--app-border)] py-2.5 sm:max-w-2xl sm:rounded-xl sm:border sm:py-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-2 text-center">
                  <Pulse className="mx-auto h-4 w-10 rounded-full" />
                  <Pulse className="mx-auto mt-2 h-2.5 w-12 rounded-full" />
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
              <Pulse className="h-11 w-full rounded-xl sm:w-32" />
              <Pulse className="h-11 w-full rounded-xl sm:w-40" />
            </div>
          </div>
        </section>

        {/* Summary metrics */}
        <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:rounded-[24px] sm:border sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><Pulse className="h-2.5 w-20 rounded-full" /><Pulse className="mt-2 h-6 w-44 rounded-md" /></div>
            <Pulse className="h-3 w-16 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl bg-[color:var(--app-surface-muted)] p-3">
                <div className="flex items-center gap-2">
                  <Pulse className="h-8 w-8 rounded-lg" />
                  <div className="min-w-0 flex-1"><Pulse className="h-2.5 w-16 rounded-full" /><Pulse className="mt-2 h-5 w-12 rounded-md" /></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Attention list */}
        <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:rounded-[24px] sm:border sm:p-5">
          <Pulse className="h-5 w-32 rounded-md" />
          <div className="mt-3 divide-y divide-[color:var(--app-border)] rounded-xl border border-[color:var(--app-border)]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                <Pulse className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1"><Pulse className="h-3.5 w-36 rounded-full" /><Pulse className="mt-2 h-2.5 w-52 max-w-full rounded-full" /></div>
                <Pulse className="h-4 w-4 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        {/* Completion */}
        <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:rounded-[24px] sm:border sm:p-5">
          <div className="flex items-center gap-3">
            <Pulse className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1"><Pulse className="h-4 w-40 rounded-full" /><Pulse className="mt-3 h-1.5 w-full rounded-full" /><Pulse className="mt-2 h-2.5 w-72 max-w-full rounded-full" /></div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:rounded-[24px] sm:border sm:p-5">
          <div className="flex items-center justify-between"><Pulse className="h-5 w-36 rounded-md" /><Pulse className="h-3 w-20 rounded-full" /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2.5 rounded-xl border border-[color:var(--app-border)] p-2.5 sm:block sm:p-3">
                <Pulse className="h-9 w-9 shrink-0 rounded-xl sm:h-10 sm:w-10" />
                <div className="min-w-0 sm:mt-2.5"><Pulse className="h-3 w-20 max-w-full rounded-full" /><Pulse className="mt-2 hidden h-2.5 w-full rounded-full sm:block" /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Listing workspace */}
        <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border">
          <div className="border-b border-[color:var(--app-border)] px-3 pb-3 pt-4 sm:px-5">
            <Pulse className="h-2.5 w-28 rounded-full" />
            <Pulse className="mt-2 h-6 w-52 rounded-md" />
            <Pulse className="mt-3 h-10 w-full rounded-xl sm:w-36" />
          </div>
          <div className="px-3 pt-3 sm:px-5"><div className="flex gap-1 rounded-xl bg-[color:var(--app-surface-muted)] p-1"><Pulse className="h-9 w-28 rounded-lg" /><Pulse className="h-9 w-28 rounded-lg" /></div></div>
          <div className="flex gap-2 overflow-hidden border-b border-[color:var(--app-border)] px-3 py-3 sm:px-5"><Pulse className="h-9 w-20 shrink-0 rounded-full" /><Pulse className="h-9 w-24 shrink-0 rounded-full" /><Pulse className="h-9 w-20 shrink-0 rounded-full" /><Pulse className="ml-auto hidden h-10 w-28 rounded-xl sm:block" /></div>
          <div className="space-y-2 px-3 py-3 sm:px-5 sm:py-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2.5 rounded-xl border border-[color:var(--app-border)] p-2.5 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:gap-3 sm:p-3">
                <Pulse className="h-20 w-full rounded-lg sm:h-24" />
                <div className="min-w-0 self-center"><Pulse className="h-3.5 w-4/5 rounded-full" /><Pulse className="mt-2 h-2.5 w-16 rounded-full" /><Pulse className="mt-2 h-3 w-24 rounded-full" /><div className="mt-2 flex gap-3"><Pulse className="h-2.5 w-8 rounded-full" /><Pulse className="h-2.5 w-8 rounded-full" /><Pulse className="h-2.5 w-8 rounded-full" /></div></div>
                <Pulse className="hidden h-9 w-9 self-center rounded-full sm:block" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function ProfileViewSkeleton() {
  return (
    <div
      className="min-h-screen overflow-x-clip bg-[color:var(--app-surface-muted)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] dark:bg-[color:var(--app-surface)] sm:pb-8"
      data-skeleton-route="true"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="sticky top-0 z-30 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]/95 px-3 py-2 backdrop-blur sm:hidden">
        <div className="flex h-10 items-center gap-3"><Pulse className="h-9 w-9 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><Pulse className="h-2.5 w-20 rounded-full" /><Pulse className="mt-1.5 h-4 w-40 max-w-[65vw] rounded-full" /></div></div>
      </div>

      <main className="mx-auto w-full max-w-[1180px] space-y-3 px-0 py-0 sm:space-y-4 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <section className="overflow-hidden border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:rounded-[24px] sm:border">
          <div className="relative h-36 overflow-hidden sm:h-48 lg:h-56"><Pulse className="absolute inset-0 h-full w-full rounded-none" /><div className="absolute right-2.5 top-2.5 flex gap-2 sm:right-4 sm:top-4"><Pulse className="h-9 w-9 rounded-full sm:h-10 sm:w-10" /><Pulse className="h-9 w-9 rounded-full sm:h-10 sm:w-10" /></div></div>
          <div className="relative px-3 pb-4 sm:px-6 sm:pb-6">
            <div className="-mt-11 flex items-end gap-3 sm:-mt-14 sm:gap-4"><Pulse className="h-[88px] w-[88px] shrink-0 rounded-full ring-[4px] ring-[color:var(--app-surface-strong)] sm:h-28 sm:w-28 sm:ring-[5px]" /><div className="min-w-0 flex-1 pb-0.5 sm:pb-2"><Pulse className="h-6 w-44 max-w-[70%] rounded-lg sm:h-8 sm:w-64" /><Pulse className="mt-2 h-3 w-28 rounded-full" /></div></div>
            <div className="mt-3 flex gap-1.5 overflow-hidden"><Pulse className="h-6 w-24 shrink-0 rounded-full" /><Pulse className="h-6 w-40 shrink-0 rounded-full" /><Pulse className="hidden h-6 w-28 rounded-full sm:block" /></div>
            <div className="mt-3 space-y-2"><Pulse className="h-3.5 w-full max-w-[640px] rounded-full" /><Pulse className="h-3.5 w-[70%] max-w-[520px] rounded-full" /></div>
            <div className="mt-4 grid grid-cols-4 divide-x divide-[color:var(--app-border)] border-y border-[color:var(--app-border)] py-2.5 sm:max-w-2xl sm:rounded-xl sm:border sm:py-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="px-2 text-center"><Pulse className="mx-auto h-4 w-10 rounded-full" /><Pulse className="mx-auto mt-2 h-2.5 w-12 rounded-full" /></div>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex"><Pulse className="col-span-2 h-11 w-full rounded-xl sm:col-span-1 sm:w-32" /><Pulse className="h-11 w-full rounded-xl sm:w-28" /><Pulse className="h-11 w-full rounded-xl sm:w-28" /></div>
            <div className="-mx-3 mt-4 overflow-hidden border-t border-[color:var(--app-border)] px-3 pt-3 sm:mx-0 sm:px-0"><div className="flex gap-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex min-w-0 basis-[78%] shrink-0 items-center gap-2.5 rounded-xl bg-[color:var(--app-surface-muted)] px-3 py-2.5 min-[420px]:basis-[62%] sm:basis-[calc(50%-4px)] lg:basis-[calc(25%-6px)]"><Pulse className="h-8 w-8 rounded-lg" /><div className="min-w-0 flex-1"><Pulse className="h-2.5 w-16 rounded-full" /><Pulse className="mt-2 h-4 w-12 rounded-full" /></div></div>)}</div></div>
          </div>
        </section>

        <section className="border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:overflow-hidden sm:rounded-[24px] sm:border">
          <div className="flex h-12 gap-1 overflow-hidden border-b border-[color:var(--app-border)] px-2 sm:h-14 sm:px-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center px-3"><Pulse className="h-3 w-16 rounded-full" /></div>)}</div>
          <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-5 lg:p-5">
            <div className="min-w-0"><div className="flex gap-2 overflow-hidden"><Pulse className="h-9 w-20 shrink-0 rounded-full" /><Pulse className="h-9 w-24 shrink-0 rounded-full" /><Pulse className="h-9 w-20 shrink-0 rounded-full" /></div><div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <article key={index} className="overflow-hidden rounded-xl border border-[color:var(--app-border)]"><Pulse className="aspect-square w-full rounded-none" /><div className="p-2.5 sm:p-3"><Pulse className="h-3.5 w-full rounded-full" /><Pulse className="mt-2 h-3.5 w-3/4 rounded-full" /><Pulse className="mt-3 h-4 w-20 rounded-full" /><Pulse className="mt-3 h-8 w-full rounded-lg" /></div></article>)}</div></div>
            <aside className="hidden space-y-3 lg:block"><div className="rounded-2xl border border-[color:var(--app-border)] p-4"><Pulse className="h-4 w-20 rounded-full" /><SkeletonBlock lines={4} className="mt-3" /><Pulse className="mt-3 h-3 w-20 rounded-full" /></div><div className="rounded-2xl border border-[color:var(--app-border)] p-4"><Pulse className="h-4 w-20 rounded-full" /><Pulse className="mt-3 h-10 w-full rounded-xl" /><Pulse className="mt-2 h-10 w-full rounded-xl" /></div></aside>
          </div>
        </section>
      </main>
    </div>
  );
}

export function DriverConsoleSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-5', className)}>
      <section className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-3 w-28 rounded-full" />
        <Pulse className="mt-2 h-7 w-64 rounded-full" />
        <SkeletonBlock lines={2} className="mt-3 max-w-[520px]" />
      </section>

      <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-4 w-32 rounded-full" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Pulse className="h-10 w-full rounded-xl" />
          <Pulse className="h-10 w-full rounded-xl" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pulse className="h-10 w-28 rounded-xl" />
          <Pulse className="h-10 w-28 rounded-xl" />
          <Pulse className="h-10 w-32 rounded-xl" />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <Pulse className="h-4 w-40 rounded-full" />
        <div className="mt-3 space-y-2">
          <Pulse className="h-20 w-full rounded-2xl" />
          <Pulse className="h-20 w-full rounded-2xl" />
        </div>
      </section>
    </div>
  );
}