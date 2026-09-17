export default function PortalLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f8f6] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:pl-[248px] lg:pr-6"
      aria-busy="true"
      aria-label="Memuat usaha"
    >
      <div className="mx-auto w-full max-w-[1600px] animate-pulse space-y-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="h-8 w-56 rounded-xl bg-slate-200" />
          <div className="h-4 max-w-md rounded-lg bg-slate-200" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-14 rounded-xl bg-white ring-1 ring-slate-200" />
          ))}
        </div>

        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200">
          <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 p-4">
                <div className="h-3 w-16 rounded-full bg-slate-200" />
                <div className="mt-2 h-5 w-24 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4 last:border-b-0">
              <div className="h-9 w-9 rounded-xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-1.5"><div className="h-3 w-1/3 rounded-full bg-slate-200" /><div className="h-2.5 w-1/2 rounded-full bg-slate-100" /></div>
              <div className="h-6 w-16 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
