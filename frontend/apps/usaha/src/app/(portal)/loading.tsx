export default function PortalLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="rounded-[22px] border border-portal-line/70 bg-white p-4 sm:p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-2.5 w-24 rounded-full bg-portal-mist" />
          <div className="h-6 w-56 rounded-lg bg-portal-mist" />
          <div className="h-3.5 w-full max-w-2xl rounded bg-portal-mist" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div key={item} className="rounded-[20px] border border-portal-line/70 bg-white p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-9 w-9 rounded-xl bg-portal-mist" />
              <div className="h-3 w-24 rounded bg-portal-mist" />
              <div className="h-6 w-32 rounded-lg bg-portal-mist" />
              <div className="h-3 w-4/5 rounded bg-portal-mist" />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-portal-line/70 bg-white">
        {[0, 1, 2, 3, 4].map(item => (
          <div key={item} className="border-b border-portal-line/70 px-4 py-4 last:border-b-0 sm:px-5">
            <div className="animate-pulse flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-portal-mist" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/5 rounded bg-portal-mist" />
                <div className="h-3 w-3/5 rounded bg-portal-mist" />
              </div>
              <div className="h-8 w-16 rounded-full bg-portal-mist" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
