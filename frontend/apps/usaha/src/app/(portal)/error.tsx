'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PortalError({ error, reset }: Props) {
  useEffect(() => {
    void error.digest;
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-8">
      <section className="merchant-surface-bordered p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-black text-portal-ink">Halaman belum bisa dimuat</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-portal-soft">
          Data usaha sedang bermasalah atau koneksi ke layanan belum siap. Coba muat ulang halaman.
        </p>
        <button type="button" onClick={reset} className="portal-button-primary mx-auto mt-5">
          <RefreshCw className="h-4 w-4" /> Coba lagi
        </button>
      </section>
    </div>
  );
}
