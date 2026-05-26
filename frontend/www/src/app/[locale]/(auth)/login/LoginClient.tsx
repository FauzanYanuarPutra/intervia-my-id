'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AuthFlowShell from '@/components/auth/AuthFlowShell';
import PhoneNumberField from '@/components/auth/PhoneNumberField';
import { CaptchaField } from '@/components/security/CaptchaField';
import {
  formatSavedAccountIdentifier,
  getSavedAccountById,
  getSavedAccountPhoneDraft,
  readSavedAccounts,
  removeSavedAccount,
  type SavedAccount,
} from '@/lib/accountVault';
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
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Trash2,
  User,
  Users,
} from 'lucide-react';

type Mode = 'phone' | 'otp' | 'profile';
const LOGIN_FLOW_STORAGE_KEY = 'lajukan_auth_login_phone_flow_v2';

function getAccountInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'A';
}

export default function LoginClient() {
  const {
    loginWithPhone,
    register,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const selectedAccountQuery =
    searchParams.get('accountId') || searchParams.get('switchAccount');
  const addAccountMode = searchParams.get('addAccount') === '1';
  const redirectTimeoutRef = useRef<number | null>(null);
  const authSuccessTargetRef = useRef<string | null>(null);

  const locale = useMemo(() => {
    const segment = pathname?.split('/')[1];
    return segment && segment.length === 2 ? segment : 'id';
  }, [pathname]);
  const needsCaptcha = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  );

  const [mode, setMode] = useState<Mode>('phone');
  const [phoneCountryCode, setPhoneCountryCode] = useState<PhoneCountryCode>(
    DEFAULT_AUTH_PHONE_COUNTRY,
  );
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState('');
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedSavedAccountId, setSelectedSavedAccountId] = useState<
    string | null
  >(null);

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
  const currentStep = mode === 'phone' ? 1 : mode === 'otp' ? 2 : 3;
  const shellCopy = {
    phone: {
      title: locale === 'id' ? 'Masuk' : 'Sign in',
      description: locale === 'id' ? 'Nomor HP + OTP.' : 'Phone + OTP.',
      progressLabel: locale === 'id' ? 'Masuk' : 'Sign in',
    },
    otp: {
      title: locale === 'id' ? 'Masukkan kode' : 'Enter code',
      description: locale === 'id' ? '6 digit dari SMS.' : '6 digits from SMS.',
      progressLabel: locale === 'id' ? 'Kode' : 'Code',
    },
    profile: {
      title: locale === 'id' ? 'Lengkapi nama' : 'Add your name',
      description: locale === 'id' ? 'Nama saja dulu.' : 'Name first.',
      progressLabel: locale === 'id' ? 'Akun' : 'Account',
    },
  }[mode];
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
            title: 'Data aman',
            description: 'Draft, chat, dan transaksi tetap tersimpan.',
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
            title: 'Data stays ready',
            description: 'Drafts, chats, and transactions stay saved.',
          },
        ];
  const shellHelperText = '';

  const authInputClass =
    'w-full min-h-[50px] rounded-[14px] border border-[color:var(--app-border)] bg-white px-3.5 py-3 text-[15px] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] outline-none transition-[border-color,background-color,box-shadow] focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] sm:text-sm dark:bg-[color:var(--app-surface-strong)]';
  const primaryButtonClass =
    'flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 py-3 text-sm font-bold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)]';
  const utilityButtonClass =
    'flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] sm:w-auto sm:shrink-0 dark:bg-[color:var(--app-surface-strong)]';
  const statusCardClass =
    'rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 py-3';
  const secondaryTextButtonClass =
    'inline-flex min-h-[38px] items-center gap-1 rounded-full text-sm font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)]';
  const clearRedirectFallback = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  const clearLoginDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(LOGIN_FLOW_STORAGE_KEY);
  }, []);

  const applySavedAccount = useCallback(
    (account: SavedAccount) => {
      const phoneDraft = getSavedAccountPhoneDraft(account);
      setSelectedSavedAccountId(account.id);
      setOtp('');
      setOtpToken(null);
      setDevOtp('');
      setCaptchaToken('');
      setError(null);
      setMode('phone');

      if (!phoneDraft) {
        setPhone('');
        setError(
          locale === 'id'
            ? 'Akun ini belum punya nomor HP tersimpan. Masukkan nomor aktif untuk lanjut.'
            : 'This saved account has no phone number. Enter an active number to continue.',
        );
        return;
      }

      setPhoneCountryCode(phoneDraft.countryCode);
      setPhone(phoneDraft.phone);
    },
    [locale],
  );

  const clearSelectedAccount = useCallback(() => {
    setSelectedSavedAccountId(null);
    setPhone('');
    setOtp('');
    setOtpToken(null);
    setDevOtp('');
    setMode('phone');
    setError(null);
    clearLoginDraft();
  }, [clearLoginDraft]);

  const finishLoginRedirect = useCallback(
    (target: string) => {
      if (typeof window === 'undefined') return;
      clearRedirectFallback();
      router.replace(target);
      router.refresh();
      redirectTimeoutRef.current = window.setTimeout(() => {
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== target) {
          window.location.assign(target);
        }
      }, 1200);
    },
    [clearRedirectFallback, router],
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    clearLoginDraft();
    finishLoginRedirect(
      authSuccessTargetRef.current || callbackUrl || `/${locale}/home`,
    );
  }, [
    authLoading,
    callbackUrl,
    clearLoginDraft,
    finishLoginRedirect,
    isAuthenticated,
    locale,
  ]);

  useEffect(() => () => clearRedirectFallback(), [clearRedirectFallback]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshSavedAccounts = () => setSavedAccounts(readSavedAccounts());
    refreshSavedAccounts();
    window.addEventListener('lajukan:saved-accounts', refreshSavedAccounts);

    return () => {
      window.removeEventListener(
        'lajukan:saved-accounts',
        refreshSavedAccounts,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(LOGIN_FLOW_STORAGE_KEY);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as {
        mode?: Mode;
        phone?: string;
        phoneCountryCode?: PhoneCountryCode;
        otpToken?: string | null;
        fullName?: string;
        email?: string;
      };

      if (
        draft.mode === 'phone' ||
        draft.mode === 'otp' ||
        draft.mode === 'profile'
      ) {
        setMode(draft.mode);
      }
      if (typeof draft.phone === 'string') setPhone(draft.phone);
      if (draft.phoneCountryCode) setPhoneCountryCode(draft.phoneCountryCode);
      if (typeof draft.otpToken === 'string') setOtpToken(draft.otpToken);
      if (typeof draft.fullName === 'string') setFullName(draft.fullName);
      if (typeof draft.email === 'string') setEmail(draft.email);
    } catch {
      window.sessionStorage.removeItem(LOGIN_FLOW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (addAccountMode) {
      clearSelectedAccount();
      return;
    }

    if (!selectedAccountQuery) return;

    const account = getSavedAccountById(selectedAccountQuery);
    setSavedAccounts(readSavedAccounts());
    if (!account) {
      setError(
        locale === 'id'
          ? 'Shortcut akun ini tidak ditemukan di perangkat ini.'
          : 'This account shortcut was not found on this device.',
      );
      return;
    }

    clearLoginDraft();
    applySavedAccount(account);
  }, [
    addAccountMode,
    applySavedAccount,
    clearLoginDraft,
    clearSelectedAccount,
    locale,
    selectedAccountQuery,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      LOGIN_FLOW_STORAGE_KEY,
      JSON.stringify({
        mode,
        phone,
        phoneCountryCode,
        otpToken,
        fullName,
        email,
      }),
    );
  }, [email, fullName, mode, otpToken, phone, phoneCountryCode]);

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
    setError(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: normalizedPhone,
          purpose: 'login',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(mapCommonAuthError(data?.error, res.status));
        return;
      }

      setOtp('');
      setOtpToken(null);
      setOtpResendAt(Date.now() + 30_000);
      if (typeof data?.devOtp === 'string') {
        setDevOtp(data.devOtp);
      }
      setMode('otp');
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
    setError(null);

    try {
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: normalizedPhone,
          otp,
          purpose: 'login',
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData?.token) {
        setError(mapCommonAuthError(verifyData?.error, verifyRes.status));
        return;
      }

      const token = String(verifyData.token);
      setOtpToken(token);

      try {
        const destination = callbackUrl ?? `/${locale}/home`;
        authSuccessTargetRef.current = destination;
        await loginWithPhone(normalizedPhone, {
          silent: true,
          redirectTo: destination,
          phoneOtpToken: token,
        });
        finishLoginRedirect(destination);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('phone login is not available')) {
          authSuccessTargetRef.current = null;
          setMode('profile');
          setError(null);
          return;
        }
        setError(mapCommonAuthError(message));
        clearRedirectFallback();
        authSuccessTargetRef.current = null;
      }
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

  const createAccount = async () => {
    if (!otpToken) {
      setError(
        locale === 'id'
          ? 'Verifikasi OTP dulu sebelum lanjut.'
          : 'Verify OTP before continuing.',
      );
      setMode('otp');
      return;
    }
    if (!fullName.trim()) {
      setError(
        locale === 'id'
          ? 'Nama lengkap wajib diisi.'
          : 'Full name is required.',
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
    setError(null);

    try {
      const registerResult = await register({
        phone: normalizedPhone,
        full_name: fullName.trim(),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        phone_otp_token: otpToken,
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      });

      const destination =
        registerResult?.recovery_action === 'login'
          ? (callbackUrl ?? `/${locale}/home`)
          : `/${locale}/onboarding`;

      authSuccessTargetRef.current = destination;
      clearLoginDraft();
      finishLoginRedirect(destination);
    } catch (err) {
      authSuccessTargetRef.current = null;
      const message = err instanceof Error ? err.message : undefined;
      setError(mapCommonAuthError(message));
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveSavedAccount = (id: string) => {
    const nextAccounts = removeSavedAccount(id);
    setSavedAccounts(nextAccounts);
    if (selectedSavedAccountId === id) {
      clearSelectedAccount();
    }
  };

  const renderSavedAccountsPanel = () => {
    if (savedAccounts.length === 0) return null;

    return (
      <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <Users className="h-3.5 w-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold text-[color:var(--app-text)]">
            {locale === 'id' ? 'Akun tersimpan' : 'Saved accounts'}
          </p>
          <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1 text-[10px] font-black text-[color:var(--app-text-soft)]">
            {savedAccounts.length}/8
          </span>
        </div>

        <div className="space-y-2">
          {savedAccounts.map(account => {
            const selected = selectedSavedAccountId === account.id;

            return (
              <div
                key={account.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 rounded-[16px] border p-1.5 transition ${
                  selected
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applySavedAccount(account)}
                  className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] px-1.5 py-1.5 text-left transition hover:bg-[color:var(--app-surface-muted)]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-sm font-black text-[color:var(--app-text-inverse)]">
                    {getAccountInitial(account.displayName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[color:var(--app-text)]">
                      {account.displayName}
                    </span>
                    <span className="block truncate text-xs text-[color:var(--app-text-soft)]">
                      {formatSavedAccountIdentifier(account)}
                    </span>
                  </span>
                  {selected ? (
                    <span className="inline-flex rounded-full bg-[color:var(--app-surface)] px-2 py-1 text-[10px] font-black text-[color:var(--app-accent)]">
                      {locale === 'id' ? 'Dipilih' : 'Selected'}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSavedAccount(account.id)}
                  className="inline-flex h-full min-h-[44px] w-11 items-center justify-center rounded-[12px] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-danger-soft)] hover:text-[color:var(--app-danger)]"
                  aria-label={
                    locale === 'id'
                      ? 'Hapus shortcut akun'
                      : 'Remove account shortcut'
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={clearSelectedAccount}
          className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
        >
          {locale === 'id' ? 'Masuk akun lain' : 'Use another account'}
        </button>
      </div>
    );
  };

  const renderPhoneStep = () => (
    <motion.div
      key="phone"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="space-y-4"
    >
      {renderSavedAccountsPanel()}

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

  const renderOtpStep = () => (
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
          setOtp('');
          setOtpToken(null);
          setError(null);
          setMode('phone');
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
          {selectedCountryFlag} {formatPhonePreview(phone, phoneCountryCode)}
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
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {devOtp && (
        <div className="rounded-[16px] border border-[color:color-mix(in_srgb,_var(--app-warning)_22%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--app-warning-soft)_72%,_var(--app-surface-strong))] px-4 py-3 text-center text-xs text-[color:var(--app-warning)]">
          Dev OTP: <span className="font-mono font-semibold">{devOtp}</span>
        </div>
      )}
    </motion.div>
  );

  const renderProfileStep = () => (
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
          setError(null);
          setMode('otp');
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
          {selectedCountryFlag} {formatPhonePreview(phone, phoneCountryCode)}
        </p>
      </div>

      <div className="relative">
        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
        <input
          type="text"
          value={fullName}
          onChange={event => setFullName(event.target.value)}
          placeholder={locale === 'id' ? 'Nama lengkap' : 'Full name'}
          autoComplete="name"
          className={`${authInputClass} pl-9`}
        />
      </div>

      <input
        type="email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        placeholder={locale === 'id' ? 'Email opsional' : 'Optional email'}
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
        onClick={createAccount}
        disabled={registering || !fullName.trim()}
        className={primaryButtonClass}
      >
        {registering ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {locale === 'id'
              ? 'Buat akun dan masuk'
              : 'Create account and continue'}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </motion.div>
  );

  const renderCurrentStep = () => {
    switch (mode) {
      case 'phone':
        return renderPhoneStep();
      case 'otp':
        return renderOtpStep();
      case 'profile':
        return renderProfileStep();
      default:
        return null;
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
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full min-w-0 antialiased"
      >
        <AnimatePresence mode="wait">{renderCurrentStep()}</AnimatePresence>

        {error && (
          <p className="mt-4 rounded-[16px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]">
            {error}
          </p>
        )}

        <div className="mt-4 text-center text-sm text-[color:var(--app-text-soft)]">
          <span>{locale === 'id' ? 'Belum punya akun?' : 'New here?'}</span>{' '}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/register`)}
            className="font-semibold text-[color:var(--app-accent)] transition hover:text-[color:var(--app-accent-strong)]"
          >
            {locale === 'id' ? 'Daftar' : 'Register'}
          </button>
        </div>
      </motion.main>
    </AuthFlowShell>
  );
}
