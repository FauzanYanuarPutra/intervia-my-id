'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';

type Lead = {
  id: string;
  name: string;
  sector: string;
  stage: string;
  source?: string;
  value_cents: number;
  currency?: string;
  created_at: string;
};

type Activity = {
  id: string;
  message: string;
  created_at: string;
};

type SupportTicket = {
  id: string;
  requester_email: string;
  requester_name?: string | null;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assigned_agent_id?: string | null;
  support_room_id?: string | null;
  updated_at: string;
  latest_message?: string | null;
  latest_message_at?: string | null;
};

type TicketFilter = 'unassigned' | 'me' | 'all';
type TicketUpdatePayload = {
  status?: string;
  priority?: string;
  assigned_agent_id?: string;
};

const STAGES = ['lead', 'qualified', 'negotiation', 'contract', 'won'] as const;
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  negotiation: 'Negotiation',
  contract: 'Contract',
  won: 'Closed Won',
};

const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_customer: 'Pending Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SUPPORT_STATUS_BADGE: Record<string, string> = {
  open: 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
  in_progress: 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]',
  pending_customer: 'border-[color:var(--app-group-talent-border)] bg-[color:var(--app-group-talent-soft)] text-[color:var(--app-group-talent)]',
  resolved: 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
  closed: 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]',
  high: 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
  normal: 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
  low: 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
};

function extractItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function mapStage(value: string | null | undefined): string {
  const normalized = (value || '').toLowerCase();
  if (STAGES.includes(normalized as (typeof STAGES)[number])) return normalized;
  if (normalized === 'active') return 'qualified';
  if (normalized === 'pending') return 'negotiation';
  if (normalized === 'completed' || normalized === 'sold') return 'won';
  return 'lead';
}

function toLead(raw: any): Lead {
  return {
    id: String(raw?.id || crypto.randomUUID()),
    name: String(raw?.name || raw?.title || 'Untitled'),
    sector: String(raw?.sector || raw?.category || 'General'),
    stage: mapStage(raw?.stage || raw?.content_status),
    source: raw?.source ? String(raw.source) : undefined,
    value_cents: Number(raw?.value_cents ?? raw?.price_cents ?? raw?.value ?? 0),
    currency: raw?.currency ? String(raw.currency) : undefined,
    created_at: String(raw?.created_at || new Date().toISOString()),
  };
}

function toActivity(raw: any): Activity {
  return {
    id: String(raw?.id || crypto.randomUUID()),
    message: String(raw?.message || raw?.action || 'Lead activity'),
    created_at: String(raw?.created_at || raw?.updated_at || new Date().toISOString()),
  };
}

function toSupportTicket(raw: any): SupportTicket {
  return {
    id: String(raw?.id || crypto.randomUUID()),
    requester_email: String(raw?.requester_email || '-'),
    requester_name: raw?.requester_name ? String(raw.requester_name) : null,
    category: String(raw?.category || 'general'),
    subject: String(raw?.subject || 'Untitled ticket'),
    status: String(raw?.status || 'open').toLowerCase(),
    priority: String(raw?.priority || 'normal').toLowerCase(),
    assigned_agent_id: raw?.assigned_agent_id ? String(raw.assigned_agent_id) : null,
    support_room_id: raw?.support_room_id ? String(raw.support_room_id) : null,
    updated_at: String(raw?.updated_at || raw?.created_at || new Date().toISOString()),
    latest_message: raw?.latest_message ? String(raw.latest_message) : null,
    latest_message_at: raw?.latest_message_at ? String(raw.latest_message_at) : null,
  };
}

