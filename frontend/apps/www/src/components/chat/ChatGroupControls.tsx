'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, UserPlus, UserRound, UsersRound, X } from 'lucide-react';

type DiscoverUser = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

type Props = {
  roomId: string;
  currentUserId: string;
  locale: 'id' | 'en';
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onRoomRenamed?: (name: string) => void;
  onLeft?: () => void;
};

function label(user: DiscoverUser): string {
  return user.full_name?.trim() || (user.username?.trim() ? `@${user.username.trim()}` : user.id);
}

export function ChatGroupControls({
  roomId,
  currentUserId,
  locale,
  authFetch,
  onRoomRenamed,
  onLeft,
}: Props) {
  const [members, setMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/members`, { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Gagal memuat anggota grup.');
      const ids = Array.isArray(payload?.data?.members) ? payload.data.members.map(String) : [];
      setMembers(ids);
      const unique = ids.filter(id => id && id !== currentUserId);
      const names = await Promise.all(unique.map(async id => {
        try {
          const profileRes = await fetch(`/api/users/public/${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (!profileRes.ok) return [id, id] as const;
          const profile = await profileRes.json().catch(() => ({}));
          return [id, profile?.full_name || (profile?.username ? `@${profile.username}` : id)] as const;
        } catch {
          return [id, id] as const;
        }
      }));
      setMemberNames(Object.fromEntries(names));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Gagal memuat anggota grup.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, currentUserId, roomId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/discover?q=${encodeURIComponent(q)}&limit=8`, { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setResults(rows.filter((row: DiscoverUser) => row.id && !members.includes(row.id)));
      } catch {
        setResults([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [members, query]);

  const rename = async () => {
    const next = roomName.trim();
    if (!next) return;
    setBusy('rename');
    setError('');
    try {
      const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Nama grup belum bisa diubah.');
      onRoomRenamed?.(next);
      setRoomName('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Nama grup belum bisa diubah.');
    } finally {
      setBusy('');
    }
  };

  const addMember = async (user: DiscoverUser) => {
    setBusy(`add:${user.id}`);
    setError('');
    try {
      const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [user.id] }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Anggota belum bisa ditambahkan.');
      setQuery('');
      setResults([]);
      await loadMembers();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Anggota belum bisa ditambahkan.');
    } finally {
      setBusy('');
    }
  };

  const removeMember = async (id: string) => {
    setBusy(`remove:${id}`);
    setError('');
    try {
      const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Anggota belum bisa dikeluarkan.');
      await loadMembers();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Anggota belum bisa dikeluarkan.');
    } finally {
      setBusy('');
    }
  };

  const leave = async () => {
    setBusy('leave');
    setError('');
    try {
      const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Belum bisa keluar dari grup.');
      onLeft?.();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Belum bisa keluar dari grup.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
        <div className="flex items-start gap-2">
          <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
          <div>
            <p className="text-xs font-bold text-[color:var(--app-text)]">{locale === 'id' ? 'Kelola grup' : 'Manage group'}</p>
            <p className="mt-1 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
              {locale === 'id' ? 'Tambah orang, ganti nama, atau keluar. Izin tetap diperiksa server.' : 'Add people, rename the group, or leave. Permissions are enforced server-side.'}
            </p>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}

      <div className="rounded-[20px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
        <p className="text-xs font-bold text-[color:var(--app-text)]">{locale === 'id' ? 'Ganti nama grup' : 'Rename group'}</p>
        <div className="mt-2 flex gap-2">
          <input value={roomName} onChange={e => setRoomName(e.target.value)} maxLength={120} placeholder={locale === 'id' ? 'Nama baru' : 'New group name'} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 text-xs font-semibold outline-none" />
          <button type="button" disabled={!roomName.trim() || !!busy} onClick={() => void rename()} className="rounded-xl bg-[color:var(--app-accent)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] disabled:opacity-50">
            {busy === 'rename' ? <Loader2 className="h-4 w-4 animate-spin" /> : locale === 'id' ? 'Simpan' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-[20px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
        <p className="text-xs font-bold text-[color:var(--app-text)]">{locale === 'id' ? 'Tambah anggota' : 'Add member'}</p>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={locale === 'id' ? 'Cari username atau nama' : 'Search username or name'} className="min-h-10 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] pl-9 pr-3 text-xs font-semibold outline-none" />
        </div>
        {results.length ? (
          <div className="mt-2 space-y-1">
            {results.map(user => (
              <button key={user.id} type="button" onClick={() => void addMember(user)} disabled={!!busy} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-[color:var(--app-surface-muted)] disabled:opacity-50">
                <UserRound className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[color:var(--app-text)]">{label(user)}</span>
                {busy === `add:${user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-[color:var(--app-accent)]" />}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[20px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
        <p className="text-xs font-bold text-[color:var(--app-text)]">{locale === 'id' ? 'Anggota' : 'Members'} · {members.length}</p>
        <div className="mt-2 space-y-1">
          {loading ? <div className="flex items-center gap-2 p-2 text-xs text-[color:var(--app-text-soft)]"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div> : null}
          {!loading && !members.length ? <p className="p-2 text-xs text-[color:var(--app-text-soft)]">-</p> : null}
          {members.map(id => (
            <div key={id} className="flex items-center gap-2 rounded-xl bg-[color:var(--app-surface-muted)] px-2 py-2">
              <UserRound className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[color:var(--app-text)]">{id === currentUserId ? (locale === 'id' ? 'Kamu' : 'You') : memberNames[id] || id}</span>
              {id !== currentUserId ? (
                <button type="button" onClick={() => void removeMember(id)} disabled={!!busy} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={locale === 'id' ? 'Keluarkan anggota' : 'Remove member'}>
                  {busy === `remove:${id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => void leave()} disabled={!!busy} className="min-h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50">
        {busy === 'leave' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : locale === 'id' ? 'Keluar dari grup' : 'Leave group'}
      </button>
    </div>
  );
}
