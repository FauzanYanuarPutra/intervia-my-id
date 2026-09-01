'use client';

import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

type PortalRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function PortalRouteError({ reset }: PortalRouteErrorProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f6] px-4 py-10 text-portal-ink">
      <section
        className="portal-panel w-full max-w-xl p-6 sm:p-8"
        aria-labelledby="portal-error-title"
      >
        <span className="portal-icon-tile h-12 w-12 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="portal-kicker mt-6">Koneksi layanan</p>
        <h1
          id="portal-error-title"
          className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:text-3xl"
        >
          Workspace belum bisa dimuat
        </h1>
        <p className="mt-3 text-sm leading-7 text-portal-soft">
          Data usahamu tidak diubah. Periksa koneksi lalu coba muat kembali.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={reset} className="portal-button-primary">
            <RotateCcw className="h-4 w-4" /> Coba lagi
          </button>
          <Link href="/" className="portal-button-secondary">
            <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
