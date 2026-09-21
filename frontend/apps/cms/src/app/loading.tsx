export default function CmsLoading() {
  return (
    <main
      className="min-h-screen bg-[color:var(--color-background)] p-4 text-[color:var(--color-text)] md:p-6 lg:p-8"
      aria-busy="true"
      data-skeleton-route="true"
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-48 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-36 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <article key={i} className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
              <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-200" />
            </article>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50" />)}
            </div>
          </div>
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="h-5 w-36 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-50" />)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
