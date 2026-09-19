'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/ui';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Login Google belum dikonfigurasi.',
  google_oauth_cancelled: 'Login Google dibatalkan.',
  oauth_state_invalid: 'Sesi login Google kedaluwarsa. Coba lagi.',
  google_email_not_verified: 'Email Google belum terverifikasi.',
  google_account_not_authorized_for_cms: 'Akun Google ini belum memiliki akses CMS Lajukan.',
  google_oauth_error: 'Login Google gagal. Coba lagi.',
};

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const initialGoogleError =
    typeof window !== 'undefined'
      ? GOOGLE_ERROR_MESSAGES[new URLSearchParams(window.location.search).get('error') || ''] || ''
      : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const nextPath = typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('next');
      await login(email, password, nextPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = () => {
    const nextPath =
      typeof window === 'undefined'
        ? '/'
        : new URLSearchParams(window.location.search).get('next') || '/';
    window.location.assign('/api/auth/google?callbackUrl=' + encodeURIComponent(nextPath));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[color:var(--color-text)] mb-1">Lajukan CMS</h1>
        <p className="text-sm text-[color:var(--color-text)] mb-6">Kelola konten & sektor</p>

        {(error || initialGoogleError) && (
          <div className="mb-4 p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
            {error || initialGoogleError}
          </div>
        )}

        <Button type="button" onClick={continueWithGoogle} className="w-full">
          Lanjut dengan Google
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-[color:var(--color-text)] opacity-70">
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
          <span>atau</span>
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email atau username" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com atau @username" autoComplete="username" required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Memproses...' : 'Masuk dengan password'}
          </Button>
        </form>

        <p className="mt-6 text-center">
          <a href={process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'} className="text-sm text-[color:var(--color-text)] hover:text-[color:var(--color-text)]">← Kembali ke situs</a>
        </p>
      </div>
    </div>
  );
}
