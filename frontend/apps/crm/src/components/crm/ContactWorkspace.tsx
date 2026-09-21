'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import type { SuperAppOrder, SuperAppTrustProfile, SupportTicket } from '@/lib/api';
import type { CrmListingRow, CrmUserRow } from './models';
import { buildContact360 } from './contact360';
import { ContactDetail } from './ContactDetail';

function readUserIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('user') || '';
}

function writeUserUrl(id: string, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('page', 'users');
  if (id) url.searchParams.set('user', id);
  else url.searchParams.delete('user');
  const next = url.pathname + url.search + url.hash;
  if (mode === 'replace') window.history.replaceState({ crmUser: id }, '', next);
  else window.history.pushState({ crmUser: id }, '', next);
}

export function ContactWorkspace({
  users,
  listings,
  orders,
  tickets,
  trustProfiles,
  onTrustAction,
}: {
  users: CrmUserRow[];
  listings: CrmListingRow[];
  orders: SuperAppOrder[];
  tickets: SupportTicket[];
  trustProfiles: SuperAppTrustProfile[];
  onTrustAction: (
    user: CrmUserRow,
    action: 'approve' | 'reject' | 'warn' | 'hold' | 'release',
  ) => void;
}) {
  const [selectedId, setSelectedId] = useState(() => readUserIdFromUrl());
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? users.filter(user =>
          (user.name + ' ' + user.handle + ' ' + user.role + ' ' + user.city)
            .toLowerCase()
            .includes(q),
        )
      : users;
  }, [users, query]);

  const selected = users.find(user => user.id === selectedId) || null;
  const model = selected
    ? buildContact360({
        user: selected,
        listings,
        orders,
        tickets,
        trustProfile: trustProfiles.find(profile => profile.user_id === selected.id) || null,
      })
    : null;

  useEffect(() => {
    if (selectedId && !users.some(user => user.id === selectedId)) {
      setSelectedId('');
      writeUserUrl('', 'replace');
    }
  }, [selectedId, users]);

  useEffect(() => {
    const handlePopState = () => setSelectedId(readUserIdFromUrl());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectUser = (id: string) => {
    setSelectedId(id);
    writeUserUrl(id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kontak & User"
        description="Cari user real, pahami status KYC/trust, lalu buka Customer 360. Action trust mengubah state backend dan harus dipakai untuk keputusan operasional."
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <strong className="text-slate-900">Apa bedanya User dan Lead?</strong>{' '}
        User adalah akun yang sudah ada di Identity. Lead adalah peluang/follow-up bisnis yang belum tentu sudah menjadi customer atau transaksi.
        Pilih user untuk melihat konteks transaksi, listing, ticket, dan trust yang tersedia.
      </div>

      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Cari nama, handle, role, atau kota"
        className="min-h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 text-sm outline-none focus:ring-4 focus:ring-emerald-100"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(user => (
          <Card key={user.id} className="p-4">
            <button type="button" onClick={() => selectUser(user.id)} className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{user.name}</p>
                  <p className="text-xs text-[color:var(--color-text-soft)]">{user.handle} · {user.city}</p>
                </div>
                <StatusBadge tone={user.risk === 'high' ? 'danger' : user.risk === 'medium' ? 'warning' : 'success'}>
                  {user.risk}
                </StatusBadge>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                KYC: {user.kyc} · Trust: {user.approvalStatus}
              </p>
            </button>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onTrustAction(user, 'approve')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                Approve
              </button>
              <button onClick={() => onTrustAction(user, 'reject')} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                Reject
              </button>
              <button onClick={() => onTrustAction(user, user.manualHold ? 'release' : 'hold')} className="rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-bold">
                {user.manualHold ? 'Lepas hold' : 'Hold'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState
          title="Tidak ada user yang cocok"
          description="Ubah pencarian atau periksa status service Identity. CRM tidak membuat user dummy ketika API kosong."
        />
      ) : null}

      {model ? <ContactDetail model={model} /> : null}
    </div>
  );
}
