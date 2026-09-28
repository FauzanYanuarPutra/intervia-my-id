import Link from 'next/link';
import { ArrowRight, Check, Package, Store, UsersRound } from 'lucide-react';

const steps = [
  {
    icon: Store,
    title: 'Buat profil usaha',
    description: 'Nama, lokasi, kontak, dan jam buka yang mudah dipercaya.',
  },
  {
    icon: Package,
    title: 'Tampilkan produk',
    description: 'Susun katalog yang bisa dilihat dan dibagikan pelanggan.',
  },
  {
    icon: UsersRound,
    title: 'Kerjakan usaha',
    description: 'Catat jualan, stok, uang, dan pekerjaan di satu tempat.',
  },
];

export function GuestLanding() {
  return (
    <main className="min-h-svh bg-[#f5f7f5] text-portal-ink">
      <header className="border-b border-portal-line/80 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-portal-forest text-white">
              <Store className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-portal-forest">Lajukan</span>
              <span className="block text-[15px] font-black tracking-[-0.035em] text-portal-ink">Usaha</span>
            </span>
          </Link>
          <Link href="/login" className="portal-button-ghost">Masuk</Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)] lg:items-center lg:gap-14 lg:py-20">
          <div className="max-w-2xl">
            <p className="portal-kicker">Business workspace Lajukan</p>
            <h1 className="mt-3 max-w-xl text-4xl font-black leading-[1.05] tracking-[-0.055em] text-portal-ink sm:text-5xl">
              Kelola usaha. Tampilkan produk. Dapatkan pelanggan.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-portal-soft sm:text-lg">
              Satu workspace sederhana untuk merapikan profil, katalog, jualan, stok, uang, dan pekerjaan harian usahamu.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href="/login?callbackUrl=%2Fbusinesses%2Fnew%3Fnew%3D1" className="portal-button-primary">
                Mulai gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="portal-button-secondary">Lihat workspace</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-portal-soft">
              {['Terhubung dengan akun Lajukan', 'Akses mengikuti peran tim', 'Tanpa password baru'].map(item => (
                <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-portal-forest" />{item}</span>
              ))}
            </div>
          </div>

          <section className="merchant-surface-bordered overflow-hidden" aria-label="Cara kerja Lajukan Usaha">
            <div className="border-b border-portal-line/70 bg-[#fafbf9] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[.12em] text-portal-forest">Mulai dari yang penting</p>
              <h2 className="mt-1 text-xl font-black tracking-[-.035em] text-portal-ink">Usahamu langsung punya arah.</h2>
            </div>
            <div className="divide-y divide-portal-line/70">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <div key={title} className="flex gap-3.5 px-5 py-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-portal-ink">{index + 1}. {title}</p>
                    <p className="mt-1 text-xs leading-5 text-portal-soft">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="border-t border-portal-line/80 py-8 sm:py-10">
          <div className="grid gap-5 sm:grid-cols-3">
            <div><p className="text-sm font-black text-portal-ink">Satu tempat untuk kerja harian</p><p className="mt-1 text-xs leading-5 text-portal-soft">Buka, jual, catat stok, dan cek uang tanpa berpindah-pindah alat.</p></div>
            <div><p className="text-sm font-black text-portal-ink">Tampilan usaha yang rapi</p><p className="mt-1 text-xs leading-5 text-portal-soft">Profil publik dan katalog siap dibagikan saat datanya sudah siap.</p></div>
            <div><p className="text-sm font-black text-portal-ink">Tumbuh dari tindakan kecil</p><p className="mt-1 text-xs leading-5 text-portal-soft">Workspace menunjukkan langkah berikutnya, bukan membanjiri dengan angka.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
