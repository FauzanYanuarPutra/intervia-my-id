'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import type { BusinessRecord } from '@/lib/portal-types';

type OperationsQuickFormProps = {
  business: BusinessRecord;
};

export function OperationsQuickForm({ business }: OperationsQuickFormProps) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(business.schedule);
  const [isOpen, setIsOpen] = useState(business.isOpen);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (schedule.trim().length < 5) {
      setError('Jam buka belum valid.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch(`/api/businesses/${business.id}/operations`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule: schedule.trim(),
          isOpen,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Operasional belum tersimpan.');
        return;
      }

      setSuccess(isOpen ? 'Usaha ditandai sedang buka.' : 'Usaha ditandai tutup.');
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
      <div className="grid gap-2">
        <span className="text-sm font-semibold text-portal-ink">Status usaha</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`min-h-12 rounded-2xl border px-4 text-sm font-semibold transition ${
              isOpen
                ? 'border-portal-forest bg-portal-forest text-white'
                : 'border-portal-line bg-white text-portal-ink'
            }`}
          >
            Sedang buka
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className={`min-h-12 rounded-2xl border px-4 text-sm font-semibold transition ${
              !isOpen
                ? 'border-portal-ember bg-portal-ember text-white'
                : 'border-portal-line bg-white text-portal-ink'
            }`}
          >
            Tutup dulu
          </button>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Jam buka
        <input
          value={schedule}
          onChange={event => setSchedule(event.target.value)}
          placeholder="08.00 - 20.00"
          className="portal-input"
        />
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        <Save className="h-4 w-4" />
        {isPending ? 'Menyimpan...' : 'Simpan operasional'}
      </button>
    </form>
  );
}
