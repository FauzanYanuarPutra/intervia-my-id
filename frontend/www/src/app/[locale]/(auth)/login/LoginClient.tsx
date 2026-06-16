'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import { CaptchaField } from '@/components/security/CaptchaField';
import { useAuth } from '@/context/AuthContext';
import { mapCommonAuthError } from '@/lib/authErrors';

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export default function LoginClient() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');

  const locale = useMemo(() => {
    const segment = pathname?.split('/')[1];
    return segment && segment.length === 2 ? segment : 'id';
  }, [pathname]);
  const isId = locale === 'id';
  const needsCaptcha = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const normalizedUsername = normalizeUsername(username);
  const canSubmit =
    normalizedUsername.length >= 3 &&
    password.length > 0 &&
    (!needsCaptcha || captchaToken.length > 0);
  const submitHint = !normalizedUsername
    ? isId
      ? 'Isi username dulu'
      : 'Enter username first'
    : !password
      ? isId
        ? 'Isi password dulu'
        : 'Enter password first'
      : needsCaptcha && !captchaToken
        ? isId
          ? 'Selesaikan captcha'
          : 'Complete captcha'
        : isId
          ? 'Masuk aman'
          : 'Secure sign in';

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    router.replace(callbackUrl || `/${locale}/dashboard`);
    router.refresh();
  }, [authLoading, callbackUrl, isAuthenticated, locale, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await login(normalizedUsername, password, {
        captchaToken,
        redirectTo: callbackUrl || `/${locale}/dashboard`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(mapCommonAuthError(message));
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full min-h-[48px] rounded-[15px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-semibold text-[color:var(--app-text)] shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] placeholder:text-[color:var(--app-text-soft)] outline-none transition focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_16%,_transparent)] dark:bg-[color:var(--app-surface-strong)]';
  const iconClass =
    'pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]';
  const passwordToggleClass =
    'absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]';

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge={isId ? 'Username' : 'Username'}
      title={isId ? 'Masuk ke Lajukan' : 'Sign in to Lajukan'}
      description={
        isId
          ? 'Pakai username dan password. Nomor HP tidak diperlukan dulu.'
          : 'Use username and password. Phone number is not required for now.'
      }
      helperText={
        isId
          ? 'Percobaan login dibatasi otomatis. Kalau terlalu banyak gagal, akun akan dikunci sementara.'
          : 'Login attempts are rate-limited. Too many failures can temporarily lock the account.'
      }
      currentStep={1}
      totalSteps={1}
      progressLabel={isId ? 'Masuk' : 'Sign in'}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex items-start gap-3 rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] bg-[color:var(--app-accent-soft)] px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-xs font-bold leading-5 text-[color:var(--app-text)]">
            {isId
              ? 'Username boleh publik, tapi password wajib unik. Jangan pakai nama, brand, atau username sebagai password.'
              : 'Usernames can be public, so keep the password unique. Avoid using your name, brand, or username.'}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[color:var(--app-text)]">
            Username
          </span>
          <span className="relative block">
            <UserRound className={iconClass} />
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              inputMode="text"
              spellCheck={false}
              maxLength={30}
              placeholder={isId ? 'contoh: gudang_rasa' : 'e.g. gudang_rasa'}
              className={`${inputClass} pl-11 pr-4`}
            />
          </span>
          <span className="mt-1 block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            {isId
              ? 'Tanpa @. Huruf kecil, angka, titik, atau underscore.'
              : 'No @ needed. Lowercase, numbers, dot, or underscore.'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[color:var(--app-text)]">
            Password
          </span>
          <span className="relative block">
            <LockKeyhole className={iconClass} />
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              placeholder={isId ? 'Password akun' : 'Account password'}
              className={`${inputClass} pl-11 pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className={passwordToggleClass}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </span>
        </label>

        {needsCaptcha ? (
          <CaptchaField
            action="other"
            onTokenChange={setCaptchaToken}
            className="min-h-[70px]"
          />
        ) : null}

        {error ? (
          <p className="rounded-[14px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-3 text-sm font-semibold text-[color:var(--app-danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 text-sm font-black text-[color:var(--app-text-inverse)] shadow-[0_18px_34px_-24px_rgba(0,128,64,0.75)] transition hover:bg-[color:var(--app-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] disabled:shadow-none"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            submitHint
          )}
        </button>

        <p className="text-center text-sm font-semibold text-[color:var(--app-text-soft)]">
          {isId ? 'Belum punya akun?' : 'New here?'}{' '}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/register`)}
            className="text-[color:var(--app-accent)] hover:text-[color:var(--app-accent-strong)]"
          >
            {isId ? 'Daftar' : 'Register'}
          </button>
        </p>
      </form>
    </AuthFlowShell>
  );
}
