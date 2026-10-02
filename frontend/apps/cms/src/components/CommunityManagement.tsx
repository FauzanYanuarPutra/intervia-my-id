'use client';

import { useEffect, useState } from 'react';
import { communityApi } from '@/lib/api';

type Group = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  privacy?: string;
  membershipPermission?: string;
  whatsappJoinUrl?: string | null;
  memberCount?: number;
  postCount?: number;
};

type Props = { token: string; isSuperAdmin: boolean };

export default function CommunityManagement({ token, isSuperAdmin }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const payload = await communityApi.groups(token, { limit: '60' }) as { data?: Group[] };
      const next = Array.isArray(payload.data) ? payload.data : [];
      setGroups(next);
      if (!selected && next[0]) select(next[0]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat grup komunitas');
    } finally {
      setLoading(false);
    }
  }

  function select(group: Group) {
    setSelected(group);
    setName(group.name || '');
    setDescription(group.description || '');
    setWhatsapp(group.whatsappJoinUrl || '');
  }

  useEffect(() => { void load(); }, [token]);

  async function save() {
    if (!selected || !isSuperAdmin) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = await communityApi.updateGroup(token, selected.id, {
        name: name.trim(),
        description: description.trim(),
        whatsappJoinUrl: whatsapp.trim() || null,
      }) as { data?: Group };
      const updated = payload.data || { ...selected, name, description, whatsappJoinUrl: whatsapp || null };
      setGroups(items => items.map(item => item.id === selected.id ? updated : item));
      select(updated);
      setMessage('Perubahan grup tersimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan grup');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">Community Operations</h2>
            <p className="mt-1 text-sm text-slate-500">Kelola grup komunitas, identitas, dan CTA WhatsApp dari satu tempat.</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-bold">
            Refresh
          </button>
        </div>
        {!isSuperAdmin ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Community Operations membutuhkan akses super admin agar tautan eksternal tidak dapat diubah sembarang.
          </div>
        ) : null}
        {message ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {loading ? <div className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-500">Memuat grup...</div> : null}
          {!loading && !groups.length ? <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-6 text-sm text-slate-500">Belum ada grup aktif.</div> : null}
          {groups.map(group => (
            <button
              key={group.id}
              type="button"
              onClick={() => select(group)}
              className={selected?.id === group.id
                ? 'w-full rounded-2xl border border-[color:var(--color-primary)] bg-[color:var(--color-primary-soft)] p-4 text-left'
                : 'w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left hover:bg-slate-50'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{group.name}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">/{group.slug}</div>
                </div>
                <span className={group.whatsappJoinUrl ? 'rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500'}>
                  {group.whatsappJoinUrl ? 'WhatsApp aktif' : 'Belum ada CTA'}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">{group.memberCount || 0} anggota · {group.postCount || 0} post</div>
            </button>
          ))}
        </aside>

        <div className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Group settings</p>
                  <h3 className="mt-1 text-2xl font-black">{selected.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">ID: {selected.id}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{selected.privacy || 'public'}</span>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">Nama grup</span>
                  <input value={name} onChange={e => setName(e.target.value)} disabled={!isSuperAdmin} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">Deskripsi</span>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={!isSuperAdmin} rows={4} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm leading-6" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">WhatsApp group / community invite URL</span>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} disabled={!isSuperAdmin} placeholder="https://chat.whatsapp.com/..." className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm" />
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">Hanya HTTPS WhatsApp (chat.whatsapp.com atau wa.me). Kosongkan untuk menyembunyikan CTA.</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void save()} disabled={saving || !isSuperAdmin} className="rounded-xl bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                    {saving ? 'Menyimpan...' : 'Simpan perubahan'}
                  </button>
                  {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">Tes CTA WhatsApp</a> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">Pilih grup komunitas.</div>
          )}
        </div>
      </div>
    </section>
  );
}
