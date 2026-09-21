function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-portal-mist ${className}`} />; }
export default function ProductsLoading() {
  return <div className="space-y-4" aria-busy="true" aria-label="Memuat produk" data-skeleton-route="true">
    <header className="space-y-2"><Skeleton className="h-2.5 w-16 rounded-full" /><Skeleton className="h-7 w-52 rounded-lg" /><Skeleton className="h-3.5 w-full max-w-2xl" /></header>
    <section className="merchant-surface-bordered p-4 sm:p-5"><Skeleton className="h-3.5 w-36" /><Skeleton className="mt-2 h-3 w-full max-w-xl" /></section>
    <section className="flex flex-col gap-2 sm:flex-row"><Skeleton className="h-10 flex-1 rounded-xl" /><Skeleton className="h-10 w-full sm:w-24 rounded-xl" /><Skeleton className="h-10 w-full sm:w-24 rounded-xl" /></section>
    <section className="merchant-list border border-portal-line/80">{Array.from({ length: 7 }).map((_, index) => <article key={index} className="border-b border-portal-line/70 px-3 py-3 last:border-b-0 sm:px-4"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-2.5 w-1/4" /><div className="flex gap-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-16 rounded-full" /></div></div><Skeleton className="h-8 w-16 rounded-xl" /></div></article>)}</section>
  </div>;
}