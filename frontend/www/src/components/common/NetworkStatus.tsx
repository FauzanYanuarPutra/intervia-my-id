'use client';

import { useEffect, useState } from 'react';
import { Z_INDEX } from '../constants/z-index';

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] flex justify-center px-3"
      style={{ zIndex: Z_INDEX.offline }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto max-w-md rounded-full border border-amber-300/70 bg-amber-50/95 px-4 py-2 text-center text-xs font-bold text-amber-950 shadow-lg backdrop-blur dark:border-amber-200/30 dark:bg-amber-950/92 dark:text-amber-100">
        Koneksi terputus. Beberapa data yang sudah tampil mungkin tetap
        tersedia; aksi online perlu koneksi.
      </div>
    </div>
  );
}
