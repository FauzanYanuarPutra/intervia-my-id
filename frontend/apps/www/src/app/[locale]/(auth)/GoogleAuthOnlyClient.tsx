'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import { GoogleBrandIcon } from '@/components/auth/GoogleBrandIcon';

const errorCopy: Record<string, { id: string; en: string }> = {
  backend_failed: {
    id: 'Login Google berhasil, tapi sesi Lajukan belum bisa dibuat. Coba lagi setelah beberapa saat.',
    en: 'Google sign-in worked, but Lajukan could not create your session yet. Please try again shortly.',
  },
  oauth_not_configured: {
    id: 'Google Login belum terkonfigurasi di server.',
    en: 'Google Login is not configured on the server.',
  },
  oauth_state_invalid: {
    id: 'Sesi login kedaluwarsa. Mulai lagi dari tombol Google.',
    en: 'The sign-in session expired. Start again from the Google button.',
  },
  token_exchange_failed: {
    id: 'Kode Google tidak bisa ditukar. Mulai ulang login.',
    en: 'The Google code could not be exchanged. Start sign-in again.',
  },
  user_info_failed: {
    id: 'Profil Google belum bisa dibaca. Coba lagi.',
    en: 'Your Google profile could not be loaded. Please try again.',
  },
};

type Props = {
  mode: 'login' | 'register';
};

export default function GoogleAuthOnlyClient({ mode }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const rawError = searchParams.get('error') || '';

  const locale = useMemo(() => {
    const segment = pathname?.split('/')[1];
    return segment && segment.length === 2 ? segment : 'id';
  }, [pathname]);
  const isId = locale === 'id';
  const googleHref = `/api/auth/google?callbackUrl=${encodeURIComponent(
    callbackUrl || `/${locale}/profile`,
  )}`;
  const mappedError = rawError ? errorCopy[rawError] : null;
  const title =
    mode === 'register'
      ? isId
        ? 'Buat akun Lajukan'
        : 'Create your Lajukan account'
      : isId
        ? 'Masuk ke Lajukan'
        : 'Sign in to Lajukan';
  const description = isId
    ? 'Lanjutkan dengan Google untuk membuka profil, chat, dan AI Studio kamu.'
    : 'Continue with Google to access your profile, chats, and AI Studio.';

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge={isId ? 'Akses aman' : 'Secure access'}
      title={title}
      description={description}
      helperText={
        isId
          ? 'Belum punya akun? Akun Lajukan dibuat otomatis saat kamu pertama kali masuk dengan Google.'
          : 'New to Lajukan? Your account is created automatically the first time you continue with Google.'
      }
      highlights={[
        {
          title: isId ? 'Chat tetap tersimpan' : 'Chats stay saved',
          description: isId
            ? 'Buka kembali percakapan dan update penting kapan saja.'
            : 'Return to conversations and important updates anytime.',
        },
        {
          title: isId ? 'AI Studio pribadi' : 'Your AI Studio',
          description: isId
            ? 'Buat tool AI, unggah media, dan simpan riwayat kerja.'
            : 'Create AI tools, upload media, and keep your work history.',
        },
        {
          title: isId ? 'Profil dan listing' : 'Profile and listings',
          description: isId
            ? 'Kelola profil bisnis, listing, dan kebutuhan usaha.'
            : 'Manage your business profile, listings, and business needs.',
        },
      ]}
    >
      <div className="space-y-4">
        {rawError ? (
          <p
            role="alert"
            className="rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-3 text-sm font-semibold leading-6 text-[color:var(--app-danger)]"
          >
            {mappedError
              ? isId
                ? mappedError.id
                : mappedError.en
              : isId
                ? 'Login Google belum berhasil. Coba lagi.'
                : 'Google sign-in was not completed. Please try again.'}
          </p>
        ) : null}

        <a
          href={googleHref}
          className="group flex min-h-14 w-full items-center gap-3 !rounded-lg border border-[color:var(--app-accent-strong)] bg-[color:var(--app-accent)] px-3.5 py-2 text-sm font-bold text-white shadow-[0_16px_28px_-18px_rgba(18,138,69,0.72)] transition hover:bg-[color:var(--app-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--app-accent)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
            <GoogleBrandIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-left leading-5">
            {isId ? 'Lanjutkan dengan Google' : 'Continue with Google'}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/12 transition group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </a>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
          <p className="text-[11px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Tidak perlu membuat password atau OTP Lajukan baru. Gunakan akun Google yang memang milikmu.'
              : 'You do not need a new Lajukan password or OTP. Use your own Google account.'}
          </p>
        </div>

        {/* <p className="flex items-start gap-2 text-left text-[11px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
          <span className="min-w-0 flex-1">
            {isId
              ? 'Lajukan menggunakan autentikasi Google untuk proses masuk yang aman.'
              : 'Lajukan uses Google authentication for secure sign-in.'}
          </span>
        </p> */}
      </div>
    </AuthFlowShell>
  );
}
