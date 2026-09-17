import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, ShieldCheck, Store } from 'lucide-react';
import { getAuthenticatedActor } from '@/lib/business-server';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function GoogleBrandIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#4285F4" d="M21.6 12.23c0-.73-.07-1.43-.19-2.1H12v3.98h5.38a4.6 4.6 0 0 1-2 3.02v2.58h3.24c1.9-1.75 2.98-4.33 2.98-7.48Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.58c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.67A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.83A6 6 0 0 1 6.08 12c0-.64.11-1.26.32-1.83V7.5H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.5l3.35-2.67Z" />
      <path fill="#EA4335" d="M12 6.05c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.97 3.08 14.7 2 12 2a10 10 0 0 0-8.95 5.5l3.35 2.67c.79-2.36 3-4.12 5.6-4.12Z" />
    </svg>
  );
}

function safeCallbackUrl(value: string | string[] | undefined) {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const account = await getAuthenticatedActor();
  if (account) redirect('/');

  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const error = typeof params.error === 'string' ? params.error : '';
  const googleHref = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'https://www.lajukan.com';

  return (
    <main className="min-h-svh bg-[#f7f8f6] px-4 py-5 text-portal-ink sm:px-6">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[440px] flex-col">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <a href={wwwUrl} className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-portal-forest text-white">
              <Store className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[-0.03em]">Lajukan Usaha</span>
              <span className="block text-[10px] font-semibold text-portal-soft">Kelola usaha sehari-hari</span>
            </span>
          </a>
          <a href={wwwUrl} className="text-xs font-bold text-portal-soft transition hover:text-portal-forest">Lajukan.com</a>
        </header>

        <section className="my-auto py-8">
          <div className="merchant-surface-bordered p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,.35)] sm:p-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-portal-mist px-3 py-1.5 text-[11px] font-bold text-portal-forest">
              <ShieldCheck className="h-3.5 w-3.5" /> Akun Lajukan
            </span>
            <h1 className="mt-4 text-[28px] font-black leading-tight tracking-[-0.045em]">Masuk ke Lajukan Usaha</h1>
            <p className="mt-2 text-sm leading-6 text-portal-soft">Gunakan akun Google yang sama dengan akun Lajukan kamu.</p>

            {error ? (
              <div role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-semibold leading-5 text-red-700">
                Login belum berhasil. Coba lagi{error ? ` (${error})` : ''}.
              </div>
            ) : null}

            <a
              href={googleHref}
              className="group mt-5 flex min-h-14 w-full items-center gap-3 rounded-xl bg-portal-forest px-3.5 text-sm font-black text-white transition hover:bg-portal-forestDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/30 focus-visible:ring-offset-2"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <GoogleBrandIcon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1 text-left">Lanjutkan dengan Google</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>

            <div className="mt-5 divide-y divide-portal-line/70 border-t border-portal-line/70">
              {[
                'Tidak perlu membuat password baru',
                'Akses usaha mengikuti peran yang diberikan',
                'Satu akun untuk Lajukan dan Lajukan Usaha',
              ].map(item => (
                <div key={item} className="flex min-h-11 items-center gap-2.5 py-2.5 text-xs font-semibold text-portal-soft">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-portal-forest" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="text-center text-[10px] leading-4 text-portal-soft">Dengan masuk, kamu melanjutkan ke workspace usaha yang terhubung dengan akun Lajukan.</p>
      </div>
    </main>
  );
}
