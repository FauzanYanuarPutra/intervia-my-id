export default function PortalLoading() {
  return (
    <div
      className="space-y-4"
      aria-live="polite"
      aria-busy="true"
      data-skeleton-route="true"
    >
      <header className="rounded-[22px] border border-portal-line/70 bg-white p-4 sm:p-5">
        <div className="space-y-3">
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-portal-mist" />
          <div className="h-6 w-56 animate-pulse rounded-lg bg-portal-mist" />
          <div className="h-3.5 w-full max-w-2xl animate-pulse rounded bg-portal-mist" />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="rounded-[20px] border border-portal-line/70 bg-white p-4">
            <div className="space-y-3">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-portal-mist" />
              <div className="h-3 w-24 animate-pulse rounded bg-portal-mist" />
              <div className="h-6 w-32 animate-pulse rounded-lg bg-portal-mist" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-portal-mist" />
            </div>
          </article>
        ))}
      </section>

      <section className="merchant-surface-bordered overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line/70 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-portal-mist" />
            <div className="h-3 w-56 animate-pulse rounded bg-portal-mist" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-xl bg-portal-mist" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-b border-portal-line/70 px-4 py-4 last:border-b-0 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-portal-mist" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/5 animate-pulse rounded bg-portal-mist" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-portal-mist" />
              </div>
              <div className="h-8 w-16 animate-pulse rounded-full bg-portal-mist" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
