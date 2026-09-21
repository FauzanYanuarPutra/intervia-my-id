export default function PortalLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f8f6] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:pl-[248px] lg:pr-6"
      aria-busy="true"
      aria-label="Memuat usaha"
      data-skeleton-route="true"
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-lg bg-slate-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" />
            <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-h-14 animate-pulse rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="h-3 w-20 rounded-full bg-slate-200" />
              <div className="mt-2 h-4 w-28 rounded-lg bg-slate-200" />
            </div>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-h-14 animate-pulse rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="mx-auto h-5 w-20 rounded-full bg-slate-200 sm:mx-0" />
              <div className="mx-auto mt-2 h-3 w-28 rounded-full bg-slate-100 sm:mx-0" />
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-64 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-3.5 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200">
            <div className="p-4 sm:p-5">
              <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200">
            <div className="p-4 sm:p-5">
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-50 ring-1 ring-slate-100" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
