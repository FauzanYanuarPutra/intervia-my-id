export default function CrmLoading() {
  return (
    <main className="min-h-[100dvh] bg-[#F9FAFB] text-slate-950" aria-busy="true" data-skeleton-route="true">
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[240px] shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-6 space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="min-h-[64px] border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-5 w-44 animate-pulse rounded-lg bg-slate-200" />
          </header>
          <div className="p-4 sm:p-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" /><div className="mt-3 h-8 w-64 animate-pulse rounded-xl bg-slate-200" /><div className="mt-2 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" /></section>
            <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <article key={i} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" /><div className="mt-3 h-7 w-20 animate-pulse rounded-lg bg-slate-200" /><div className="mt-2 h-3 w-32 animate-pulse rounded-full bg-slate-100" /></article>)}</section>
            <section className="mt-4 grid gap-4 xl:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5"><div className="h-5 w-36 animate-pulse rounded-lg bg-slate-200" /><div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-14 animate-pulse rounded-2xl bg-slate-50" />)}</div></div>)}</section>
            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="h-11 animate-pulse bg-slate-50" />{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse border-t border-slate-100" />)}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
