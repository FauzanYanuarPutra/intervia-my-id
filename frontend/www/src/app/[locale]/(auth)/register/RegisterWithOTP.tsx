'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import PhoneNumberField from '@/components/auth/PhoneNumberField';
import { CaptchaField } from '@/components/security/CaptchaField';
import { useAuth } from '@/context/AuthContext';
import { mapCommonAuthError } from '@/lib/authErrors';
import {
  buildInternationalPhoneNumber,
  DEFAULT_AUTH_PHONE_COUNTRY,
  formatPhonePreview,
  getPhoneCountry,
  isPhoneNumberReady,
  type PhoneCountryCode,
} from '@/lib/phoneCountry';
import { ArrowLeft, ArrowRight, Check, Loader2, User } from 'lucide-react';

type Step = 'phone' | 'otp' | 'profile';
const REGISTER_FLOW_STORAGE_KEY = 'lajukan_auth_register_phone_flow_v2';

export default function RegisterWithOTP() {
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const locale = useMemo(() => {
    const segment = pathname?.split('/')[1];
    return segment && segment.length === 2 ? segment : 'id';
  }, [pathname]);
  const needsCaptcha = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  );

  const [step, setStep] = useState<Step>('phone');
  const [phoneCountryCode, setPhoneCountryCode] = useState<PhoneCountryCode>(
    DEFAULT_AUTH_PHONE_COUNTRY,
  );
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');

  const normalizedPhone = buildInternationalPhoneNumber(
    phone,
    phoneCountryCode,
  );
  const phoneReady = isPhoneNumberReady(phone, phoneCountryCode);
  const normalizedEmail = email.trim().toLowerCase();
  const otpCooldownLeft = Math.max(0, otpResendAt - Date.now());
  const otpCooldownSeconds = Math.ceil(otpCooldownLeft / 1000);
  const selectedCountry = getPhoneCountry(phoneCountryCode);
  const currentStep = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;
  const shellCopy = {
    phone: {
      title: locale === 'id' ? 'Daftar' : 'Register',
      description:
        locale === 'id'
          ? 'Pakai nomor aktif untuk terima OTP.'
          : 'Use an active phone number for OTP.',
      progressLabel: locale === 'id' ? 'Daftar' : 'Register',
    },
    otp: {
      title: locale === 'id' ? 'Masukkan kode' : 'Enter code',
      description:
        locale === 'id'
          ? 'Isi 6 digit dari SMS.'
          : 'Enter the 6-digit SMS code.',
      progressLabel: locale === 'id' ? 'Kode' : 'Code',
    },
    profile: {
      title: locale === 'id' ? 'Nama kamu' : 'Your name',
      description:
        locale === 'id'
          ? 'Email opsional. Akun langsung siap dipakai.'
          : 'Email is optional. The account is ready after this.',
      progressLabel: locale === 'id' ? 'Akun' : 'Account',
    },
  }[step];
  const shellHighlights =
    locale === 'id'
      ? [
          {
            title: 'Nomor aktif',
            description: 'Pakai nomor yang kamu pakai sekarang.',
          },
          {
            title: 'Kode OTP',
            description: 'Cek SMS lalu isi 6 digit.',
          },
          {
            title: 'Profil nanti',
            description: 'Fokus bikin akun dulu.',
          },
        ]
      : [
          {
            title: 'Active phone',
            description: 'Use the number you use right now.',
          },
          {
            title: 'OTP code',
            description: 'Check SMS and enter 6 digits.',
          },
          {
            title: 'Profile later',
            description: 'Focus on creating the account first.',
          },
        ];
  const shellHelperText =
    locale === 'id'
      ? 'Nama dulu, detail nanti.'
      : 'Name first, details later.';

  const authInputClass =
    'w-full min-h-[56px] rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3.5 text-[15px] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] outline-none transition-[border-color,background-color,box-shadow] focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] sm:text-sm';
  const primaryButtonClass =
    'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-accent-strong)_42%,_transparent)] bg-[color:var(--app-accent)] px-4 py-3.5 text-[15px] font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_28px_-18px_color-mix(in_srgb,_var(--app-accent)_50%,_transparent)] transition hover:bg-[color:var(--app-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:border-[color:var(--app-border)] disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] disabled:shadow-none sm:text-sm';
  const utilityButtonClass =
    'flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm font-medium text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] disabled:hover:border-[color:var(--app-border)] disabled:hover:text-[color:var(--app-text-soft)] sm:w-auto sm:shrink-0';
  const statusCardClass =
    'rounded-[20px] border border-[color:color-mix(in_srgb,_var(--app-accent)_14%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_30%,_var(--app-surface-strong))] px-4 py-3';
  const secondaryTextButtonClass =
    'inline-flex min-h-[44px] items-center gap-1 rounded-full px-1 text-sm font-medium text-[color:var(--app-text)] transition hover:text-[color:var(--app-accent)]';
  const clearRegisterDraft = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(REGISTER_FLOW_STORAGE_KEY);
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || registered) return;
    clearRegisterDraft();
    router.replace(`/${locale}/home`);
    router.refresh();
  }, [authLoading, isAuthenticated, locale, registered, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(REGISTER_FLOW_STORAGE_KEY);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as {
        step?: Step;
        phone?: string;
        phoneCountryCode?: PhoneCountryCode;
        otpToken?: string;
        name?: string;
        email?: string;
      };

      if (
        draft.step === 'phone' ||
        draft.step === 'otp' ||
        draft.step === 'profile'
      ) {
        setStep(draft.step);
      }
      if (typeof draft.phone === 'string') setPhone(draft.phone);
      if (draft.phoneCountryCode) setPhoneCountryCode(draft.phoneCountryCode);
      if (typeof draft.otpToken === 'string') setOtpToken(draft.otpToken);
      if (typeof draft.name === 'string') setName(draft.name);
      if (typeof draft.email === 'string') setEmail(draft.email);
    } catch {
      window.sessionStorage.removeItem(REGISTER_FLOW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      REGISTER_FLOW_STORAGE_KEY,
      JSON.stringify({
        step,
        phone,
        phoneCountryCode,
        otpToken,
        name,
        email,
      }),
    );
  }, [email, name, otpToken, phone, phoneCountryCode, step]);

  const resetOtpState = () => {
    setOtp('');
    setOtpToken('');
    setDevOtp('');
  };

  const sendPhoneOtp = async () => {
    if (!phoneReady || normalizedPhone.length < 8) {
      setError(
        locale === 'id'
          ? 'Masukkan nomor HP aktif dulu.'
          : 'Enter an active phone number first.',
      );
      return;
    }
    if (otpCooldownLeft > 0) {
      setError(
        locale === 'id'
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
          type: 'phone',
          target: normalizedPhone,
          purpose: 'register',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(mapCommonAuthError(data?.error, res.status));
        return;
      }

      resetOtpState();
      setOtpResendAt(Date.now() + 30_000);
      if (typeof data?.devOtp === 'string') {
        setDevOtp(data.devOtp);
      }
      setStep('otp');
    } catch {
      setError(
        locale === 'id'
          ? 'Gagal kirim OTP nomor HP. Coba lagi.'
          : 'Failed to send phone OTP. Try again.',
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!phoneReady || normalizedPhone.length < 8) {
      setError(
        locale === 'id'
          ? 'Masukkan nomor HP aktif dulu.'
          : 'Enter an active phone number first.',
      );
      return;
    }
    if (otp.length !== 6) {
      setError(
        locale === 'id' ? 'Masukkan OTP 6 digit.' : 'Enter the 6-digit OTP.',
      );
      return;
    }

    setVerifyingOtp(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: normalizedPhone,
          otp,
          purpose: 'register',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || typeof data?.token !== 'string') {
        setError(mapCommonAuthError(data?.error, res.status));
        return;
      }

      setOtpToken(data.token);
      setStep('profile');
    } catch {
      setError(
        locale === 'id'
          ? 'Gagal verifikasi OTP. Coba lagi.'
          : 'Failed to verify OTP. Try again.',
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const registerAccount = async () => {
    if (!otpToken) {
      setError(
        locale === 'id'
          ? 'Verifikasi OTP dulu sebelum lanjut.'
          : 'Verify OTP before continuing.',
      );
      setStep('otp');
      return;
    }
    if (!name.trim()) {
      setError(
        locale === 'id' ? 'Nama wajib diisi.' : 'Full name is required.',
      );
      return;
    }
    if (normalizedEmail && !normalizedEmail.includes('@')) {
      setError(
        locale === 'id' ? 'Format email tidak valid.' : 'Invalid email format.',
      );
      return;
    }
    if (needsCaptcha && !captchaToken) {
      setError(
        locale === 'id'
          ? 'Selesaikan captcha dulu sebelum buat akun.'
          : 'Complete the captcha before creating the account.',
      );
      return;
    }

    setRegistering(true);
    setError('');
    setRegistered(true);

    try {
      const registerResult = await register({
        phone: normalizedPhone,
        full_name: name.trim(),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        phone_otp_token: otpToken,
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      });

      clearRegisterDraft();
      router.replace(
        registerResult?.recovery_action === 'login'
          ? `/${locale}/home`
          : `/${locale}/onboarding`,
      );
      router.refresh();
    } catch (err) {
      setRegistered(false);
      const message = err instanceof Error ? err.message : undefined;
      setError(mapCommonAuthError(message));
    } finally {
      setRegistering(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'phone':
        return (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <PhoneNumberField
                locale={locale as 'id' | 'en'}
                value={phone}
                countryCode={phoneCountryCode}
                onValueChange={setPhone}
                onCountryCodeChange={setPhoneCountryCode}
                inputClassName={authInputClass}
              />
              <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Pakai nomor yang bisa menerima SMS sekarang.'
                  : 'Use a number that can receive SMS right now.'}
              </p>
            </div>

            <button
              type="button"
              onClick={sendPhoneOtp}
              disabled={sendingOtp || !phoneReady}
              className={primaryButtonClass}
            >
                {sendingOtp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {locale === 'id' ? 'Kirim kode' : 'Send code'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
          </motion.div>
        );

      case 'otp':
        return (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              type="button"
              onClick={() => {
                resetOtpState();
                setError('');
                setStep('phone');
              }}
              className={secondaryTextButtonClass}
              >
                <ArrowLeft className="h-4 w-4" />
                {locale === 'id' ? 'Ganti nomor HP' : 'Change phone'}
              </button>

            <div className={statusCardClass}>
              <p className="text-xs font-medium text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Kode ke' : 'Code sent to'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                {selectedCountry.flag}{' '}
                {formatPhonePreview(phone, phoneCountryCode)}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="text"
                autoFocus
                value={otp}
                maxLength={6}
                onChange={event =>
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                inputMode="numeric"
                enterKeyHint="done"
                className={`${authInputClass} w-full min-w-0 text-center tracking-[0.28em] sm:tracking-[0.4em]`}
              />
              <button
                type="button"
                onClick={sendPhoneOtp}
                disabled={sendingOtp || otpCooldownLeft > 0}
                className={utilityButtonClass}
              >
                {sendingOtp
                  ? 'SEND...'
                  : otpCooldownLeft > 0
                    ? `${otpCooldownSeconds}s`
                    : locale === 'id'
                      ? 'Kirim lagi'
                      : 'Resend'}
              </button>
            </div>

            <button
              type="button"
              onClick={verifyPhoneOtp}
              disabled={verifyingOtp || otp.length !== 6}
              className={`mt-3 ${primaryButtonClass}`}
            >
              {verifyingOtp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {locale === 'id' ? 'Lanjut' : 'Continue'}
                  <Check className="h-4 w-4" />
                </>
              )}
            </button>

            {devOtp ? (
              <div className="rounded-[20px] border border-[color:color-mix(in_srgb,_var(--app-warning)_22%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--app-warning-soft)_72%,_var(--app-surface-strong))] px-4 py-3 text-center text-xs text-[color:var(--app-warning)]">
                Dev OTP:{' '}
                <span className="font-mono font-semibold">{devOtp}</span>
              </div>
            ) : null}
          </motion.div>
        );

      case 'profile':
        return (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('otp');
              }}
              className={secondaryTextButtonClass}
              >
                <ArrowLeft className="h-4 w-4" />
                {locale === 'id' ? 'Kembali ke OTP' : 'Back to OTP'}
              </button>

            <div className={statusCardClass}>
              <p className="text-xs font-medium text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Nomor siap dipakai' : 'Ready number'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                {selectedCountry.flag}{' '}
                {formatPhonePreview(phone, phoneCountryCode)}
              </p>
            </div>

            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder={locale === 'id' ? 'Nama lengkap' : 'Full name'}
                autoComplete="name"
                className={`${authInputClass} pl-9`}
              />
            </div>

            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder={
                locale === 'id' ? 'Email opsional' : 'Optional email'
              }
              autoComplete="email"
              className={authInputClass}
            />

            {needsCaptcha ? (
              <CaptchaField
                action="register"
                onTokenChange={setCaptchaToken}
                className="min-h-[70px]"
              />
            ) : null}

            <button
              type="button"
              onClick={registerAccount}
              disabled={registering || !name.trim()}
              className={primaryButtonClass}
            >
              {registering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {locale === 'id' ? 'Buat akun' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </motion.div>
        );
    }
  };

  return (
    <AuthFlowShell
      locale={locale as 'id' | 'en'}
      badge={locale === 'id' ? 'Daftar tanpa password' : 'Passwordless sign up'}
      title={shellCopy.title}
      description={shellCopy.description}
      currentStep={currentStep}
      totalSteps={3}
      progressLabel={shellCopy.progressLabel}
      highlights={shellHighlights}
      helperText={shellHelperText}
    >
      <div className="w-full min-w-0">
        <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

        {error ? (
          <p className="mt-4 rounded-[22px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--app-danger)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 text-center text-sm text-[color:var(--app-text-soft)]">
          <span>
            {locale === 'id' ? 'Sudah punya akun?' : 'Already have an account?'}
          </span>{' '}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/login`)}
            className="font-semibold text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]"
          >
            {locale === 'id' ? 'Masuk' : 'Sign in'}
          </button>
        </div>
      </div>
    </AuthFlowShell>
  );
}
