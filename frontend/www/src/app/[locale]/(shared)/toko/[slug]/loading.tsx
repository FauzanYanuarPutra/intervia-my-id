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
      className="min-h-screen bg-slate-50 pb-40 pt-3 dark:bg-slate-950 sm:pt-5 lg:pb-10"
      aria-busy="true"
      aria-label="Memuat profil usaha"
      data-testid="storefront-loading"
    >
      <div className="page-shell animate-pulse motion-reduce:animate-none">
        <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
          <Skeleton className="h-10 w-36" rounded="rounded-full" />
          <Skeleton className="hidden h-4 w-28 sm:block" />
        </div>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:rounded-[28px] lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="bg-slate-100 dark:bg-slate-800">
            <Skeleton
              className="aspect-[16/10] min-h-[250px] sm:min-h-[340px] lg:aspect-auto lg:min-h-[440px]"
              rounded="rounded-none"
            />
          </div>

          <div className="p-4 sm:p-6 lg:p-7">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28" rounded="rounded-full" />
              <Skeleton className="h-8 w-32" rounded="rounded-full" />
            </div>
            <Skeleton className="mt-5 h-10 w-4/5" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <div className="mt-6 space-y-4 border-y border-slate-100 py-4 dark:border-slate-800">
              {[0, 1, 2].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="mt-6 hidden h-12 w-full lg:block" />
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-64 max-w-full" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map(item => (
                <article
                  key={item}
                  className="overflow-hidden rounded-[20px] border border-slate-200 dark:border-slate-800"
                >
                  <Skeleton className="aspect-[4/3]" rounded="rounded-none" />
                  <div className="p-3.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-3 h-5 w-full" />
                    <Skeleton className="mt-2 h-4 w-2/3" />
                    <Skeleton className="mt-5 h-5 w-28" />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-6 w-40" />
              <div className="mt-5 space-y-5">
                {[0, 1, 2].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="mt-2 h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Skeleton className="h-32 w-full" rounded="rounded-[24px]" />
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-3 lg:hidden">
        <div className="mx-auto max-w-md rounded-[20px] border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-12 w-full" rounded="rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
