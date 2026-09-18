'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';
import { resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';

export function ReconcileBusinessButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const attemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  async function reconcile() {
    const requestBody = { action: 'reconcile_business' };
    const attempt = resolveIdempotencyAttempt(attemptRef.current, requestBody);
    attemptRef.current = attempt;

    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/businesses/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key },
        body: JSON.stringify({ idempotencyKey: attempt.key }),
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
      {error ? <p role="alert" className="mt-2 text-xs text-portal-ember">{error}</p> : null}
    </div>
  );
}
