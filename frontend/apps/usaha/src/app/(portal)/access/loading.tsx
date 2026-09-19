export default function AccessLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f8f6] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:pl-[248px] lg:pr-6"
      aria-busy="true"
      aria-label="Memuat akses"
    >
      <div className="mx-auto w-full max-w-[1120px] space-y-4 animate-pulse">
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="h-3 w-16 rounded-full bg-slate-200" />
          <div className="mt-2 h-6 w-44 rounded-lg bg-slate-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded-full bg-slate-100" />
        </section>
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 space-y-2">
            <div className="h-16 rounded-2xl bg-slate-100" />
            <div className="h-16 rounded-2xl bg-slate-100" />
          </div>
        </section>
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="h-4 w-40 rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="h-20 rounded-2xl bg-slate-100" />
          </div>
        </section>
      </div>
    </main>
  );
}
