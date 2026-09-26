export default function ManageContentLoading() {
  return (
    <main className="page-shell py-5 sm:py-7">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-100 dark:bg-white/6" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/6"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
