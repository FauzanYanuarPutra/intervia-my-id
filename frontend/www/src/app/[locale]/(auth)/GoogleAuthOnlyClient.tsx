'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
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
    ? 'Gunakan satu akun untuk profil, chat, AI Studio, dan aktivitas bisnis kamu.'
    : 'Use one account for your profile, chats, AI Studio, and business activity.';

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge={isId ? 'Akses aman' : 'Secure access'}
      title={title}
      description={description}
      helperText={
        isId
          ? 'Akun baru otomatis dibuat saat Google pertama kali dipakai di Lajukan.'
          : 'A new account is created automatically the first time Google is used on Lajukan.'
      }
      highlights={[
        {
          title: isId ? 'Chat & notifikasi' : 'Chats & notifications',
          description: isId
            ? 'Percakapan dan update penting tersimpan di akunmu.'
            : 'Conversations and key updates stay in your account.',
        },
        {
          title: 'AI Studio',
          description: isId
            ? 'Buat tool AI pribadi, upload media, dan simpan riwayat.'
            : 'Create personal AI tools, upload media, and keep history.',
        },
        {
          title: isId ? 'Profil bisnis' : 'Business profile',
          description: isId
            ? 'Kelola profil, listing, dan kebutuhan usaha dari satu tempat.'
            : 'Manage your profile, listings, and business needs in one place.',
        },
      ]}
    >
      <div className="space-y-3">
        <a
          href={googleHref}
          className="group inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[16px] bg-[color:var(--app-text)] px-4 text-sm font-bold text-[color:var(--app-surface)] transition hover:bg-[color:var(--app-accent)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--app-accent)]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">
            <GoogleBrandIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            {isId ? 'Lanjutkan dengan Google' : 'Continue with Google'}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
        </a>

        <div className="grid gap-2 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3">
          {[
            isId ? 'Tidak perlu password baru.' : 'No new password needed.',
            isId
              ? 'Email Google dipakai untuk keamanan akun.'
              : 'Your Google email is used for account security.',
            isId
              ? 'Kamu bisa lanjut ke profil setelah berhasil masuk.'
              : 'You can continue to your profile after sign-in.',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs font-bold text-[color:var(--app-text-soft)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
              <span>{item}</span>
            </div>
          ))}
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

        <p className="flex items-center justify-center gap-2 text-center text-[11px] font-bold leading-5 text-[color:var(--app-text-soft)]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
          {isId
            ? 'Dengan lanjut, kamu memakai autentikasi Google untuk Lajukan.'
            : 'By continuing, you use Google authentication for Lajukan.'}
        </p>
      </div>
    </AuthFlowShell>
  );
}
