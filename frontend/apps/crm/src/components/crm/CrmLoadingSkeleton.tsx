import Image from 'next/image';

export function CrmLoadingSkeleton() {
  return (
    <div
      className="dashboard-shell bg-[#F9FAFB] text-slate-950"
      aria-busy="true"
      aria-label="Memuat Lajukan CRM"
      data-skeleton-route="true"
    >
      <div className="flex h-full min-h-0">
        <aside className="hidden w-[232px] shrink-0 border-r border-slate-200 bg-white p-3 lg:block">
          <div className="flex h-11 items-center">
            <Image
              src="/logo.svg"
              alt="Lajukan"
              width={240}
              height={64}
              priority
              className="h-11 w-auto max-w-[180px] object-contain"
            />
          </div>
          <div className="mt-4 h-9 animate-pulse rounded-xl bg-slate-100" />
          <div className="mt-4 space-y-1.5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-4 lg:px-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-100 bg-white p-1 lg:hidden">
              <Image src="/logo.svg" alt="Lajukan" width={96} height={28} className="h-5 w-auto object-contain" />
            </div>
            <div className="flex shrink-0 items-center sm:hidden">
              <Image
                src="/logo.svg"
                alt="Lajukan"
                width={240}
                height={64}
                priority
                className="h-7 w-auto max-w-[108px] object-contain"
              />
            </div>
            <div className="hidden h-7 w-20 animate-pulse rounded-lg bg-slate-200 sm:block" />
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-slate-100" />
            <div className="hidden h-10 w-24 animate-pulse rounded-xl bg-slate-100 sm:block" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
          </header>

          <main className="min-h-0 flex-1 overflow-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
            <div className="mx-auto max-w-[1360px] space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
                    <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-12 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-slate-200" />
                      <div className="min-w-0 flex-1">
                        <div className="h-3.5 w-40 max-w-[72%] animate-pulse rounded bg-slate-200" />
                        <div className="mt-1.5 h-3 w-56 max-w-[88%] animate-pulse rounded bg-slate-100" />
                      </div>
                      <div className="h-6 w-8 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2">
                  <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1.5 h-3 w-60 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-7 w-12 animate-pulse rounded-lg bg-slate-200" />
                      <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="px-4 py-3">
                      <div className="h-3.5 w-44 max-w-[70%] animate-pulse rounded bg-slate-200" />
                      <div className="mt-1.5 h-3 w-72 max-w-[92%] animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
