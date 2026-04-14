import Link from 'next/link';
import { Icon, IconEnum, LocalizedLink } from '@/components/ui-kit';
import { Z_INDEX } from '@/components/constants/z-index';

export default function NotFoundPage() {
  return (
    <div
      className="fixed top-0 bottom-0 left-0 right-0 z-[999999] flex flex-col items-center justify-center min-h-screen text-center px-4 bg-[color:var(--app-surface-strong)]"
      style={{ zIndex: Z_INDEX.notFound }}
    >
      <Icon
        name={IconEnum.AlertCircle}
        className="w-16 h-16 text-[color:var(--app-danger)] mb-4"
      />
      <h1 className="text-4xl font-semibold mb-2">404</h1>
      <p className="text-[color:var(--app-text)] mb-6">
        Halaman yang kamu cari tidak ditemukan.
      </p>
      <LocalizedLink
        href="/home"
        className="bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] px-6 py-3 rounded-lg hover:bg-[color:var(--app-accent)] transition"
      >
        Kembali ke Beranda
      </LocalizedLink>
    </div>
  );
}
