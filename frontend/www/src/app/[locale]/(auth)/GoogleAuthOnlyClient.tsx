'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Chrome, ShieldCheck } from 'lucide-react';
import AuthFlowShell from '@/components/auth/AuthFlowShell';

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
    callbackUrl || `/${locale}/dashboard`,
  )}`;
  const mappedError = rawError ? errorCopy[rawError] : null;

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge="Google"
      title={
        mode === 'register'
          ? isId
            ? 'Daftar dengan Google'
            : 'Register with Google'
          : isId
            ? 'Masuk dengan Google'
            : 'Sign in with Google'
      }
      description={
        isId
          ? 'Satu tombol untuk masuk atau membuat akun Lajukan. Tidak perlu form, password, atau OTP.'
          : 'One button to sign in or create a Lajukan account. No forms, passwords, or OTP needed.'
      }
      helperText={
        isId
          ? 'Gunakan akun Google yang emailnya aktif dan sudah terverifikasi.'
          : 'Use a Google account with an active, verified email address.'
      }
    >
      <div className="space-y-3.5">
        <a
          href={googleHref}
          className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-black text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-strong)]"
        >
          <Chrome className="h-4 w-4" />
          {isId ? 'Masuk / daftar dengan Google' : 'Sign in / register with Google'}
        </a>

        <div className="flex items-start gap-3 rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] bg-[color:var(--app-accent-soft)] px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-xs font-bold leading-5 text-[color:var(--app-text)]">
            {isId
              ? 'Akun baru otomatis dibuat saat Google pertama kali dipakai di Lajukan.'
              : 'A new account is created automatically the first time Google is used on Lajukan.'}
          </p>
        </div>

        {rawError ? (
          <p className="rounded-[14px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-3 text-sm font-semibold text-[color:var(--app-danger)]">
            {mappedError
              ? isId
                ? mappedError.id
                : mappedError.en
              : isId
                ? 'Login Google belum berhasil. Coba lagi.'
                : 'Google sign-in was not completed. Please try again.'}
          </p>
        ) : null}
      </div>
    </AuthFlowShell>
  );
}
