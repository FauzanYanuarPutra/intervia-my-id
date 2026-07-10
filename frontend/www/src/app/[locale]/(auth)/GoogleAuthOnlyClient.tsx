'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
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
          className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-strong)]"
        >
          <svg width="24" height="24" viewBox="-0.5 0 48 48" version="1.1" xmlns="http://www.w3.org/2000/svg">

            <title>Google-color</title>
            <desc>Created with Sketch.</desc>
            <defs>

            </defs>
            <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
              <g id="Color-" transform="translate(-401.000000, -860.000000)">
                <g id="Google" transform="translate(401.000000, 860.000000)">
                  <path d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24" id="Fill-1" fill="#FBBC05">

                  </path>
                  <path d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333" id="Fill-2" fill="#EB4335">

                  </path>
                  <path d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667" id="Fill-3" fill="#34A853">

                  </path>
                  <path d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24" id="Fill-4" fill="#4285F4">

                  </path>
                </g>
              </g>
            </g>
          </svg>
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
