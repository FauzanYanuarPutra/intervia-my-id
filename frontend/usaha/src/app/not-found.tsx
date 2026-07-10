import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5efe3,#efe7d8)] px-4">
      <section className="w-full max-w-2xl rounded-[36px] border border-portal-line/80 bg-portal-paper p-10 text-center shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-portal-forest">
          Halaman tidak ditemukan
        </p>
        <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.06em] text-portal-ink">
          Route bisnis ini belum ada
        </h1>
        <p className="mt-4 text-base leading-8 text-portal-soft">
          Balik ke beranda usaha lalu pilih usaha yang sedang ingin dikelola.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-portal-forest px-5 text-sm font-semibold text-white"
        >
          Kembali ke beranda usaha
        </Link>
      </section>
    </main>
  );
}
