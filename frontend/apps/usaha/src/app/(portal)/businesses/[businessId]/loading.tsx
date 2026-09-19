function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} />;
}

export default function BusinessLoading() {
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:pl-[248px] lg:pr-6" aria-busy="true" aria-label="Memuat halaman usaha">
      <div className="mx-auto w-full max-w-[1120px] space-y-4">
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <Pulse className="h-24 w-full rounded-none sm:h-28" />
          <div className="px-3 pb-4 sm:px-5 sm:pb-5">
            <div className="-mt-7 flex items-end gap-3 sm:-mt-9"><Pulse className="h-16 w-16 shrink-0 rounded-full ring-[4px] ring-white sm:h-20 sm:w-20" /><div className="min-w-0 flex-1 pb-1"><Pulse className="h-5 w-40 rounded-lg sm:h-6 sm:w-56" /><Pulse className="mt-2 h-3 w-32 rounded-full" /></div></div>
            <Pulse className="mt-4 h-3.5 w-full max-w-[560px] rounded-full" />
            <Pulse className="mt-2 h-3.5 w-3/5 max-w-[420px] rounded-full" />
          </div>
        </section>
        <section><div className="flex gap-2 overflow-hidden"><Pulse className="h-10 w-24 shrink-0 rounded-full" /><Pulse className="h-10 w-28 shrink-0 rounded-full" /><Pulse className="h-10 w-24 shrink-0 rounded-full" /></div></section>
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><Pulse className="h-10 w-10 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><Pulse className="h-4 w-36 rounded-full" /><Pulse className="mt-2 h-3 w-full max-w-[560px] rounded-full" /><Pulse className="mt-2 h-3 w-3/4 max-w-[420px] rounded-full" /></div></div></section>
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5"><div className="h-4 w-28 rounded-full bg-slate-200" /><div className="mt-4 space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="flex min-h-14 items-center gap-3 border-b border-slate-100 last:border-b-0"><Pulse className="h-9 w-9 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><Pulse className="h-3 w-40 rounded-full" /><Pulse className="mt-2 h-2.5 w-28 rounded-full" /></div><Pulse className="h-7 w-16 rounded-full" /></div>)}</div></section>
      </div>
    </main>
  );
}
