import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  MapPinned,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { getAuthenticatedActor } from '@/lib/business-server';

const benefits = [
  {
    icon: MapPinned,
    label: 'Lokasi & cabang',
    detail: 'Kelola alamat dan titik usaha dari satu tempat.',
  },
  {
    icon: CheckCircle2,
    label: 'Operasional',
    detail: 'Lihat hal penting yang perlu ditindak hari ini.',
  },
  {
    icon: ShieldCheck,
    label: 'Akses tim',
    detail: 'Atur siapa yang bisa melihat dan mengelola usaha.',
  },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getAuthenticatedActor();
  if (account) redirect('/');

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === 'string' && params.callbackUrl.startsWith('/')
      ? params.callbackUrl
      : '/';
  const error = typeof params.error === 'string' ? params.error : '';
  const googleHref = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-portal-ink lg:grid lg:place-items-center lg:px-6 lg:py-10">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl bg-white lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-portal-line lg:shadow-[0_32px_90px_-60px_rgba(15,23,42,.55)]">
        <section className="order-1 flex items-center px-5 py-8 sm:px-8 sm:py-10 lg:order-2 lg:px-10 lg:py-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-portal-forest text-white shadow-sm">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-portal-soft">
                  Lajukan
                </p>
                <p className="text-sm font-bold">Usaha</p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-portal-forest">
                Masuk ke workspace
              </p>
              <h1 className="mt-3 text-[2rem] font-bold leading-[1.08] tracking-[-0.045em] sm:text-[2.35rem]">
                Selamat datang kembali.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-portal-soft">
                Masuk dengan akun Google yang sama dengan Lajukan. Tidak perlu membuat akun usaha terpisah.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                Login Google belum berhasil ({error}). Silakan coba lagi.
              </div>
            ) : null}

            {/* OAuth must remain a full-document navigation. */}
            <a
              href={googleHref}
              className="group mt-7 flex min-h-14 w-full items-center rounded-2xl bg-portal-forest px-4 text-sm font-bold text-white shadow-[0_12px_30px_-18px_rgba(20,83,62,.8)] transition hover:bg-portal-forestDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/30 focus-visible:ring-offset-2"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-base font-black text-[#4285F4] shadow-sm">
                G
              </span>
              <span className="flex-1 text-center">Lanjutkan dengan Google</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/70 transition group-hover:translate-x-0.5" />
            </a>

            <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-portal-mist px-4 py-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />
              <p className="text-xs leading-5 text-portal-soft">
                Akun Lajukan yang sama dipakai untuk WWW dan Usaha, sehingga identitas serta akses bisnismu tetap terhubung.
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-portal-soft/80">
              Dengan melanjutkan, kamu masuk melalui Identity Service Lajukan.
            </p>
          </div>
        </section>

        <section className="order-2 px-5 pb-6 sm:px-8 sm:pb-8 lg:order-1 lg:flex lg:min-h-[600px] lg:flex-col lg:justify-between lg:bg-portal-forestDark lg:p-12 lg:text-white">
          <div className="hidden lg:block">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-portal-forest shadow-sm">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  Lajukan
                </p>
                <p className="text-base font-bold">Usaha</p>
              </div>
            </div>

            <h2 className="mt-14 max-w-lg text-[2.65rem] font-bold leading-[1.04] tracking-[-0.055em]">
              Fokus menjalankan usaha, bukan merapikan banyak aplikasi.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
              Profil, produk, lokasi, operasional, pesanan, dan tim tumbuh dalam satu workspace yang terhubung ke ekosistem Lajukan.
            </p>
          </div>

          <div className="grid gap-2.5 rounded-2xl border border-portal-line bg-white p-3.5 lg:mt-12 lg:gap-1 lg:border-white/10 lg:bg-white/[0.06] lg:p-2">
            {benefits.map(({ icon: Icon, label, detail }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-xl px-2 py-2.5 lg:px-3 lg:py-3"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest lg:bg-white/10 lg:text-emerald-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold lg:text-white">{label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-portal-soft lg:text-white/55">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