function formatCurrency(valueCents: number, currency: string = 'IDR'): string {
  const value = Number.isFinite(valueCents) ? valueCents / 100 : 0;
  const prefix = currency.toUpperCase() === 'IDR' ? 'Rp' : currency.toUpperCase();
  if (value >= 1_000_000_000) return `${prefix} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${prefix} ${(value / 1_000_000).toFixed(0)}jt`;
  return `${prefix} ${value.toLocaleString()}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

export default function CrmDashboard() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const pathname = usePathname();
  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || '';

  const locale = useMemo(() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  }, [pathname]);

  const roles = useMemo(
    () => (user?.roles || []).map((role) => String(role).toLowerCase()),
    [user?.roles],
  );
  const canAccessCrm = Boolean(
    user &&
      (user.permissions?.includes('access_crm') ||
        hasPermission(roles as any, 'access_crm')),
  );

  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState('');

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [supportFilter, setSupportFilter] = useState<TicketFilter>('unassigned');
  const [ticketActionLoadingId, setTicketActionLoadingId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!canAccessCrm) return;
    setLoading(true);
    setError('');
    try {
      const [leadRes, activityRes] = await Promise.allSettled([
        authFetch('/api/crm/leads?limit=80', { cache: 'no-store' }),
        authFetch('/api/crm/activities?limit=12', { cache: 'no-store' }),
      ]);

      if (leadRes.status === 'fulfilled' && leadRes.value.ok) {
        const payload = await leadRes.value.json().catch(() => ({}));
        setLeads(extractItems(payload).map(toLead));
      } else {
        setLeads([]);
      }

      if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
        const payload = await activityRes.value.json().catch(() => ({}));
        setActivities(extractItems(payload).map(toActivity));
      } else {
        setActivities([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM data');
      setLeads([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, canAccessCrm]);

  const loadSupportTickets = useCallback(async () => {
    if (!canAccessCrm) return;
    setSupportLoading(true);
    setSupportError('');
    try {
      const query =
        supportFilter === 'all'
          ? '/api/support/tickets?limit=24'
          : `/api/support/tickets?limit=24&assigned=${supportFilter}`;
      const res = await authFetch(query, { cache: 'no-store' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setSupportError(payload?.error || 'Failed to load support queue.');
        setSupportTickets([]);
        return;
      }
      const payload = await res.json().catch(() => ({}));
      setSupportTickets(extractItems(payload).map(toSupportTicket));
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : 'Failed to load support queue.');
      setSupportTickets([]);
    } finally {
      setSupportLoading(false);
    }
  }, [authFetch, canAccessCrm, supportFilter]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadSupportTickets();
  }, [loadSupportTickets]);

  const updateSupportTicket = useCallback(
    async (ticketId: string, payload: TicketUpdatePayload) => {
      setTicketActionLoadingId(ticketId);
      setSupportError('');
      try {
        const res = await authFetch(`/api/support/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSupportError(data?.error || 'Failed to update ticket.');
          return;
        }
        await Promise.all([loadSupportTickets(), loadOverview()]);
      } catch (err) {
        setSupportError(err instanceof Error ? err.message : 'Failed to update ticket.');
      } finally {
        setTicketActionLoadingId(null);
      }
    },
    [authFetch, loadOverview, loadSupportTickets],
  );

  const takeTicket = useCallback(
    async (ticketId: string) => {
      if (!user?.id) return;
      await updateSupportTicket(ticketId, {
        assigned_agent_id: user.id,
        status: 'in_progress',
      });
    },
    [updateSupportTicket, user?.id],
  );

  const markResolved = useCallback(
    async (ticketId: string) => {
      await updateSupportTicket(ticketId, { status: 'resolved' });
    },
    [updateSupportTicket],
  );

  const reopenTicket = useCallback(
    async (ticketId: string) => {
      await updateSupportTicket(ticketId, { status: 'open' });
    },
    [updateSupportTicket],
  );

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const stage of STAGES) grouped[stage] = [];
    for (const lead of leads) {
      const stage = STAGES.includes(lead.stage as any) ? lead.stage : 'lead';
      grouped[stage] = grouped[stage] || [];
      grouped[stage].push(lead);
    }
    return grouped;
  }, [leads]);

  const activeLeads = leads.filter((lead) => !['won', 'lost'].includes(lead.stage)).length;
  const pipelineValue = leads.reduce((sum, lead) => sum + (lead.value_cents || 0), 0);
  const followupsDue = leads.filter((lead) => ['lead', 'qualified'].includes(lead.stage)).length;
  const winRate = leads.length
    ? Math.round((leads.filter((lead) => lead.stage === 'won').length / leads.length) * 100)
    : 0;

  const supportStats = useMemo(() => {
    const mineCount = supportTickets.filter(
      (ticket) => ticket.assigned_agent_id && ticket.assigned_agent_id === user?.id,
    ).length;
    const unassignedCount = supportTickets.filter((ticket) => !ticket.assigned_agent_id).length;
    const openCount = supportTickets.filter((ticket) =>
      ['open', 'in_progress', 'pending_customer'].includes(ticket.status),
    ).length;
    return {
      mineCount,
      unassignedCount,
      openCount,
      total: supportTickets.length,
    };
  }, [supportTickets, user?.id]);

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-sm text-[color:var(--app-text)]">
          Loading CRM...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-sm text-[color:var(--app-text)]">
          Please log in to access CRM.
          <div className="mt-4">
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)]"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessCrm) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-sm text-[color:var(--app-text)]">
          CRM access is limited to sales/support roles.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--app-accent)]">
            CRM Command Center
          </p>
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--app-text)]">
            Leads, support, assignment.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-text)]">
            Ticket chat masuk CRM dan bisa langsung di-assign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/support"
            className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text)]"
          >
            Open Support Hub
          </Link>
          {crmUrl ? (
            <a
              href={crmUrl}
              className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-inverse)]"
            >
              Open CRM App
            </a>
          ) : (
            <button
              type="button"
              className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-inverse)]"
            >
              Create Lead
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] p-4 text-xs text-[color:var(--app-danger)]">
          {error}
        </div>
      )}
      {supportError && (
        <div className="mt-3 rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] p-4 text-xs text-[color:var(--app-danger)]">
          {supportError}
        </div>
      )}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Active Leads', value: activeLeads, desc: 'From search + chat' },
          { label: 'Pipeline Value', value: formatCurrency(pipelineValue), desc: 'Weighted forecast' },
          { label: 'Follow-ups Due', value: followupsDue, desc: 'Next 48 hours' },
          { label: 'Win Rate', value: `${winRate}%`, desc: 'Last 30 days' },
          { label: 'Support Open', value: supportStats.openCount, desc: 'Queue in CRM' },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-black text-[color:var(--app-text)]">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text)]">
              {metric.desc}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              Support Queue
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text)]">
              Assign ticket ke agent, update status, dan lanjutkan chat dari satu panel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'unassigned', label: `Unassigned (${supportStats.unassignedCount})` },
              { key: 'me', label: `My Queue (${supportStats.mineCount})` },
              { key: 'all', label: `All (${supportStats.total})` },
            ] as Array<{ key: TicketFilter; label: string }>).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSupportFilter(item.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  supportFilter === item.key
                    ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                    : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadSupportTickets()}
              className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text)]"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {supportLoading ? (
            <p className="text-xs text-[color:var(--app-text)]">Loading support queue...</p>
          ) : supportTickets.length === 0 ? (
            <p className="text-xs text-[color:var(--app-text)]">No support tickets for this filter.</p>
          ) : (
            supportTickets.map((ticket) => {
              const assignedToMe = ticket.assigned_agent_id === user.id;
              const loadingAction = ticketActionLoadingId === ticket.id;
              return (
                <div key={ticket.id} className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">{ticket.subject}</p>
                    <span className={`${BADGE_BASE} ${SUPPORT_STATUS_BADGE[ticket.status] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {SUPPORT_STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                    <span className={`${BADGE_BASE} ${PRIORITY_BADGE[ticket.priority] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[color:var(--app-text)]">
                    {ticket.category} • {ticket.requester_name || ticket.requester_email} • Update {formatDate(ticket.updated_at)}
                  </div>
                  {ticket.latest_message ? (
                    <p className="mt-2 line-clamp-2 text-xs text-[color:var(--app-text)]">{ticket.latest_message}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!ticket.assigned_agent_id ? (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => void takeTicket(ticket.id)}
                        className="rounded-lg bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60"
                      >
                        {loadingAction ? 'Assigning...' : 'Take Ticket'}
                      </button>
                    ) : assignedToMe ? (
                      <>
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => void markResolved(ticket.id)}
                            className="rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] disabled:opacity-60"
                          >
                            {loadingAction ? 'Saving...' : 'Mark Resolved'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => void reopenTicket(ticket.id)}
                            className="rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-warning)] disabled:opacity-60"
                          >
                            {loadingAction ? 'Saving...' : 'Reopen'}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)]">
                        Assigned to other agent
                      </span>
                    )}

                    <Link
                      href={`/support?ticket=${encodeURIComponent(ticket.id)}&openLive=1`}
                      className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)]"
                    >
                      Open Chat
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {STAGES.map((stage) => {
            const items = leadsByStage[stage] || [];
            return (
              <div
                key={stage}
                className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
                  {STAGE_LABELS[stage]} ({items.length})
                </p>
                <div className="mt-4 space-y-3">
                  {items.length === 0 ? (
                    <div className="text-xs text-[color:var(--app-text-soft)]">No leads yet</div>
                  ) : (
                    items.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
                      >
                        <p className="text-xs font-bold text-[color:var(--app-text)]">
                          {item.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-[color:var(--app-text-soft)]">
                          {item.sector}
                        </p>
                        <p className="mt-2 text-[10px] font-black text-[color:var(--app-accent)]">
                          {formatCurrency(item.value_cents, item.currency || 'IDR')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              Activity Feed
            </p>
            {loading ? (
              <p className="mt-3 text-xs text-[color:var(--app-text-soft)]">Loading activity...</p>
            ) : activities.length === 0 ? (
              <p className="mt-3 text-xs text-[color:var(--app-text-soft)]">No activity yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs text-[color:var(--app-text)]">
                {activities.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent)]" />
                    <span>
                      {item.message}
                      <span className="ml-2 text-[10px] text-[color:var(--app-text-soft)]">
                        {formatDate(item.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              SLA Hint
            </p>
            <p className="mt-2 text-sm font-bold text-[color:var(--app-text)]">
              Prioritaskan urgent + unassigned
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text)]">
              Pakai filter queue. Ambil ticket sebelum SLA lewat.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
