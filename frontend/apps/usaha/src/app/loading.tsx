export default function PortalLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f8f6] px-3 py-4 sm:px-5 lg:pl-[264px] lg:pr-6"
      aria-busy="true"
      aria-label="Memuat workspace usaha"
    >
      <div className="mx-auto w-full max-w-[1200px] animate-pulse space-y-5">
        <div className="h-5 w-32 rounded-full bg-slate-200" />
        <div className="h-10 max-w-lg rounded-2xl bg-slate-200" />
        <div className="h-5 max-w-2xl rounded-xl bg-slate-200" />
        <div className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-32 rounded-[20px] border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="h-72 rounded-[24px] border border-slate-200 bg-white" />
      </div>
    </main>
  );
}
