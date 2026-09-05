import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  ShieldCheck,
  Store,
  UsersRound,
} from 'lucide-react';

import { getAuthenticatedActor } from '@/lib/business-server';

type LoginPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

const loginBenefits = [
  {
    icon: PackageCheck,
    title: 'Produk & stok terhubung',
    description:
      'Kelola katalog dan stok usaha yang terhubung dengan ekosistem Lajukan.',
  },
  {
    icon: Store,
    title: 'Satu tempat untuk operasional',
    description:
      'Pantau usaha, lokasi, pesanan, dan aktivitas penting tanpa berpindah aplikasi.',
  },
  {
    icon: UsersRound,
    title: 'Akses tim lebih teratur',
    description:
      'Kelola peran dan akses anggota sesuai tanggung jawab masing-masing.',
  },
] as const;

function GoogleBrandIcon({
  className = '',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.73-.07-1.43-.19-2.1H12v3.98h5.38a4.6 4.6 0 0 1-2 3.02v2.58h3.24c1.9-1.75 2.98-4.33 2.98-7.48Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.58c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.67A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.83A6 6 0 0 1 6.08 12c0-.64.11-1.26.32-1.83V7.5H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.5l3.35-2.67Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.05c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.97 3.08 14.7 2 12 2a10 10 0 0 0-8.95 5.5l3.35 2.67c.79-2.36 3-4.12 5.6-4.12Z"
      />
    </svg>
  );
}

