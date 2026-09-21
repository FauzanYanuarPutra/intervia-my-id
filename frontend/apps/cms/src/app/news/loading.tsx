export default function CmsNewsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--color-background)] p-4 text-[color:var(--color-text)] md:p-6 lg:p-8" aria-busy="true" data-skeleton-route="true">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded-full bg-slate-100" />
        </header>
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <div className="h-16 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />)}
          </aside>
          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap gap-2"><div className="h-7 w-24 animate-pulse rounded-full bg-slate-100" /><div className="h-7 w-28 animate-pulse rounded-full bg-slate-100" /></div>
              <div className="mt-4 h-7 w-3/4 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-3 h-4 w-56 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" /><div className="mt-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-50" />)}</div></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="h-5 w-32 animate-pulse rounded-lg bg-slate-200" /><div className="mt-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-50" />)}</div></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
