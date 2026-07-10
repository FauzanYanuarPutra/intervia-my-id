import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Performance Dashboard',
  description: 'Local diagnostics for Core Web Vitals and interaction performance.',
};

export default function PerformanceDashboardPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.48)]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
          Performance
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Local performance cockpit
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Buka halaman ini untuk melihat data Web Vitals yang sedang terekam di session
          browser. Untuk cek interaksi berat, gunakan DevTools Performance dan klik elemen yang
          bikin INP naik, lalu bandingkan dengan daftar metrics yang tersimpan di session.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
            Quick checks
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>• Tes search, klik marker, buka modal crop, dan scroll page panjang.</li>
            <li>• Pantau `window.__LAJUKAN_WEB_VITALS__` di console untuk nilai terbaru.</li>
            <li>• Buka React DevTools Profiler kalau mau cari rerender yang mahal.</li>
          </ul>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
            Security baseline
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>• CSP dan security headers aktif lewat proxy middleware.</li>
            <li>• Route auth diproteksi dengan rate limit dan device fingerprint.</li>
            <li>• Form/report/listing moderation mengikuti pola auditable, bukan hard delete.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
