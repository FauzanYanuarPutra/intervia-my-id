'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/ui';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Login Google belum dikonfigurasi.',
  google_oauth_cancelled: 'Login Google dibatalkan.',
  oauth_state_invalid: 'Sesi login Google kedaluwarsa. Coba lagi.',
  google_email_not_verified: 'Email Google belum terverifikasi.',
  google_account_not_authorized_for_cms: 'Akun Google ini belum memiliki akses CMS Lajukan.',
  google_oauth_error: 'Login Google gagal. Coba lagi.',
};

export default function LoginPage() {
  const initialGoogleError =
    typeof window !== 'undefined'
      ? GOOGLE_ERROR_MESSAGES[new URLSearchParams(window.location.search).get('error') || ''] || ''
      : '';

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

        <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3 text-sm text-[color:var(--color-text)]">
          Akses CMS hanya untuk akun Google yang sudah disetujui oleh Platform Owner Lajukan.
        </div>

        <p className="mt-6 text-center">
          <a href={process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'} className="text-sm text-[color:var(--color-text)] hover:text-[color:var(--color-text)]">← Kembali ke situs</a>
        </p>
      </div>
    </div>
  );
}
