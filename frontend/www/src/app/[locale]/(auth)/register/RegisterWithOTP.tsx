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
  getPhoneCountryFlagEmoji,
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
  const selectedCountryFlag = getPhoneCountryFlagEmoji(selectedCountry.code);
  const currentStep = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;
  const shellCopy = {
    phone: {
      title: locale === 'id' ? 'Daftar' : 'Register',
      description: locale === 'id' ? 'Nomor HP + OTP.' : 'Phone + OTP.',
      progressLabel: locale === 'id' ? 'Daftar' : 'Register',
    },
    otp: {
      title: locale === 'id' ? 'Masukkan kode' : 'Enter code',
      description: locale === 'id' ? '6 digit dari SMS.' : '6 digits from SMS.',
      progressLabel: locale === 'id' ? 'Kode' : 'Code',
    },
    profile: {
      title: locale === 'id' ? 'Nama kamu' : 'Your name',
      description: locale === 'id' ? 'Email opsional.' : 'Email optional.',
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
  const shellHelperText = '';

  const authInputClass =
    'w-full min-h-[42px] rounded-[12px] border border-[color:var(--app-border)] bg-white px-3 py-2 text-[14px] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] outline-none transition-[border-color,background-color,box-shadow] focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] sm:text-[13px] dark:bg-[color:var(--app-surface-strong)]';
  const primaryButtonClass =
    'flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 py-3 text-sm font-bold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)]';
  const utilityButtonClass =
    'flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] sm:w-auto sm:shrink-0 dark:bg-[color:var(--app-surface-strong)]';
  const statusCardClass =
    'rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 py-3';
  const secondaryTextButtonClass =
    'inline-flex min-h-[38px] items-center gap-1 rounded-full text-sm font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)]';
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
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
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
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
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
                {selectedCountryFlag}{' '}
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

          </motion.div>
        );

      case 'profile':
        return (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
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
                {selectedCountryFlag}{' '}
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
      badge="OTP"
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
          <p className="mt-4 rounded-[16px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--app-danger)]">
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
