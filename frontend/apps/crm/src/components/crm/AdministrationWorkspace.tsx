'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, PageHeader } from 'lajukan-ui';

type Candidate = {
  id: string; email: string; username?: string | null; full_name?: string | null;
  status: string; email_verified: boolean; phone_verified: boolean;
  identity_verified: boolean; eligible: boolean;
};
type Invitation = {
  id: string; application: string; role_names: string[]; status: string;
  expires_at: string; created_at: string; invitee_user_id: string;
  email: string; username?: string | null; full_name?: string | null;
};

const roleOptions = {
  crm: [
    ['moderator', 'Moderator — review & moderasi konten'],
    ['support', 'Support — ticket & bantuan pengguna'],
    ['sales', 'Sales — lead & follow-up'],
    ['admin', 'Admin — operasi CRM lebih luas'],
  ],
  cms: [
    ['content_admin', 'Content Admin — editorial/CMS'],
    ['admin', 'Admin — operasi CMS lebih luas'],
  ],
} as const;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store', headers: {
    'Content-Type': 'application/json', ...(init?.headers || {}),
  }});
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body.error || body.message || `HTTP ${res.status}`));
  return body as T;
}

export function AdministrationWorkspace() {
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [application, setApplication] = useState<'crm' | 'cms'>('crm');
  const [roles, setRoles] = useState<string[]>(['moderator']);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadInvitations = useCallback(async () => {
    try {
      const data = await json<{data: Invitation[]}>('/api/backoffice/invitations');
      setInvitations(data.data || []);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal memuat undangan.'); }
  }, []);

  useEffect(() => { void loadInvitations(); }, [loadInvitations]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true); setMessage('');
    try {
      const data = await json<{data: Candidate[]}>(`/api/backoffice/candidates?q=${encodeURIComponent(q.trim())}`);
      setCandidates(data.data || []);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Pencarian gagal.'); }
    finally { setBusy(false); }
  };

  const invite = async () => {
    if (!selected || !roles.length) return;
    setBusy(true); setMessage('');
    try {
      await json('/api/backoffice/invitations', {
        method: 'POST',
        body: JSON.stringify({ invitee_user_id: selected.id, application, role_names: roles, expires_in_days: 7 }),
      });
      setMessage(`Undangan ${application.toUpperCase()} dikirim ke @${selected.username || selected.email}.`);
      await loadInvitations();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal membuat undangan.'); }
    finally { setBusy(false); }
  };

  const changeApplication = (value: 'crm' | 'cms') => {
    setApplication(value);
    setRoles(value === 'crm' ? ['moderator'] : ['content_admin']);
  };

  const toggleRole = (role: string) => setRoles(current =>
    current.includes(role) ? current.filter(x => x !== role) : [...current, role]
  );

  return <div className="space-y-5">
    <PageHeader title="Administrasi & Akses Tim" description="Platform Owner mengundang akun Lajukan yang sudah terdaftar. Akses backoffice aktif setelah pengguna menerima undangan." />
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search(); }}
          placeholder="Cari username, nama, atau email…" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
        <button disabled={busy || q.trim().length < 2} onClick={() => void search()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-[color:var(--color-primary)] text-white disabled:opacity-50">Cari</button>
      </div>
      {message ? <p className="mt-3 rounded-xl border px-3 py-2 text-sm">{message}</p> : null}
      <div className="mt-4 space-y-2">
        {candidates.map(candidate => <button key={candidate.id} onClick={() => setSelected(candidate)}
          className={`w-full rounded-xl border p-3 text-left ${selected?.id === candidate.id ? 'border-[color:var(--color-primary)]' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div><div className="font-semibold">{candidate.username ? '@' + candidate.username : candidate.full_name || candidate.email}</div>
              <div className="text-xs opacity-70">{candidate.full_name || candidate.email}</div></div>
            <span className={candidate.eligible ? 'text-xs font-semibold' : 'text-xs opacity-60'}>{candidate.eligible ? 'Siap diundang' : 'Belum eligible'}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] opacity-75">
            <span>Email {candidate.email_verified ? '✓' : '—'}</span><span>Phone {candidate.phone_verified ? '✓' : '—'}</span><span>Identity {candidate.identity_verified ? '✓' : '—'}</span>
          </div>
        </button>)}
      </div>
    </Card>
    {selected ? <Card className="p-5">
      <h2 className="font-bold">Undang {selected.username ? '@' + selected.username : selected.email}</h2>
      <div className="mt-4 flex gap-2">
        {(['crm','cms'] as const).map(app => <button key={app} onClick={() => changeApplication(app)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${application === app ? 'border-[color:var(--color-primary)]' : ''}`}>{app.toUpperCase()}</button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {roleOptions[application].map(([role,label]) => <label key={role} className="flex gap-2 rounded-xl border p-3 text-sm">
          <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} /> <span>{label}</span>
        </label>)}
      </div>
      <button disabled={busy || !selected.eligible || !roles.length} onClick={() => void invite()} className="mt-4 rounded-xl bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Kirim undangan 7 hari</button>
    </Card> : null}
    <Card className="p-5">
      <h2 className="font-bold">Riwayat undangan</h2>
      <div className="mt-3 space-y-2">{invitations.map(inv => <div key={inv.id} className="rounded-xl border p-3 text-sm">
        <div className="flex justify-between gap-3"><span className="font-semibold">{inv.username ? '@'+inv.username : inv.email}</span><span>{inv.status}</span></div>
        <div className="mt-1 text-xs opacity-70">{inv.application.toUpperCase()} · {inv.role_names.join(', ')}</div>
      </div>)}</div>
    </Card>
  </div>;
}
