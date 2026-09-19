'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, UserRoundPlus } from 'lucide-react';
import { FeedbackNotice } from '@/components/interaction/FeedbackNotice';
import type { BusinessWorkItem } from '@/lib/business-work-server';
import { organizationRoleLabel } from '@/lib/business-collaboration';

type Member = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
};

type Props = {
  businessId: string;
  initialItems: BusinessWorkItem[];
  members: Member[];
  currentUserId: string;
  canManage: boolean;
};

const workTypeLabels: Record<string, string> = {
  restock: 'Isi stok',
  stock_check: 'Cek stok',
  receive: 'Terima barang',
  cash: 'Kas',
  order: 'Pesanan',
  finance: 'Keuangan',
  approval: 'Persetujuan',
  setup: 'Persiapan',
  follow_up: 'Tindak lanjut',
  custom: 'Lainnya',
};

const statusLabels: Record<string, string> = {
  todo: 'Belum',
  in_progress: 'Dikerjakan',
  done: 'Selesai',
  snoozed: 'Ditunda',
  cancelled: 'Dibatalkan',
};

function memberLabel(member: Member) {
  return member.fullName || (member.username ? '@' + member.username : '') || 'Anggota';
}

function formatDue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status: string) {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-700';
}

export function WorkQueue({
  businessId,
  initialItems,
  members,
  currentUserId,
  canManage,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<'all' | 'mine' | 'open' | 'done'>('open');
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState('custom');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('50');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => items.filter(item => {
    if (filter === 'mine') return item.assignee_user_id === currentUserId && !['done', 'cancelled'].includes(item.status);
    if (filter === 'open') return !['done', 'cancelled'].includes(item.status);
    if (filter === 'done') return item.status === 'done';
    return true;
  }), [currentUserId, filter, items]);

  const openCount = items.filter(item => !['done', 'cancelled'].includes(item.status)).length;
  const mineCount = items.filter(item => item.assignee_user_id === currentUserId && !['done', 'cancelled'].includes(item.status)).length;

  async function refreshSuggestions() {
    setSyncing(true);
    setMessage('');
    try {
      const response = await fetch('/api/businesses/' + encodeURIComponent(businessId) + '/work/sync', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal memperbarui pekerjaan.');
      const listResponse = await fetch('/api/businesses/' + encodeURIComponent(businessId) + '/work', { cache: 'no-store' });
      const listPayload = await listResponse.json().catch(() => ({}));
      if (!listResponse.ok) throw new Error(listPayload?.error || 'Gagal memuat pekerjaan.');
      setItems(Array.isArray(listPayload?.data?.items) ? listPayload.data.items : []);
      setMessage(Number(payload?.data?.created) > 0
        ? payload.data.created + ' pekerjaan baru ditemukan dari kondisi usaha.'
        : 'Pekerjaan sudah sesuai kondisi usaha.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memperbarui pekerjaan.');
    } finally {
      setSyncing(false);
    }
  }

  async function updateItem(id: string, input: Record<string, unknown>) {
    setSavingId(id);
    setMessage('');
    try {
      const response = await fetch(
        '/api/businesses/' + encodeURIComponent(businessId) + '/work/' + encodeURIComponent(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal memperbarui pekerjaan.');
      const next = payload?.data?.work as BusinessWorkItem;
      if (next?.id) setItems(current => current.map(item => item.id === next.id ? next : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memperbarui pekerjaan.');
    } finally {
      setSavingId(null);
    }
  }

  async function createItem() {
    if (!title.trim()) {
      setMessage('Isi nama pekerjaan dulu.');
      return;
    }
    setSyncing(true);
    setMessage('');
    try {
      const response = await fetch('/api/businesses/' + encodeURIComponent(businessId) + '/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_type: workType,
          title: title.trim(),
          description: description.trim(),
          priority: Math.max(0, Math.min(100, Number(priority) || 50)),
          assignee_user_id: assignee || null,
          metadata: {},
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Gagal membuat pekerjaan.');
      const next = payload?.data?.work as BusinessWorkItem;
      if (next?.id) setItems(current => [next, ...current]);
      setTitle('');
      setDescription('');
      setAssignee('');
      setWorkType('custom');
      setPriority('50');
      setShowCreate(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuat pekerjaan.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="merchant-surface-bordered overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-portal-soft">Kerja tim</p>
            <h2 className="mt-1 text-lg font-black text-portal-ink">Pekerjaan usaha</h2>
            <p className="mt-1 text-xs text-portal-soft">{openCount} pekerjaan terbuka · {mineCount} untukmu</p>
          </div>
          <div className="flex gap-2">
            {canManage ? (
              <button type="button" onClick={refreshSuggestions} disabled={syncing} className="portal-button-secondary">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Perbarui rekomendasi
              </button>
            ) : null}
            {canManage ? (
              <button type="button" onClick={() => setShowCreate(value => !value)} className="portal-button-primary">
                <UserRoundPlus className="h-4 w-4" /> Tambah
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-portal-line px-4 py-3 sm:px-5">
          {([
            ['open', 'Terbuka', openCount],
            ['mine', 'Punyaku', mineCount],
            ['all', 'Semua', items.length],
            ['done', 'Selesai', items.filter(item => item.status === 'done').length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={filter === key ? 'rounded-full bg-portal-ink px-3 py-2 text-xs font-bold text-white' : 'rounded-full bg-portal-mist px-3 py-2 text-xs font-bold text-portal-soft'}
            >
              {label} {count}
            </button>
          ))}
        </div>

        {showCreate ? (
          <div className="border-b border-portal-line bg-[#fafbf9] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-portal-soft sm:col-span-2">Nama pekerjaan
                <input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm text-portal-ink" placeholder="Contoh: Isi stok mangga" />
              </label>
              <label className="text-xs font-bold text-portal-soft sm:col-span-2">Catatan
                <textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-portal-line bg-white px-3 py-2 text-sm text-portal-ink" placeholder="Apa yang harus selesai?" />
              </label>
              <label className="text-xs font-bold text-portal-soft">Jenis
                <select value={workType} onChange={event => setWorkType(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm">
                  {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-portal-soft">Prioritas
                <select value={priority} onChange={event => setPriority(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm">
                  <option value="90">Penting</option><option value="70">Normal</option><option value="50">Biasa</option><option value="30">Rendah</option>
                </select>
              </label>
              <label className="text-xs font-bold text-portal-soft sm:col-span-2">Tugaskan ke
                <select value={assignee} onChange={event => setAssignee(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-portal-line bg-white px-3 text-sm">
                  <option value="">Belum ditugaskan</option>
                  {members.filter(member => member.status === 'active').map(member => (
                    <option key={member.userId} value={member.userId}>{memberLabel(member)} · {organizationRoleLabel(member.role)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="portal-button-secondary">Batal</button>
              <button type="button" onClick={createItem} disabled={syncing} className="portal-button-primary">Simpan pekerjaan</button>
            </div>
          </div>
        ) : null}

        {message ? <div className="border-b border-portal-line p-4"><FeedbackNotice message={message} tone="info" /></div> : null}

        <div className="divide-y divide-portal-line">
          {filtered.length ? filtered.map(item => {
            const assigneeMember = members.find(member => member.userId === item.assignee_user_id);
            const canFinish = item.assignee_user_id === currentUserId || canManage;
            const nextStatus = item.status === 'todo' ? 'in_progress' : item.status === 'in_progress' ? 'done' : null;
            return (
              <article key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-portal-mist px-2 py-1 text-[10px] font-bold text-portal-soft">{workTypeLabels[item.work_type] || 'Pekerjaan'}</span>
                      <span className={'rounded-full px-2 py-1 text-[10px] font-bold ' + statusTone(item.status)}>{statusLabels[item.status] || item.status}</span>
                      {item.priority >= 90 ? <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Penting</span> : null}
                    </div>
                    <h3 className="mt-2 text-sm font-black text-portal-ink">{item.title}</h3>
                    {item.description ? <p className="mt-1 text-sm leading-6 text-portal-soft">{item.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-portal-soft">
                      <span>{assigneeMember ? memberLabel(assigneeMember) : 'Belum ditugaskan'}</span>
                      {item.due_at ? <span>· {formatDue(item.due_at)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {canManage ? (
                      <select
                        value={item.assignee_user_id || ''}
                        onChange={event => void updateItem(item.id, { assignee_user_id: event.target.value || null })}
                        disabled={savingId === item.id}
                        className="min-h-10 rounded-xl border border-portal-line bg-white px-2.5 text-xs font-semibold text-portal-ink"
                        aria-label="Tugaskan pekerjaan"
                      >
                        <option value="">Belum ditugaskan</option>
                        {members.filter(member => member.status === 'active').map(member => (
                          <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>
                        ))}
                      </select>
                    ) : null}
                    {canFinish && nextStatus ? (
                      <button type="button" onClick={() => void updateItem(item.id, { status: nextStatus })} disabled={savingId === item.id} className="portal-button-primary">
                        {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {nextStatus === 'done' ? 'Selesai' : 'Mulai'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-portal-ink">Tidak ada pekerjaan di tampilan ini.</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Perbarui rekomendasi dari kondisi stok, atau tambahkan pekerjaan baru.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
