'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import {
  AvatarBuilder,
  createLajukanAvatarDataUrl,
  DEFAULT_LAJUKAN_AVATAR,
  type LajukanAvatarSpec,
} from '@/components/profile/AvatarBuilder';
import { CaptchaField } from '@/components/security/CaptchaField';
import { useAuth } from '@/context/AuthContext';
import { mapCommonAuthError } from '@/lib/authErrors';
import {
  getPasswordMinLength,
  passwordContainsIdentityHint,
  validatePasswordStrength,
} from '@/lib/passwordPolicy';

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function passwordErrorToCopy(
  error: string | null,
  isId: boolean,
  minLength: number,
): string | null {
  if (!error) return null;
  if (!isId) return error;
  if (error.includes('least')) return `Password minimal ${minLength} karakter.`;
  if (error.includes('uppercase')) return 'Password perlu 1 huruf besar.';
  if (error.includes('lowercase')) return 'Password perlu 1 huruf kecil.';
  if (error.includes('number')) return 'Password perlu 1 angka.';
  if (error.includes('symbol')) return 'Password perlu 1 simbol.';
  if (error.includes('spaces')) return 'Password tidak boleh pakai spasi.';
  if (error.includes('username or name')) {
    return 'Password jangan mengandung username, nama, atau nama usaha.';
  }
  return error;
}

export default function RegisterWithOTP() {
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const locale = useMemo(() => {
    const segment = pathname?.split('/')[1];
    return segment && segment.length === 2 ? segment : 'id';
  }, [pathname]);
  const isId = locale === 'id';
  const needsCaptcha = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  );

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarSpec, setAvatarSpec] = useState<LajukanAvatarSpec>(
    DEFAULT_LAJUKAN_AVATAR,
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');

  const normalizedUsername = normalizeUsername(username);
  const avatarLabel = fullName.trim() || normalizedUsername || 'Lajukan avatar';
  const avatarUrl = useMemo(
    () => createLajukanAvatarDataUrl(avatarSpec, avatarLabel),
    [avatarLabel, avatarSpec],
  );
  const usernameValid =
    /^[a-z0-9_.]{3,30}$/.test(normalizedUsername) &&
    !normalizedUsername.includes('..') &&
    !normalizedUsername.startsWith('.') &&
    !normalizedUsername.endsWith('.');
  const minPasswordLength = getPasswordMinLength();
  const passwordPolicyError = validatePasswordStrength(password);
  const passwordIdentityError =
    password &&
    passwordContainsIdentityHint(password, [normalizedUsername, fullName])
      ? 'Password cannot contain username or name'
      : null;
  const passwordBlockingError = passwordPolicyError || passwordIdentityError;
  const canSubmit =
    fullName.trim().length >= 2 &&
    usernameValid &&
    !passwordBlockingError &&
    password === confirmPassword &&
    (!needsCaptcha || captchaToken.length > 0);
  const submitCopy = canSubmit
    ? isId
      ? 'Buat akun aman'
      : 'Create secure account'
    : isId
      ? 'Lengkapi dulu'
      : 'Complete first';

  useEffect(() => {
    if (authLoading || !isAuthenticated || registered) return;
    router.replace(`/${locale}/home`);
    router.refresh();
  }, [authLoading, isAuthenticated, locale, registered, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await register({
        full_name: fullName.trim(),
        username: normalizedUsername,
        password,
        avatar_url: avatarUrl,
        metadata: {
          avatar_style: avatarSpec,
          avatar_source: 'lajukan_avatar_builder',
        },
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      });
      setRegistered(true);
      router.replace(`/${locale}/onboarding`);
      router.refresh();
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
  const passwordCopy = passwordErrorToCopy(
    passwordBlockingError,
    isId,
    minPasswordLength,
  );

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge={isId ? 'Akun baru' : 'New account'}
      title={isId ? 'Daftar Lajukan' : 'Create Lajukan account'}
      description={
        isId
          ? 'Cukup nama, username, dan password. Email/nomor bisa ditambah nanti.'
          : 'Just name, username, and password. Email/phone can be added later.'
      }
      helperText={
        isId
          ? 'Password minimal kuat, tidak boleh mirip username/nama. Pendaftaran juga dibatasi captcha dan rate limit.'
          : 'Passwords must be strong and cannot include your username/name. Registration is protected by captcha and rate limits.'
      }
      currentStep={1}
      totalSteps={1}
      progressLabel={isId ? 'Daftar' : 'Register'}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex items-start gap-3 rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] bg-[color:var(--app-accent-soft)] px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-xs font-bold leading-5 text-[color:var(--app-text)]">
            {isId
              ? 'Tidak pakai nomor HP dulu. Setelah masuk, akun baru tetap bisa dibatasi untuk aktivitas sensitif sampai profilnya lebih lengkap.'
              : 'No phone number for now. After signing in, new accounts can still be limited for sensitive activity until the profile is more complete.'}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[color:var(--app-text)]">
            {isId ? 'Nama lengkap' : 'Full name'}
          </span>
          <span className="relative block">
            <UserRound className={iconClass} />
            <input
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              placeholder={isId ? 'Nama kamu' : 'Your name'}
              className={`${inputClass} pl-11 pr-4`}
            />
          </span>
        </label>

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
              placeholder={
                isId ? 'contoh: kopi_nusantara' : 'e.g. kopi_nusantara'
              }
              className={`${inputClass} pl-11 pr-4`}
            />
          </span>
          <span className="mt-1 block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            {isId
              ? '3-30 karakter, huruf kecil, angka, titik, atau underscore.'
              : '3-30 chars, lowercase letters, numbers, dot, or underscore.'}
          </span>
        </label>

        <AvatarBuilder
          compact
          isId={isId}
          title={avatarLabel}
          value={avatarSpec}
          onChange={nextSpec => {
            setAvatarSpec(nextSpec);
          }}
          className="border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] bg-[color:var(--app-surface-strong)]"
        />

        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[color:var(--app-text)]">
            Password
          </span>
          <span className="relative block">
            <LockKeyhole className={iconClass} />
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder={
                isId
                  ? `Minimal ${minPasswordLength} karakter`
                  : `At least ${minPasswordLength} characters`
              }
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
          {password && passwordCopy ? (
            <span className="mt-1 block text-[11px] font-semibold text-[color:var(--app-danger)]">
              {passwordCopy}
            </span>
          ) : password ? (
            <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--app-accent-strong)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isId ? 'Password sudah aman dipakai.' : 'Password looks safe.'}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[color:var(--app-text)]">
            {isId ? 'Ulangi password' : 'Confirm password'}
          </span>
          <span className="relative block">
            <LockKeyhole className={iconClass} />
            <input
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={isId ? 'Ketik sekali lagi' : 'Type it again'}
              className={`${inputClass} pl-11 pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(value => !value)}
              className={passwordToggleClass}
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </span>
          {confirmPassword && password !== confirmPassword ? (
            <span className="mt-1 block text-[11px] font-semibold text-[color:var(--app-danger)]">
              {isId ? 'Password belum sama.' : 'Passwords do not match.'}
            </span>
          ) : null}
        </label>

        {needsCaptcha ? (
          <CaptchaField
            action="register"
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
            submitCopy
          )}
        </button>

        <p className="text-center text-sm font-semibold text-[color:var(--app-text-soft)]">
          {isId ? 'Sudah punya akun?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/login`)}
            className="text-[color:var(--app-accent)] hover:text-[color:var(--app-accent-strong)]"
          >
            {isId ? 'Masuk' : 'Sign in'}
          </button>
        </p>
      </form>
    </AuthFlowShell>
  );
}
