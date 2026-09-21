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
type PrivacyRequest = {
  id: string; subject_user_id: string; request_type: string; status: string;
  requested_at: string; due_at?: string | null; decision_note?: string | null;
};
type SecurityIncident = {
  id: string; severity: string; status: string; discovered_at: string;
  notification_due_at?: string | null; affected_user_count?: number | null;
  summary: string; legal_hold: boolean;
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
  const [application, setApplication] = useState<'crm' | 'cms'>('cms');
  const [roles, setRoles] = useState<string[]>(['content_admin']);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);
  const [busy, setBusy] = useState(false);
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [incidentSeverity, setIncidentSeverity] = useState('medium');
  const [incidentSummary, setIncidentSummary] = useState('');
  const [message, setMessage] = useState('');

  const loadInvitations = useCallback(async () => {
    try {
      const data = await json<{data: Invitation[]}>('/api/backoffice/invitations');
      setInvitations(data.data || []);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal memuat undangan.'); }
  }, []);

  const loadGovernance = useCallback(async () => {
    try {
      const [privacy, security] = await Promise.all([
        json<{data: PrivacyRequest[]}>('/api/backoffice/governance/privacy'),
        json<{data: SecurityIncident[]}>('/api/backoffice/governance/security'),
      ]);
      setPrivacyRequests(privacy.data || []);
      setSecurityIncidents(security.data || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal memuat governance queue.');
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
    void loadGovernance();
  }, [loadInvitations, loadGovernance]);

  const createIncident = async () => {
    if (incidentSummary.trim().length < 3 || governanceBusy) return;
    setGovernanceBusy(true);
    setMessage('');
    try {
      await json('/api/backoffice/governance/security', {
        method: 'POST',
        body: JSON.stringify({
          severity: incidentSeverity,
          summary: incidentSummary.trim(),
          affected_data_classes: [],
        }),
      });
      setIncidentSummary('');
      await loadGovernance();
      setMessage('Security incident dicatat.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal mencatat incident.');
    } finally {
      setGovernanceBusy(false);
    }
  };

  const transitionGovernance = async (kind: 'privacy' | 'security', id: string, status: string) => {
    setGovernanceBusy(true);
    setMessage('');
    try {
      const path = kind === 'privacy'
        ? `/api/backoffice/governance/privacy/${encodeURIComponent(id)}/transition`
        : `/api/backoffice/governance/security/${encodeURIComponent(id)}/transition`;
      await json(path, {
        method: 'POST',
        body: JSON.stringify({
          status,
          decision_note: kind === 'privacy' ? 'Diperbarui dari CRM Governance.' : undefined,
        }),
      });
      await loadGovernance();
      setMessage('Status governance diperbarui.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal memperbarui governance.');
    } finally {
      setGovernanceBusy(false);
    }
  };

  const search = async () => {
    const term = q.trim().replace(/^@/, '');
    if (term.length < 2) return;
    setBusy(true); setMessage('');
    try {
      const data = await json<{data: Candidate[]}>(`/api/backoffice/candidates?q=${encodeURIComponent(term)}`);
      setCandidates(data.data || []);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Pencarian gagal.';
      setMessage(error === 'backoffice owner access required'
        ? 'Akun kamu belum punya akses Admin untuk mengelola anggota backoffice.'
        : error);
    }
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
    setRoles(value === 'cms' ? ['content_admin'] : ['moderator']);
  };

  const toggleRole = (role: string) => setRoles(current =>
    current.includes(role) ? current.filter(x => x !== role) : [...current, role]
  );

  return <div className="space-y-5">
    <PageHeader label="Administrasi" title="Tim & akses" description="Cari akun Lajukan yang terdaftar di WWW → pilih CMS / Content Admin → kirim undangan." />
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search(); }}
          placeholder="Cari nama, @username, email, atau nomor HP…" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
        <button disabled={busy || q.trim().length < 2} onClick={() => void search()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-[color:var(--color-primary)] text-white disabled:opacity-50">{busy ? 'Mencari…' : 'Cari'}</button>
      </div>
      {message ? <p className="mt-3 rounded-xl border px-3 py-2 text-sm">{message}</p> : null}
      <div className="mt-4 space-y-2">
        {candidates.map(candidate => <button key={candidate.id} onClick={() => setSelected(candidate)}
          className={`w-full rounded-xl border p-3 text-left ${selected?.id === candidate.id ? 'border-[color:var(--color-primary)]' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="truncate font-semibold">{candidate.username ? '@' + candidate.username : candidate.full_name || candidate.email}</div>
              <div className="truncate text-xs opacity-70">{candidate.full_name || candidate.email}</div>
              <div className="truncate text-[11px] text-slate-400">{candidate.email}</div></div>
            <span className={candidate.eligible ? 'text-xs font-semibold text-emerald-700' : 'text-xs font-semibold text-amber-700'}>{candidate.eligible ? 'Bisa diundang' : candidate.eligibility_reason || 'Belum siap'}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] opacity-75">
            <span>Email {candidate.email_verified ? '✓ terverifikasi' : 'belum terverifikasi'}</span><span>HP {candidate.phone_verified ? '✓ terverifikasi' : 'belum terverifikasi'}</span>{candidate.identity_verified ? <span>Identitas ✓</span> : null}
          </div>
          {!candidate.eligible && candidate.eligibility_reason ? (
            <p className="mt-1 text-[11px] text-amber-700">{candidate.eligibility_reason}</p>
          ) : null}
        </button>)}
      {!candidates.length && q.trim().length >= 2 && !busy ? <div className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Akun Lajukan tidak ditemukan. Coba email lengkap, @username, nama, atau nomor HP.</div> : null}
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
      <button disabled={busy || !selected.eligible || !roles.length} onClick={() => void invite()} className="mt-4 rounded-xl bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Kirim undangan</button>
    </Card> : null}
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-900">Governance & keamanan</summary>
      <div className="border-t border-slate-100 p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Privacy requests</h2>
                <p className="text-xs opacity-70">Queue permintaan akses, koreksi, export, deletion, dan kontrol data.</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-bold">{privacyRequests.filter(x => ['open','in_review','waiting_user'].includes(x.status)).length} aktif</span>
            </div>
            <div className="mt-3 space-y-2">
              {privacyRequests.slice(0, 8).map(item => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.request_type}</div>
                      <div className="mt-0.5 text-[11px] opacity-65">#{item.id} · user {item.subject_user_id}</div>
                    </div>
                    <select
                      value={item.status}
                      disabled={governanceBusy}
                      onChange={event => void transitionGovernance('privacy', item.id, event.target.value)}
                      className="rounded-lg border bg-transparent px-2 py-1 text-xs"
                    >
                      <option value="open">open</option>
                      <option value="in_review">in_review</option>
                      <option value="waiting_user">waiting_user</option>
                      <option value="completed">completed</option>
                      <option value="rejected">rejected</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  {item.due_at ? <div className="mt-2 text-[11px] opacity-65">Target {new Date(item.due_at).toLocaleString('id-ID')}</div> : null}
                  {item.decision_note ? <div className="mt-2 rounded-lg bg-black/5 px-2.5 py-2 text-xs">{item.decision_note}</div> : null}
                </div>
              ))}
              {privacyRequests.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-xs opacity-65">Tidak ada privacy request.</div> : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Security incidents</h2>
                <p className="text-xs opacity-70">Severity, containment, remediation, dan status notifikasi.</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-bold">{securityIncidents.filter(x => x.status !== 'closed').length} terbuka</span>
            </div>
            <div className="mt-4 rounded-xl border p-3">
              <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                <select value={incidentSeverity} onChange={e => setIncidentSeverity(e.target.value)} className="rounded-lg border bg-transparent px-2 py-2 text-xs">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
                <input
                  value={incidentSummary}
                  onChange={e => setIncidentSummary(e.target.value.slice(0, 10000))}
                  placeholder="Ringkasan incident…"
                  className="rounded-lg border px-3 py-2 text-xs"
                />
                <button
                  disabled={governanceBusy || incidentSummary.trim().length < 3}
                  onClick={() => void createIncident()}
                  className="rounded-lg bg-[color:var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Catat
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {securityIncidents.slice(0, 8).map(item => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.severity.toUpperCase()}</span>
                        {item.legal_hold ? <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold">LEGAL HOLD</span> : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs opacity-80">{item.summary}</div>
                      <div className="mt-1 text-[11px] opacity-65">#{item.id}</div>
                    </div>
                    <select
                      value={item.status}
                      disabled={governanceBusy}
                      onChange={event => void transitionGovernance('security', item.id, event.target.value)}
                      className="rounded-lg border bg-transparent px-2 py-1 text-xs"
                    >
                      <option value="open">open</option>
                      <option value="contained">contained</option>
                      <option value="investigating">investigating</option>
                      <option value="remediated">remediated</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>
                  {item.notification_due_at ? <div className="mt-2 text-[11px] opacity-65">Target notifikasi {new Date(item.notification_due_at).toLocaleString('id-ID')}</div> : null}
                </div>
              ))}
              {securityIncidents.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-xs opacity-65">Tidak ada incident.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </details>
    <Card className="p-5">
      <h2 className="font-bold">Riwayat undangan</h2>
      <div className="mt-3 space-y-2">{invitations.map(inv => <div key={inv.id} className="rounded-xl border p-3 text-sm">
        <div className="flex justify-between gap-3"><span className="font-semibold">{inv.username ? '@'+inv.username : inv.email}</span><span>{inv.status}</span></div>
        <div className="mt-1 text-xs opacity-70">{inv.application.toUpperCase()} · {inv.role_names.join(', ')}</div>
      </div>)}</div>
    </Card>
  </div>;
}
