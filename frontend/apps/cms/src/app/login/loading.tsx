export default function CmsLoginLoading() {
  return (
    <main className="min-h-screen grid place-items-center p-4" aria-busy="true" data-skeleton-route="true">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 h-11 w-full animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-4 h-20 w-full animate-pulse rounded-lg bg-slate-50" />
        <div className="mt-6 h-3 w-28 animate-pulse rounded-full bg-slate-100 mx-auto" />
      </div>
    </main>
  );
}
