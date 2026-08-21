'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export function LoginQuickForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = phone.replace(/\s+/g, '').trim();

    if (normalizedPhone.length < 9) {
      setError('Masukkan nomor HP yang aktif.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalizedPhone,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? 'Login belum berhasil. Coba lagi.');
        return;
      }

      setSuccess('Akun ditemukan. Masuk ke dashboard...');
      startTransition(() => {
        router.push(result.redirectTo!);
        router.refresh();
      });
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Nomor HP
        <input
          autoFocus
          inputMode="tel"
          placeholder="0812 1111 2222"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          className="portal-input"
        />
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        {isPending ? 'Masuk...' : 'Masuk sekarang'}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
