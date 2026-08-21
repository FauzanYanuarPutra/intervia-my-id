'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import type { PortalRole } from '@/lib/portal-types';

type InviteMemberQuickFormProps = {
  businessId: string;
};

const roleOptions: Array<{ value: PortalRole; label: string }> = [
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'viewer', label: 'Pantau saja' },
];

export function InviteMemberQuickForm({ businessId }: InviteMemberQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<PortalRole>('manager');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Nama anggota belum valid.');
      return;
    }

    if (phone.replace(/\s+/g, '').trim().length < 9) {
      setError('Nomor HP anggota belum valid.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch(`/api/businesses/${businessId}/team/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          role,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Undangan belum berhasil dikirim.');
        return;
      }

      setName('');
      setPhone('');
      setRole('manager');
      setSuccess('Undangan terkirim.');
      startTransition(() => {
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
        Nama anggota
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Nama tim"
          className="portal-input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Nomor HP
          <input
            inputMode="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="0812 1111 2222"
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Peran
          <select
            value={role}
            onChange={event => setRole(event.target.value as PortalRole)}
            className="portal-input"
          >
            {roleOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        <Send className="h-4 w-4" />
        {isPending ? 'Mengirim...' : 'Kirim undangan'}
      </button>
    </form>
  );
}
