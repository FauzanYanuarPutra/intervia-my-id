function Skeleton({
  className = '',
  rounded = 'rounded-xl',
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${rounded} bg-slate-200/80 dark:bg-slate-800 ${className}`}
    />
  );
}

export default function TokoLoading() {
  return (
    <main
      className="min-h-screen bg-slate-50 pb-10 pt-3 dark:bg-slate-950 sm:pt-5"
      aria-busy="true"
      aria-label="Memuat profil usaha"
      data-testid="storefront-loading"
    >
      <div className="page-shell animate-pulse motion-reduce:animate-none">
        <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
          <Skeleton className="h-9 w-36" rounded="rounded-full" />
          <Skeleton className="hidden h-4 w-28 sm:block" />
        </div>

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:rounded-[26px]">
          <Skeleton className="aspect-[8/3] w-full" rounded="rounded-none" />
          <div className="relative px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <Skeleton
                className="-mt-8 h-20 w-20 shrink-0 border-[3px] border-white dark:border-slate-900 sm:-mt-10 sm:h-24 sm:w-24"
                rounded="rounded-2xl"
              />
              <div className="min-w-0 flex-1 pt-3 sm:pt-4">
                <Skeleton className="h-7 w-56 max-w-[80%] sm:h-9" />
                <div className="mt-2 flex gap-2">
                  <Skeleton className="h-7 w-24" rounded="rounded-full" />
                  <Skeleton className="h-7 w-28" rounded="rounded-full" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-4 h-10 w-32" rounded="rounded-full" />
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="mt-2 h-4 w-48 max-w-[80%]" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="mt-3 flex gap-2 overflow-hidden">
                {[0, 1, 2].map(item => (
                  <Skeleton
                    key={item}
                    className="h-8 w-24 shrink-0"
                    rounded="rounded-full"
                  />
                ))}
              </div>
            </div>

            <div className="px-4 pb-2 sm:px-5">
              {[0, 1].map(group => (
                <section
                  key={group}
                  className="border-b border-slate-100 py-4 last:border-b-0 dark:border-slate-800"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[0, 1, 2].map(item => (
                      <article
                        key={item}
                        className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-5 w-4/5" />
                          <Skeleton className="mt-2 h-4 w-full" />
                          <Skeleton className="mt-2 h-4 w-20" />
                          <Skeleton className="mt-3 h-9 w-20" rounded="rounded-full" />
                        </div>
                        <Skeleton
                          className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
                          rounded="rounded-2xl"
                        />
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-5 w-24" />
              <div className="mt-3 space-y-4">
                {[0, 1, 2].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 shrink-0" rounded="rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="mt-2 h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Skeleton className="h-24 w-full" rounded="rounded-[22px]" />
          </aside>
        </div>
      </div>
    </main>
  );
}
