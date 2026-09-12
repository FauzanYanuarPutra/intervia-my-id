'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MailCheck, X } from 'lucide-react';
import { organizationRoleLabel } from '@/lib/business-collaboration';
import {
  invitationExpiryLabel,
  parsePendingInvitations,
  type PendingOrganizationInvitation,
} from '@/lib/invitation-ui';

type PendingOrganizationInvitationsProps = {
  showEmpty?: boolean;
};

export function PendingOrganizationInvitations({ showEmpty = false }: PendingOrganizationInvitationsProps) {
  const router = useRouter();
  const [items, setItems] = useState<PendingOrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/team/invitations', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Gagal memuat undangan usaha.');
        return response.json();
      })
      .then(payload => setItems(parsePendingInvitations(payload)))
      .catch(fetchError => {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat undangan usaha.');
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
    setNotice('');
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Undangan belum berhasil diproses.');
      setItems(current => current.filter(item => item.id !== invitationId));
      setNotice(
        action === 'accept'
          ? 'Undangan diterima. Usaha akan muncul di daftar usahamu setelah akses tersinkron.'
          : 'Undangan ditolak. Akses ke usaha tidak diberikan.',
      );
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
  if (!items.length && !error && !notice && !showEmpty) return null;

  return (
    <div className="grid gap-3">
      {error ? <p className="rounded-xl border border-portal-ember/20 bg-portal-ember/5 px-3 py-2 text-sm text-portal-ember">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-portal-forest/20 bg-portal-forest/5 px-3 py-2 text-sm text-portal-forest">{notice}</p> : null}
      {!items.length && showEmpty ? (
        <div className="rounded-2xl border border-dashed border-portal-line bg-white p-6 text-center">
          <MailCheck className="mx-auto h-6 w-6 text-portal-forest" />
          <p className="mt-3 font-bold text-portal-ink">Tidak ada undangan yang menunggu</p>
          <p className="mt-1 text-sm leading-6 text-portal-soft">Kalau pemilik usaha mengundang akunmu, undangannya akan muncul di sini dan belum memberi akses sebelum kamu menerimanya.</p>
        </div>
      ) : null}
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
              <p className="font-bold text-portal-ink">{invitation.organizationName}</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">
                Kamu diundang sebagai <strong>{organizationRoleLabel(invitation.role)}</strong>. {invitationExpiryLabel(invitation.expiresAt)}.
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
              <Check className="h-4 w-4" /> {workingId === invitation.id ? 'Memproses...' : 'Terima & ikut usaha'}
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
