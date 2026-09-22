import Image from 'next/image';

export default function CrmLoginLoading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F9FAFB] px-3 py-4 sm:px-5" aria-busy="true" data-skeleton-route="true">
      <div className="w-full max-w-[920px]">
        <div className="mb-4 flex justify-center">
          <Image src="/logo.svg" alt="Lajukan" width={180} height={48} priority className="h-10 w-auto sm:h-12" />
        </div>
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="p-5 sm:p-7">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-8 w-36 animate-pulse rounded-xl bg-slate-200" />
            <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
            <div className="mt-6 h-11 w-full animate-pulse rounded-xl bg-slate-200" />
            <div className="mt-4 h-24 w-full animate-pulse rounded-2xl bg-slate-50" />
            <div className="mt-5 h-20 w-full animate-pulse rounded-2xl bg-slate-50" />
          </section>
          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-white" />)}
            </div>
            <div className="mt-5 h-9 w-full animate-pulse rounded-2xl bg-white" />
          </aside>
        </div>
      </div>
    </main>
  );
}
