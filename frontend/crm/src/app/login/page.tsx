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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_88%,_transparent)] p-7 shadow-lg shadow-[var(--color-shadow)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">
          CRM Ops
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
          Lajukan CRM Security Login
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-text)]">
          CRM dipakai untuk approval transaksi, trust hold, support, dan review
          risiko. Karena itu akses agent dibuat dua langkah.
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
            Dev OTP: <span className="font-semibold tracking-[0.3em]">{devOtp}</span>
          </div>
        ) : null}

        {step === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Memproses...' : 'Lanjut ke verifikasi'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_85%,_transparent)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text)]">
                Step 2 of 2
              </p>
              <p className="mt-2 text-sm text-[color:var(--color-text)]">
                Masukkan OTP yang dikirim ke{' '}
                <span className="font-semibold">{pendingEmail || email}</span>.
              </p>
            </div>
            <Input
              label="OTP Email"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Memverifikasi...' : 'Masuk ke CRM'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => void handleResend()}
                className="flex-1"
              >
                Kirim ulang OTP
              </Button>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-sm font-medium text-[color:var(--color-text)] underline-offset-4 hover:underline"
            >
              Ganti akun / ulangi login
            </button>
          </form>
        )}

        <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_80%,_transparent)] px-4 py-3 text-xs text-[color:var(--color-text)]">
          Aksi sensitif seperti approve trust profile, manual hold, dan perubahan
          order berisiko juga akan meminta step-up OTP ulang di dalam CRM.
        </div>

        <p className="mt-6 text-center">
          <a
            href={process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'}
            className="text-sm text-[color:var(--color-text)] hover:text-[color:var(--color-text)]"
          >
            &larr; Kembali ke situs
          </a>
        </p>
      </div>
    </div>
  );
}
