'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export function RegisterQuickForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Masukkan nama lengkap.');
      return;
    }

    if (phone.replace(/\s+/g, '').trim().length < 9) {
      setError('Masukkan nomor HP yang aktif.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? 'Pendaftaran belum berhasil. Coba lagi.');
        return;
      }

      setSuccess('Akun dibuat. Lanjut ke form usaha...');
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
        Nama lengkap
        <input
          autoFocus
          placeholder="Nama pemilik usaha"
          value={name}
          onChange={event => setName(event.target.value)}
          className="portal-input"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Nomor HP
        <input
          inputMode="tel"
          placeholder="0812 1111 2222"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          className="portal-input"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Email
        <input
          inputMode="email"
          placeholder="opsional@email.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          className="portal-input"
        />
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        {isPending ? 'Lanjut...' : 'Lanjut tambah usaha'}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
