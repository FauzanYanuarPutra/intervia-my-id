'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/ui';

export default function LoginPage() {
  const {
    login,
    pendingEmail,
    resendLoginOtp,
    completeLoginOtp,
    cancelPendingLogin,
  } = useAuth();

  const defaultEmail =
    process.env.NEXT_PUBLIC_CRM_DEFAULT_EMAIL ||
    (process.env.NODE_ENV === 'production' ? '' : 'agent@lajukan.com');
  const defaultPassword =
    process.env.NEXT_PUBLIC_CRM_DEFAULT_PASSWORD ||
    (process.env.NODE_ENV === 'production' ? '' : 'Test123!@#');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'password' | 'otp'>(
    pendingEmail ? 'otp' : 'password',
  );

  useEffect(() => {
    setStep(pendingEmail ? 'otp' : 'password');
  }, [pendingEmail]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setDevOtp('');
    setLoading(true);
    try {
      const result = await login(email, password);
      setStep('otp');
      setNotice(
        result?.message ||
          'OTP sudah dikirim ke email Anda. Masukkan kode untuk masuk ke CRM.',
      );
      setDevOtp(result?.devOtp || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await completeLoginOtp(otp);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verifikasi OTP gagal. Coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setDevOtp('');
    setLoading(true);
    try {
      const result = await resendLoginOtp();
      setNotice(
        result?.message ||
          'OTP baru sudah dikirim. Periksa email CRM Anda.',
      );
      setDevOtp(result?.devOtp || '');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim ulang OTP.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    cancelPendingLogin();
    setStep('password');
    setOtp('');
    setDevOtp('');
    setNotice('');
    setError('');
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-3 py-4 sm:px-5">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_92%,_transparent)] shadow-[0_28px_70px_color-mix(in_srgb,var(--color-text)_12%,transparent)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-primary)]">
            CRM Ops
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--color-text)] sm:text-3xl">
            Masuk CRM
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--color-text)]">
            Akses agent untuk transaksi, support, trust hold, dan review risiko.
          </p>

          {error ? (
            <div className="mt-5 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-5 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">
              {notice}
            </div>
          ) : null}
          {devOtp ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-soft)] px-4 py-3 text-sm text-[color:var(--color-warning)]">
              Dev OTP:{' '}
              <span className="font-semibold tracking-[0.3em]">{devOtp}</span>
            </div>
          ) : null}

          {step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agent@lajukan.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password agent"
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Memproses...' : 'Lanjut verifikasi'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_85%,_transparent)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                  Verifikasi 2 langkah
                </p>
                <p className="mt-2 text-sm text-[color:var(--color-text)]">
                  OTP dikirim ke{' '}
                  <span className="font-semibold">{pendingEmail || email}</span>.
                </p>
              </div>
              <Input
                label="Kode OTP"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={e =>
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-lg font-semibold tracking-[0.24em]"
                required
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Memverifikasi...' : 'Masuk CRM'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => void handleResend()}
                  className="w-full"
                >
                  Kirim ulang
                </Button>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-sm font-medium text-[color:var(--color-text)] underline-offset-4 hover:underline"
              >
                Ganti akun
              </button>
            </form>
          )}

          <p className="mt-6 text-center">
            <a
              href={process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'}
              className="text-sm font-medium text-[color:var(--color-text)] hover:text-[color:var(--color-primary)]"
            >
              &larr; Kembali ke situs
            </a>
          </p>
        </section>

        <aside className="border-t border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
            Security
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            Kenapa 2 langkah?
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--color-text)]">
            <p>CRM bisa approve transaksi, trust hold, dan review risiko.</p>
            <p>Aksi sensitif akan minta OTP ulang di dalam dashboard.</p>
            <p>Semua keputusan agent masuk audit log.</p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[color:var(--color-text)]">
            {['OTP', 'Role', 'Audit'].map(item => (
              <span
                key={item}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-2"
              >
                {item}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
