import Link from 'next/link';
import { ArrowLeft, SearchX, Store } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 py-10 text-portal-ink">
      <section className="w-full max-w-xl rounded-[24px] border border-portal-line bg-white p-7 text-center shadow-card sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-portal-mist text-portal-forest"><SearchX className="h-6 w-6" /></div>
        <p className="portal-kicker mt-6">404 · Halaman tidak ditemukan</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em]">Halaman ini tidak tersedia.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-portal-soft">Route bisnis mungkin berubah atau usaha yang dipilih sudah tidak dapat diakses oleh akun ini.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/" className="portal-button-primary"><Store className="h-4 w-4" /> Beranda usaha</Link>
          <Link href="/businesses/new" className="portal-button-secondary"><ArrowLeft className="h-4 w-4" /> Buat usaha baru</Link>
        </div>
      </section>
    </main>
  );
}
