import { Skeleton } from '@/components/ui/Skeleton';

export default function TokoLoading() {
  return (
    <main
      className="min-h-screen bg-white pb-8 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:bg-slate-50 sm:py-4 sm:dark:bg-slate-950 lg:py-6"
      aria-busy="true"
      aria-label="Memuat profil usaha"
      data-testid="storefront-loading"
      data-skeleton-route="true"
    >
      <div className="mx-auto w-full max-w-[960px] sm:px-4 lg:px-5">
        <section className="relative overflow-hidden bg-white dark:bg-slate-900 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm sm:dark:border-slate-800">
          <Skeleton variant="block" className="aspect-[8/3] w-full rounded-none" />

          <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5 md:px-6">
            <div className="flex items-start gap-3">
              <Skeleton
                variant="block"
                className="-mt-7 h-16 w-16 shrink-0 rounded-2xl ring-4 ring-white dark:-mt-8 dark:ring-slate-900 sm:h-[72px] sm:w-[72px] md:h-20 md:w-20"
              />
              <div className="min-w-0 flex-1 pt-2">
                <Skeleton className="h-7 w-56 max-w-[80%] rounded-lg sm:h-8 sm:w-64" />
                <Skeleton className="mt-1.5 h-3 w-24 rounded-full" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Skeleton variant="chip" className="h-6 w-24" />
              <Skeleton variant="chip" className="h-6 w-20" />
              <Skeleton variant="chip" className="h-6 w-36" />
            </div>

            <div className="mt-3 flex min-w-0 items-center gap-2 sm:gap-3">
              <Skeleton className="h-4 min-w-0 flex-1 rounded-full" />
              <Skeleton variant="chip" className="h-9 w-20 shrink-0" />
            </div>
          </div>
        </section>

        <section
          id="produk"
          className="mt-1.5 overflow-hidden bg-white dark:bg-slate-900 sm:mt-3 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm sm:dark:border-slate-800"
        >
          <div className="sticky top-0 z-30 border-y border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-t-3xl sm:border-t-0 sm:px-5 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>

            <div className="mt-2 flex gap-2 overflow-hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} variant="chip" className="h-8 w-20 shrink-0" />
              ))}
            </div>
          </div>

          <div className="scroll-mt-24">
            {Array.from({ length: 2 }).map((_, groupIndex) => (
              <section key={groupIndex} className="scroll-mt-24">
                <div
                  className={
                    groupIndex > 0
                      ? 'border-t-[7px] border-slate-50 px-4 pb-1 pt-4 dark:border-slate-950 sm:px-5 md:px-6'
                      : 'px-4 pb-1 pt-4 sm:px-5 md:px-6'
                  }
                >
                  <Skeleton className="h-5 w-32 rounded-lg" />
                </div>

                <div className="px-4 sm:px-5 md:grid md:grid-cols-2 md:gap-x-6 md:px-6">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <article
                      key={index}
                      className="flex min-w-0 gap-3 border-b border-slate-100 py-3.5 last:border-b-0 dark:border-slate-800 sm:gap-4 sm:py-4 md:min-h-[132px] md:last:border-b"
                    >
                      <Skeleton className="h-[84px] w-[84px] shrink-0 rounded-xl sm:h-24 sm:w-24 md:h-[104px] md:w-[104px] md:rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-4/5 rounded-full" />
                          <Skeleton className="h-4 w-3/5 rounded-full" />
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <Skeleton className="h-3.5 w-full rounded-full" />
                          <Skeleton className="h-3.5 w-4/5 rounded-full" />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Skeleton className="h-4 w-24 rounded-full" />
                          <Skeleton variant="chip" className="h-6 w-20" />
                        </div>
                        <Skeleton variant="chip" className="mt-2 h-9 w-24" />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-1.5 overflow-hidden border-y border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 sm:mt-3 sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 md:px-6">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        </section>
      </div>
    </main>
  );
}
