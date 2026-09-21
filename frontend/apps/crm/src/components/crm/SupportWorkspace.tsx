'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import { useAuth } from '@/context/AuthContext';
import { supportApi, type SupportReply, type SupportTicket, type SupportTicketDetail } from '@/lib/api';
import { rankSupportTickets } from './queues';

const statuses = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];

export function SupportWorkspace({tickets,failed=false}:{tickets:SupportTicket[];failed?:boolean}) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState(tickets);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => setItems(tickets), [tickets]);

  const ranked = rankSupportTickets(items);

  async function openTicket(ticket: SupportTicket) {
    if (!accessToken) return;
    setSelectedId(ticket.id);
    setLoadingDetail(true);
    setNotice('');
    try {
      setDetail(await supportApi.get(accessToken, ticket.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Detail tiket gagal dimuat.');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function updateStatus(status: string) {
    if (!accessToken || !detail || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await supportApi.update(accessToken, detail.ticket.id, { status });
      const updated = ((response as { ticket?: SupportTicket }).ticket || { ...detail.ticket, status }) as SupportTicket;
      setDetail(current => current ? { ...current, ticket: updated } : current);
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
      setNotice('Status tiket diperbarui.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Status tiket gagal diperbarui.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!accessToken || !detail || reply.trim().length < 1 || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await supportApi.reply(accessToken, detail.ticket.id, { body: reply.trim(), is_internal: internal });
      const refreshed = await supportApi.get(accessToken, detail.ticket.id);
      setDetail(refreshed);
      setItems(current => current.map(item =>
        item.id === refreshed.ticket.id ? refreshed.ticket : item,
      ));
      setReply('');
      setNotice(internal ? 'Catatan internal tersimpan.' : 'Balasan dikirim.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Balasan gagal dikirim.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <PageHeader title="Tiket support" description="Urgent dan tiket terbuka muncul lebih dulu."/>
    {failed?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">Sumber support gagal dibaca. Data kosong tidak dianggap sukses.</div>:null}
    {notice ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">{notice}</div> : null}
    <div className="grid min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="p-3">
        <div className="space-y-2">
          {ranked.map(t=><button key={t.id} type="button" onClick={()=>void openTicket(t)} className={`w-full rounded-xl border p-2.5 text-left ${selectedId===t.id?'border-emerald-300 bg-emerald-50':'border-[color:var(--color-border)]'}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">{t.subject}</p>
              <StatusBadge tone={t.priority==='urgent'?'danger':t.priority==='high'?'warning':'neutral'}>{t.priority}</StatusBadge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-[color:var(--color-text-soft)]">{t.latest_message||t.requester_email}</p>
            <p className="mt-2 text-[11px] font-semibold text-[color:var(--color-text-soft)]">{t.status} · {t.requester_name || t.requester_email}</p>
          </button>)}
          {!failed&&!ranked.length?<EmptyState title="Support kosong" description="Belum ada tiket support real yang perlu ditangani."/>:null}
        </div>
      </Card>

      <Card className={`p-4 sm:p-5 ${selectedId ? "order-1 xl:order-2" : "order-2 xl:order-2"}`}>
        {!selectedId ? <EmptyState title="Pilih tiket" description="Pilih tiket di kiri untuk melihat detail, riwayat balasan, dan tindakan."/> :
        loadingDetail ? <div className="rounded-2xl bg-[color:var(--color-surface-muted)] p-6 text-sm font-semibold">Memuat detail tiket...</div> :
        detail ? <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold">{detail.ticket.subject}</p>
              <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">{detail.ticket.requester_name || detail.ticket.requester_email} · {detail.ticket.category}</p>
            </div>
            <select value={detail.ticket.status} disabled={busy} onChange={event=>void updateStatus(event.target.value)} className="min-h-10 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-xs font-bold">
              {Array.from(new Set([detail.ticket.status, ...statuses])).map(status=><option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto rounded-2xl bg-[color:var(--color-surface-muted)] p-3">
            {(detail.replies || []).map((item: SupportReply)=><div key={item.id} className={`rounded-2xl border p-3 ${item.is_internal?'border-amber-200 bg-amber-50':'border-[color:var(--color-border)] bg-white'}`}>
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span>{item.author_role}</span><span className="text-[color:var(--color-text-soft)]">{new Date(item.created_at).toLocaleString('id-ID')}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              {item.is_internal?<p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Internal</p>:null}
            </div>)}
            {!detail.replies?.length ? <p className="p-4 text-sm text-[color:var(--color-text-soft)]">Belum ada balasan.</p>:null}
          </div>

          <div className="mt-4">
            <textarea value={reply} onChange={event=>setReply(event.target.value)} rows={4} maxLength={4000} disabled={busy} placeholder="Tulis balasan atau catatan internal..." className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-emerald-100" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={internal} onChange={event=>setInternal(event.target.checked)} disabled={busy} />
                Catatan internal
              </label>
              <button type="button" onClick={()=>void sendReply()} disabled={busy || !reply.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy?'Menyimpan...':internal?'Simpan catatan':'Kirim balasan'}</button>
            </div>
          </div>
        </div> : <EmptyState title="Detail tidak tersedia" description="Ticket API tidak mengembalikan detail yang valid."/>}
      </Card>
    </div>
  </div>;
}
