import { redirect } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, MapPinned, ShieldCheck, Store } from 'lucide-react';
import { getAuthenticatedActor } from '@/lib/business-server';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getAuthenticatedActor();
  if (account) redirect('/');

  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === 'string' && params.callbackUrl.startsWith('/') ? params.callbackUrl : '/';
  const error = typeof params.error === 'string' ? params.error : '';
  const googleHref = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-5 text-portal-ink sm:px-6 lg:grid lg:place-items-center lg:py-10">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-portal-line bg-white shadow-[0_28px_90px_-55px_rgba(15,23,42,.45)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative overflow-hidden bg-portal-forestDark p-7 text-white sm:p-10 lg:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[15px] bg-white text-portal-forest"><Store className="h-5 w-5" /></span>
              <div><p className="text-[11px] font-semibold text-white/55">Lajukan</p><p className="text-base font-bold">Usaha</p></div>
            </div>

            <h1 className="mt-10 max-w-2xl text-3xl font-bold tracking-[-0.055em] sm:text-5xl">Kelola usaha tanpa kehilangan fokus.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/65 sm:text-base">Profil, lokasi, katalog, pesanan, operasional, dan tim berada dalam satu workspace yang terhubung dengan akun Lajukan.</p>

            <div className="mt-9 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                [MapPinned, 'Lokasi & cabang', 'Jaga alamat dan pin tetap akurat.'],
                [CheckCircle2, 'Operasional', 'Pantau hal yang perlu ditindak.'],
                [ShieldCheck, 'Akses tim', 'Bagi peran sesuai tanggung jawab.'],
              ].map(([Icon, label, detail]) => {
                const IconComponent = Icon as typeof MapPinned;
                return (
                  <article key={String(label)} className="rounded-[18px] border border-white/10 bg-white/7 p-4">
                    <IconComponent className="h-5 w-5 text-emerald-200" />
                    <p className="mt-4 text-sm font-bold">{String(label)}</p>
                    <p className="mt-1 text-xs leading-5 text-white/55">{String(detail)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-9 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <span className="portal-icon-tile"><Building2 className="h-4 w-4" /></span>
            <p className="portal-kicker mt-5">Masuk ke workspace</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Lanjutkan dengan akun Lajukan</h2>
            <p className="mt-3 text-sm leading-6 text-portal-soft">Gunakan akun Google yang sama dengan Lajukan WWW. Kamu tidak perlu membuat akun usaha terpisah.</p>

            {error ? <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Login Google belum berhasil ({error}). Silakan coba lagi.</div> : null}

            {/* OAuth must remain a full-document navigation. */}
            <a href={googleHref} className="mt-7 flex min-h-12 w-full items-center justify-center gap-3 rounded-[14px] border border-portal-line bg-white px-4 text-sm font-bold text-portal-ink shadow-sm transition hover:border-portal-forest/25 hover:bg-portal-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/25">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-portal-line bg-white font-black text-[#4285F4]">G</span>
              Lanjutkan dengan Google
              <ArrowRight className="h-4 w-4 text-portal-soft" />
            </a>

            <p className="mt-5 text-center text-xs leading-5 text-portal-soft">Login Google akan membuat atau menghubungkan akun Lajukan melalui Identity Service.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
