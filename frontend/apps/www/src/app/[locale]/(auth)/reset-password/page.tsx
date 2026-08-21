'use client';

import { useState, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import LajukanLogo from '@/components/logo/LajuloLogo';
import { validatePasswordStrength } from '@/lib/passwordPolicy';

export default function ResetPasswordPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const mode = searchParams.get('mode');
  const otpEmail = searchParams.get('email') || '';

  const locale = useMemo(() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  }, [pathname]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const isOtpMode = mode === 'otp' && !!otpEmail;
  const isLinkMode = !!token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isOtpMode && otp.length !== 6) {
      setError('OTP code must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = isOtpMode
        ? { mode: 'otp', email: otpEmail, otp, password }
        : { mode: 'link', token, password };

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isLinkMode && !isOtpMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-[color:var(--app-danger)] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-2">
            Invalid Reset Link
          </h1>
          <p className="text-[color:var(--app-text)] mb-4">
            This password reset link is invalid or has expired.
          </p>
          <button
            onClick={() => router.push(`/${locale}/forgot-password`)}
            className="px-6 py-2 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-lg text-sm font-medium"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle className="w-16 h-16 text-[color:var(--app-accent)] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-2">
            Password Reset Complete
          </h1>
          <p className="text-[color:var(--app-text)] mb-4">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="w-full py-3 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-xl text-sm font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="cursor-pointer mb-4" onClick={() => router.push(`/${locale}/home`)}>
            <LajukanLogo />
          </div>
          <div className="w-16 h-16 bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[color:var(--app-accent)]" />
          </div>
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Create New Password
          </h1>
          <p className="text-sm text-[color:var(--app-text)] mt-1">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isOtpMode && (
            <input
              type="text"
              required
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="OTP Code"
              className="w-full px-4 py-3 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] rounded-xl text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
            />
          )}

          <input
            type="password"
            required
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
          />
          <input
            type="password"
            required
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
          />

          {error && (
            <p className="text-[color:var(--app-danger)] text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}