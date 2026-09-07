'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MailCheck, X } from 'lucide-react';

type Invitation = {
  id: string;
  org_id: string;
  organization_name: string;
  role: string;
  expires_at: string;
};

function extractInvitations(payload: unknown): Invitation[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(root.items) ? root.items : [];
  return items.filter((item): item is Invitation => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return typeof row.id === 'string' && typeof row.organization_name === 'string';
  });
}

function roleLabel(role: string) {
  return (
    {
      org_admin: 'Admin usaha',
      org_manager: 'Manager',
      org_cashier: 'Kasir',
      org_inventory: 'Stok & pembelian',
      org_accounting: 'Keuangan',
      org_viewer: 'Pantau saja',
    }[role] || role
  );
}

export function PendingOrganizationInvitations() {
  const router = useRouter();
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/team/invitations', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Gagal memuat undangan tim.');
        return response.json();
      })
      .then(payload => setItems(extractInvitations(payload)))
      .catch(fetchError => {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat undangan tim.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function respond(invitationId: string, action: 'accept' | 'reject') {
    setWorkingId(invitationId);
    setError('');
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Undangan belum berhasil diproses.');
      setItems(current => current.filter(item => item.id !== invitationId));
      startTransition(() => router.refresh());
    } catch (responseError) {
      setError(
        responseError instanceof Error ? responseError.message : 'Undangan belum berhasil diproses.',
      );
    } finally {
      setWorkingId('');
    }
  }

  if (loading) {
    return <p className="text-sm text-portal-soft">Memeriksa undangan usaha...</p>;
  }
  if (!items.length && !error) return null;

  return (
    <div className="grid gap-3">
      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {items.map(invitation => (
        <article
          key={invitation.id}
          className="rounded-2xl border border-portal-line bg-white p-4 shadow-sm"
        >
          <div className="flex gap-3">
            <span className="portal-icon-tile h-10 w-10 shrink-0">
              <MailCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-portal-ink">{invitation.organization_name}</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">
                Diundang sebagai {roleLabel(invitation.role)}. Undangan berlaku sampai{' '}
                {new Date(invitation.expires_at).toLocaleDateString('id-ID')}.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={workingId === invitation.id}
              onClick={() => void respond(invitation.id, 'accept')}
              className="portal-button-primary"
            >
              <Check className="h-4 w-4" /> Terima
            </button>
            <button
              type="button"
              disabled={workingId === invitation.id}
              onClick={() => void respond(invitation.id, 'reject')}
              className="portal-button-secondary"
            >
              <X className="h-4 w-4" /> Tolak
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