function safeCallbackUrl(
  value: string | string[] | undefined,
) {
  if (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
  ) {
    return value;
  }

  return '/';
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const account = await getAuthenticatedActor();

  if (account) {
    redirect('/');
  }

  const params = await searchParams;

  const callbackUrl = safeCallbackUrl(
    params.callbackUrl,
  );

  const error =
    typeof params.error === 'string'
      ? params.error
      : '';

  const googleHref =
    `/api/auth/google?callbackUrl=${encodeURIComponent(
      callbackUrl,
    )}`;

  return (
    <main className="min-h-svh overflow-x-hidden bg-[#f5f7f3] text-portal-ink">
      <div className="mx-auto grid min-h-svh w-full max-w-[1180px] grid-rows-[auto_1fr] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* HEADER */}
        <header className="flex min-h-11 items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-portal-forest text-white shadow-sm">
              <Store className="h-[18px] w-[18px]" />
            </span>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black tracking-[-0.035em]">
                  Lajukan
                </span>

                <span className="rounded-md bg-portal-mist px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-portal-forest">
                  Usaha
                </span>
              </div>

              <p className="mt-0.5 text-[10px] font-medium text-portal-soft">
                Workspace bisnis Lajukan
              </p>
            </div>
          </div>

          <a
            href={
              process.env.NEXT_PUBLIC_WWW_URL ||
              'https://www.lajukan.com'
            }
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-portal-line bg-white px-3 text-xs font-bold text-portal-soft shadow-sm transition hover:border-portal-forest/25 hover:text-portal-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/25"
          >
            Ke Lajukan
          </a>
        </header>

        {/* CONTENT */}
        <div className="grid min-h-0 content-start gap-5 py-5 sm:py-7 lg:grid-cols-[minmax(0,1fr)_440px] lg:content-center lg:gap-10">
          {/* DESKTOP HERO */}
          <aside className="relative hidden min-h-[560px] overflow-hidden rounded-2xl bg-[#102018] p-8 text-white shadow-[0_30px_80px_-44px_rgba(15,32,24,0.62)] lg:flex lg:flex-col lg:justify-between">
            {/* decorative shapes */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/[0.06] bg-white/[0.025]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-80 rounded-full bg-emerald-400/[0.04]"
            />

            <div className="relative max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-[#80e3a5]">
                <ShieldCheck className="h-4 w-4" />
                Satu akun Lajukan
              </div>

              <h1 className="mt-6 max-w-[520px] text-[2.5rem] font-bold leading-[1.08] tracking-[-0.035em] text-white">
                Jalankan usahamu dari satu workspace.
              </h1>

              <p className="mt-4 max-w-[520px] text-[15px] font-medium leading-7 text-white/70">
                Lajukan Usaha membantu menghubungkan
                profil bisnis, produk, stok,
                operasional, pesanan, dan tim ke dalam
                satu sistem yang lebih teratur.
              </p>
            </div>

            <div className="relative mt-8 border-t border-white/15">
              {loginBenefits.map(
                (
                  {
                    icon: Icon,
                    title,
                    description,
                  },
                  index,
                ) => (
                  <div
                    key={title}
                    className={`flex items-start gap-3.5 py-4 ${
                      index > 0
                        ? 'border-t border-white/10'
                        : ''
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1d4a30] text-[#80e3a5]">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">
                        {title}
                      </span>

                      <span className="mt-1 block max-w-lg text-xs font-medium leading-5 text-white/65">
                        {description}
                      </span>
                    </span>
                  </div>
                ),
              )}
            </div>
          </aside>

          {/* LOGIN AREA */}
          <section className="mx-auto flex w-full max-w-[440px] flex-col justify-center">
            {/* MOBILE INTRO */}
            <div className="mb-5 lg:hidden">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-portal-forest">
                Lajukan Usaha
              </p>

              <h1 className="mt-2 max-w-sm text-[1.8rem] font-bold leading-[1.12] tracking-[-0.035em]">
                Kelola usahamu dengan akun Lajukan.
              </h1>

              <p className="mt-2 max-w-md text-xs font-medium leading-5 text-portal-soft">
                Gunakan akun yang sama dengan Lajukan
                WWW. Tidak perlu membuat akun usaha
                terpisah.
              </p>
            </div>

            {/* LOGIN CARD */}
            <div className="rounded-2xl border border-portal-line bg-white p-5 shadow-[0_26px_70px_-44px_rgba(15,23,42,0.34)] sm:p-7">
              <div>
                <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-portal-mist px-3 py-1.5 text-xs font-bold text-portal-forest">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Akses aman
                </span>

                <h2 className="text-[1.65rem] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[1.9rem]">
                  Masuk ke Lajukan Usaha
                </h2>

                <p className="mt-2 max-w-md text-[13px] font-medium leading-5 text-portal-soft sm:text-sm sm:leading-6">
                  Lanjutkan dengan Google untuk membuka
                  workspace bisnis yang terhubung dengan
                  akun Lajukan kamu.
                </p>
              </div>

              {/* ERROR */}
              {error ? (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold leading-6 text-red-700"
                >
                  Login Google belum berhasil
                  {error ? ` (${error})` : ''}. Silakan
                  coba lagi.
                </div>
              ) : null}

              {/* GOOGLE CTA */}
              <a
                href={googleHref}
                className="group mt-5 flex min-h-14 w-full items-center gap-3 rounded-lg border border-[#0f783a] bg-[#128a45] px-3.5 py-2 text-sm font-bold text-white shadow-[0_16px_28px_-18px_rgba(18,138,69,0.72)] transition hover:bg-[#0f783a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128a45]/30 focus-visible:ring-offset-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
                  <GoogleBrandIcon className="h-[18px] w-[18px]" />
                </span>

                <span className="min-w-0 flex-1 text-left leading-5">
                  Lanjutkan dengan Google
                </span>

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>

              {/* TRUST INFO */}
              <div className="mt-4 rounded-lg border border-portal-line bg-[#f7f8f5] px-3">
                {[
                  'Tidak perlu membuat password baru',
                  'Gunakan akun Google yang sama dengan Lajukan WWW',
                  'Akses usaha tetap terhubung dengan identitas Lajukan',
                ].map(item => (
                  <div
                    key={item}
                    className="flex min-h-11 items-start gap-2.5 border-b border-portal-line py-2.5 text-xs font-semibold leading-5 text-portal-soft last:border-b-0"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />

                    <span className="min-w-0 flex-1">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* HELPER */}
              <div className="mt-5 flex items-start gap-2.5 border-t border-portal-line pt-4 text-xs font-medium leading-5 text-portal-soft">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />

                <p className="min-w-0 flex-1">
                  Jika akun belum memiliki workspace
                  usaha, Lajukan akan mengarahkan kamu
                  ke proses penyiapan usaha setelah
                  berhasil masuk.
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <p className="mt-4 text-center text-[10px] font-medium leading-4 text-portal-soft">
              Autentikasi dikelola melalui Identity
              Service Lajukan.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}