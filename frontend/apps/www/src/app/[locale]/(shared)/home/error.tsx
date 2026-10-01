'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[HOME_ROUTE_ERROR]', {
      message: error?.message || 'Unknown Home route error',
      digest: error?.digest || null,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-2xl items-center justify-center px-4 py-10">
      <section
        className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"
        role="alert"
      >
        <h1 className="text-xl font-black tracking-tight text-slate-950">
          Home sedang dimuat ulang
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Ada bagian Home yang belum siap. Data utama tidak dihapus; coba muat ulang bagian ini.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Coba lagi
          </button>
          <Link
            href="/home"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Ke Home
          </Link>
        </div>
      </section>
    </main>
  );
}
