'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import { GoogleBrandIcon } from '@/components/auth/GoogleBrandIcon';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = email.trim().toLowerCase();
  const otpCooldownLeft = Math.max(0, otpResendAt - Date.now());
  const otpCooldownSeconds = Math.ceil(otpCooldownLeft / 1000);
  const canSubmit =
    normalizedUsername.length >= 3 &&
    normalizedEmail.includes('@') &&
    otpToken.length > 0 &&
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
      : !normalizedEmail.includes('@')
        ? isId
          ? 'Isi email akun'
          : 'Enter account email'
        : !otpToken
          ? isId
            ? 'Verifikasi OTP dulu'
            : 'Verify OTP first'
          : needsCaptcha && !captchaToken
            ? isId
              ? 'Selesaikan captcha'
              : 'Complete captcha'
            : isId
              ? 'Masuk aman'
              : 'Secure sign in';

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    router.replace(callbackUrl || `/${locale}/profile`);
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
        otpToken,
        otpType: 'email',
        otpTarget: normalizedEmail,
        redirectTo: callbackUrl || `/${locale}/profile`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(mapCommonAuthError(message));
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!normalizedEmail.includes('@')) {
      setError(isId ? 'Isi email akun dulu.' : 'Enter your account email first.');
      return;
    }
    if (otpCooldownLeft > 0) {
      setError(
        isId
          ? `Tunggu ${otpCooldownSeconds} detik sebelum kirim ulang kode.`
          : `Wait ${otpCooldownSeconds} seconds before resending the code.`,
      );
      return;
    }

    setSendingOtp(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          target: normalizedEmail,
          purpose: 'login',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mapCommonAuthError(data?.error, res.status));
        return;
      }

      setOtp('');
      setOtpToken('');
      setOtpResendAt(Date.now() + 30_000);
    } catch {
      setError(isId ? 'Gagal kirim OTP email.' : 'Failed to send email OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!normalizedEmail.includes('@') || otp.length !== 6) {
      setError(isId ? 'Isi email dan OTP 6 digit.' : 'Enter email and 6-digit OTP.');
      return;
    }

    setVerifyingOtp(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          target: normalizedEmail,
          otp,
          purpose: 'login',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.token !== 'string') {
        setError(mapCommonAuthError(data?.error, res.status));
        return;
      }

      setOtpToken(data.token);
    } catch {
      setError(isId ? 'Gagal verifikasi OTP.' : 'Failed to verify OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const googleHref = `/api/auth/google?callbackUrl=${encodeURIComponent(
    callbackUrl || `/${locale}/profile`,
  )}`;

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
        <a
          href={googleHref}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-strong)]"
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

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--app-border)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
            {isId ? 'atau' : 'or'}
          </span>
          <span className="h-px flex-1 bg-[color:var(--app-border)]" />
        </div>

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
          <span className="mb-1.5 block text-xs font-bold text-[color:var(--app-text)]">
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
          <span className="mb-1.5 block text-xs font-bold text-[color:var(--app-text)]">
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

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-[color:var(--app-text)]">
            Email OTP
          </span>
          <span className="relative block">
            <Mail className={iconClass} />
            <input
              value={email}
              onChange={event => {
                setEmail(event.target.value);
                setOtpToken('');
              }}
              autoComplete="email"
              inputMode="email"
              type="email"
              placeholder={isId ? 'email akun kamu' : 'your account email'}
              className={`${inputClass} pl-11 pr-4`}
            />
          </span>
        </label>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <span className="relative block">
            <KeyRound className={iconClass} />
            <input
              value={otp}
              onChange={event => {
                setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                setOtpToken('');
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className={`${inputClass} pl-11 pr-4 text-center tracking-[0.24em]`}
            />
          </span>
          <button
            type="button"
            onClick={sendEmailOtp}
            disabled={sendingOtp || !normalizedEmail.includes('@') || otpCooldownLeft > 0}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-strong)]"
          >
            {sendingOtp
              ? 'SEND...'
              : otpCooldownLeft > 0
                ? `${otpCooldownSeconds}s`
                : isId
                  ? 'Kirim'
                  : 'Send'}
          </button>
        </div>

        <button
          type="button"
          onClick={verifyEmailOtp}
          disabled={verifyingOtp || otp.length !== 6 || !normalizedEmail.includes('@') || Boolean(otpToken)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 text-sm font-bold text-[color:var(--app-accent-strong)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_70%,white_30%)] disabled:cursor-not-allowed disabled:border-[color:var(--app-border)] disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)]"
        >
          {verifyingOtp ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : otpToken ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {isId ? 'OTP terverifikasi' : 'OTP verified'}
            </>
          ) : (
            isId ? 'Verifikasi OTP' : 'Verify OTP'
          )}
        </button>

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
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-[color:var(--app-text-inverse)] shadow-[0_18px_34px_-24px_rgba(0,128,64,0.75)] transition hover:bg-[color:var(--app-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] disabled:shadow-none"
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
