import { redirect } from 'next/navigation';
import { Building2, CheckCircle2, MapPinned, ShieldCheck } from 'lucide-react';
import { getAuthenticatedActor } from '@/lib/business-server';

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,106,67,0.16),transparent_38%),linear-gradient(180deg,#f8f2e5_0%,#efe7d8_100%)] px-4 py-8 text-portal-ink sm:px-6 lg:py-14">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-portal-line/70 bg-white/85 shadow-[0_32px_90px_-48px_rgba(31,41,55,.35)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="p-6 sm:p-9 lg:p-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-portal-forest px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
            <Building2 className="h-4 w-4" /> Lajukan Usaha
          </span>
          <h1 className="mt-6 max-w-xl text-3xl font-bold tracking-[-0.055em] sm:text-5xl">
            Jalankan usahamu dari satu workspace.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-portal-soft sm:text-base">
            Profil, lokasi, katalog, pesanan, operasional, dan tim memakai akun Lajukan yang sama—tanpa membuat akun usaha kedua.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              [MapPinned, 'Lokasi & cabang'],
              [CheckCircle2, 'Operasional'],
              [ShieldCheck, 'Akses tim'],
            ].map(([Icon, label]) => {
              const IconComponent = Icon as typeof MapPinned;
              return (
                <div
                  key={String(label)}
                  className="rounded-[20px] border border-portal-line/70 bg-portal-sand/30 p-4"
                >
                  <IconComponent className="h-5 w-5 text-portal-forest" />
                  <p className="mt-3 text-sm font-bold">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="flex items-center bg-portal-sand/35 p-6 sm:p-9 lg:p-12">
          <div className="w-full rounded-[26px] border border-portal-line/70 bg-white p-5 sm:p-6">
            <p className="portal-kicker">Masuk ke workspace</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em]">
              Lanjutkan dengan akun Lajukan
            </h2>
            <p className="mt-2 text-sm leading-6 text-portal-soft">
              Google akan menghubungkan akun yang sama dengan WWW melalui Identity Service.
            </p>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                Login Google belum berhasil ({error}). Coba lagi.
              </p>
            ) : null}

            {/*
              OAuth start endpoints must use a full-document navigation. Next's
              client router/prefetch can follow the 302 as a fetch and turn the
              cross-origin Google redirect into a CORS preflight (OPTIONS), which
              accounts.google.com correctly rejects with 405.
            */}
            <a
              href={googleHref}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-portal-line bg-white px-4 text-sm font-bold shadow-sm transition hover:bg-portal-sand/40"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-portal-line font-black text-[#4285F4]">
                G
              </span>
              Lanjutkan dengan Google
            </a>

            <p className="mt-5 text-center text-xs leading-5 text-portal-soft">
              Belum punya akun? Login Google akan membuat atau menghubungkan akun Lajukan secara aman.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
