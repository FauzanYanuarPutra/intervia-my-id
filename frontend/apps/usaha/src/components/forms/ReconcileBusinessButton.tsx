'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';

export function ReconcileBusinessButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function reconcile() {
    setPending(true);
    setError('');
    const idempotencyKey = crypto.randomUUID();
    try {
      const response = await fetch('/api/businesses/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      });
      const result = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error(result.error || 'Usaha lama belum ditemukan.');
      router.push(result.redirectTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Koneksi bermasalah.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={reconcile} disabled={pending} className="portal-button-secondary">
        <History className="h-4 w-4" /> {pending ? 'Mencari usaha...' : 'Pulihkan usaha lama'}
      </button>
      {error ? <p className="mt-2 text-xs text-portal-ember">{error}</p> : null}
    </div>
  );
}
