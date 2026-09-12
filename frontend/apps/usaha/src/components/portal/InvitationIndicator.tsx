'use client';

import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { organizationRoleLabel } from '@/lib/business-collaboration';
import {
  activeInvitationCount,
  INVITATIONS_CHANGED_EVENT,
  invitationExpiryLabel,
  parsePendingInvitations,
  type PendingOrganizationInvitation,
} from '@/lib/invitation-ui';

export function InvitationIndicator() {
  const [items, setItems] = useState<PendingOrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function loadInvitations() {
      controller?.abort();
      const nextController = new AbortController();
      controller = nextController;
      try {
        const response = await fetch('/api/team/invitations', {
          signal: nextController.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Undangan belum bisa dimuat.');
        const payload = await response.json();
        if (!active || nextController.signal.aborted) return;
        setItems(parsePendingInvitations(payload));
        setError('');
      } catch (fetchError) {
        if (
          active &&
          !(fetchError instanceof DOMException && fetchError.name === 'AbortError')
        ) {
          setError(fetchError instanceof Error ? fetchError.message : 'Undangan belum bisa dimuat.');
        }
      } finally {
        if (active && !nextController.signal.aborted) setLoading(false);
      }
    }

    const refresh = () => void loadInvitations();
    void loadInvitations();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener(INVITATIONS_CHANGED_EVENT, refresh);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(INVITATIONS_CHANGED_EVENT, refresh);
    };
  }, []);

  const count = activeInvitationCount(items);

  return (
    <details className="group relative">
      <summary
        aria-label={count ? `${count} undangan usaha menunggu` : 'Undangan usaha'}
        className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-portal-line bg-white text-portal-soft transition hover:bg-portal-mist hover:text-portal-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-portal-ember px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[18px] border border-portal-line bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,.5)]">
        <div className="border-b border-portal-line px-4 py-3">
          <p className="text-sm font-bold text-portal-ink">Undangan & akses</p>
          <p className="mt-0.5 text-xs text-portal-soft">
            {count ? `${count} undangan menunggu jawabanmu.` : 'Tidak ada undangan baru.'}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? <p className="px-4 py-4 text-sm text-portal-soft">Memeriksa undangan...</p> : null}
          {error ? <p className="px-4 py-4 text-sm text-portal-ember">{error}</p> : null}
          {!loading && !error && count === 0 ? (
            <p className="px-4 py-4 text-sm text-portal-soft">Kalau ada usaha yang mengundangmu, undangannya akan muncul di sini.</p>
          ) : null}
          {items
            .filter(item => item.status === 'pending')
            .slice(0, 4)
            .map(item => (
              <Link
                key={item.id}
                href="/access"
                className="flex items-start gap-3 border-b border-portal-line px-4 py-3 transition last:border-b-0 hover:bg-portal-mist/70"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest">
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-portal-ink">{item.organizationName}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-portal-soft">
                    Sebagai {organizationRoleLabel(item.role)} · {invitationExpiryLabel(item.expiresAt)}
                  </span>
                </span>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-portal-soft" />
              </Link>
            ))}
        </div>

        <div className="border-t border-portal-line p-2">
          <Link href="/access" className="flex min-h-10 items-center justify-center rounded-xl text-sm font-bold text-portal-forest transition hover:bg-portal-mist">
            Kelola undangan & akses
          </Link>
        </div>
      </div>
    </details>
  );
}
