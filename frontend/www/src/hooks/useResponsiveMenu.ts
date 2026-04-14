// Di dalam file hooks/useResponsiveMenu.ts

import { useEffect } from 'react';

// Tentukan breakpoint 'lg' Tailwind CSS (default 1024px)
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';

export function useResponsiveMenu(onClose: () => void) {
  useEffect(() => {
    // Gunakan 1024px agar menu tertutup TEPAT saat navigasi desktop muncul.
    const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY); // Fungsi handler

    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        // Jika layar menjadi LEBIH BESAR dari 1024px, tutup menu mobile
        onClose();
      }
    }; // Panggil handler sekali saat inisialisasi untuk memastikan menu tertutup jika sudah di desktop

    // (Penting: Jika Anda tidak ingin ini, hapus bagian ini)
    if (mql.matches) {
      onClose();
    }

    mql.addEventListener('change', handler); // Cleanup

    return () => mql.removeEventListener('change', handler);
  }, [onClose]);
}
