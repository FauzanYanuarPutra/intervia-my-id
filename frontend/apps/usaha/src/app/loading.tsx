export default function PortalLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f8f6] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:pl-[248px] lg:pr-6"
      aria-busy="true"
      aria-label="Memuat usaha"
    >
      <div className="mx-auto w-full max-w-[1120px] space-y-4 animate-pulse">
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="relative h-28 bg-slate-200 sm:h-36 lg:h-40" />
          <div className="px-3 pb-4 sm:px-5 sm:pb-5">
            <div className="-mt-10 flex items-end gap-3 sm:-mt-12 sm:gap-4">
              <div className="h-20 w-20 shrink-0 rounded-full bg-slate-300 ring-[4px] ring-white sm:h-24 sm:w-24 sm:ring-[5px]" />
              <div className="min-w-0 flex-1 pb-1">
                <div className="h-6 w-48 max-w-[72%] rounded-lg bg-slate-200 sm:h-7 sm:w-64" />
                <div className="mt-2 h-3 w-40 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3.5 w-full max-w-[640px] rounded-full bg-slate-100" />
              <div className="h-3.5 w-3/5 max-w-[460px] rounded-full bg-slate-100" />
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 py-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="px-2 text-center">
                  <div className="mx-auto h-4 w-10 rounded-full bg-slate-200" />
                  <div className="mx-auto mt-2 h-2.5 w-16 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
              <div className="h-11 w-full rounded-xl bg-slate-200 sm:w-32" />
              <div className="h-11 w-full rounded-xl bg-slate-200 sm:w-24" />
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="h-7 w-20 rounded-full bg-slate-100" />
              <div className="h-7 w-20 rounded-full bg-slate-100" />
              <div className="h-7 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          <div className="grid grid-cols-2 divide-x divide-slate-200 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 p-4">
                <div className="h-3 w-16 rounded-full bg-slate-200" />
                <div className="mt-2 h-5 w-24 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4 last:border-b-0">
              <div className="h-9 w-9 rounded-xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded-full bg-slate-200" />
                <div className="h-2.5 w-1/2 rounded-full bg-slate-100" />
              </div>
              <div className="h-4 w-16 rounded-full bg-slate-100" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
