'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';
import LajukanLogo from '@/components/logo/LajuloLogo';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const pathname = usePathname();

  const locale = useMemo(() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  }, [pathname]);

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'link' | 'otp'>('link');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Masukkan email yang valid');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), mode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Gagal mengirim email reset');
        return;
      }

      setSent(true);
      if (mode === 'otp') {
        router.push(
          `/${locale}/reset-password?mode=otp&email=${encodeURIComponent(
            email.trim().toLowerCase(),
          )}`,
        );
      }
    } catch {
      setError('Gagal mengirim email reset');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <CheckCircle className="w-16 h-16 text-[color:var(--app-accent)] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-2">
            Cek Email Anda
          </h1>
          <p className="text-sm text-[color:var(--app-text)] mb-6">
            Jika akun ditemukan, link reset password sudah dikirim ke email Anda.
          </p>
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="w-full py-3 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-xl text-sm font-medium"
          >
            Kembali ke Login
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
            <Mail className="w-8 h-8 text-[color:var(--app-accent)]" />
          </div>
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">Lupa Password</h1>
          <p className="text-sm text-[color:var(--app-text)] mt-1">Masukkan email untuk menerima link reset</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`py-2 rounded-lg text-xs font-semibold border ${
                mode === 'link'
                  ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] border-[color:var(--app-accent-border)]'
                  : 'border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]'
              }`}
            >
              Via Link Email
            </button>
            <button
              type="button"
              onClick={() => setMode('otp')}
              className={`py-2 rounded-lg text-xs font-semibold border ${
                mode === 'otp'
                  ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] border-[color:var(--app-accent-border)]'
                  : 'border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]'
              }`}
            >
              Via OTP Email
            </button>
          </div>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
          />

          {error && (
            <p className="text-xs text-[color:var(--app-danger)] flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'otp' ? (
              'Kirim OTP Reset'
            ) : (
              'Kirim Link Reset'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}