function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-portal-mist ${className}`} />;
}
function ActivityRows() {
  return (
    <section>
      <div className="mb-2.5 space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
      <div className="merchant-list border border-portal-line/80">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="merchant-action-row">
            <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3.5 w-3/5" /><Skeleton className="h-2.5 w-24" /></div>
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
export default function PortalLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true" data-skeleton-route="true">
      <header className="space-y-2"><Skeleton className="h-2.5 w-20 rounded-full" /><Skeleton className="h-7 w-56 rounded-lg" /><Skeleton className="h-3.5 w-72 max-w-full" /></header>
      <section className="grid grid-cols-3 gap-2" aria-hidden="true"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-14 rounded-2xl" /></section>
      <section className="grid gap-2 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => <article key={index} className="merchant-surface-bordered p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-6 w-24 rounded-lg" /><Skeleton className="mt-2 h-2.5 w-28" /></article>)}
      </section>
      <section className="merchant-surface-bordered overflow-hidden" aria-hidden="true">
        <div className="flex items-start gap-3 p-4 sm:p-5"><Skeleton className="h-10 w-10 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-2.5 w-28" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full max-w-2xl" /></div><Skeleton className="h-9 w-20 shrink-0 rounded-xl" /></div>
      </section>
      <ActivityRows />
    </div>
  );
}