'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, UserRoundCheck } from 'lucide-react';
import type { PortalRole } from '@/lib/portal-types';

type InviteMemberQuickFormProps = {
  businessId: string;
};

type UserSuggestion = {
  id: string;
  username: string;
  fullName: string;
};

const roleOptions: Array<{ value: PortalRole; label: string; description: string }> = [
  { value: 'manager', label: 'Manager', description: 'Kelola operasional dan tim.' },
  { value: 'cashier', label: 'Kasir', description: 'Fokus transaksi dan pesanan.' },
  { value: 'viewer', label: 'Pantau saja', description: 'Akses baca tanpa perubahan.' },
];

function extractSuggestions(payload: unknown): UserSuggestion[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const candidates = [root.items, root.results, data.items, data.results, root.data].find(Array.isArray);
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const username = typeof row.username === 'string' ? row.username.trim() : '';
      const id = typeof row.id === 'string' ? row.id : '';
      if (!username || !id) return null;
      return {
        id,
        username,
        fullName:
          typeof row.full_name === 'string' && row.full_name.trim()
            ? row.full_name.trim()
            : username,
      };
    })
    .filter((item): item is UserSuggestion => Boolean(item));
}

export function shouldQueryUsernameSuggestions(
  normalizedUsername: string,
  selectedUser: UserSuggestion | null,
): boolean {
  if (normalizedUsername.length < 2) return false;
  return selectedUser?.username.toLowerCase() !== normalizedUsername;
}

export function InviteMemberQuickForm({ businessId }: InviteMemberQuickFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [role, setRole] = useState<PortalRole>('manager');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  const normalizedUsername = useMemo(
    () => username.trim().replace(/^@/, '').toLowerCase(),
    [username],
  );
  const shouldQuerySuggestions = shouldQueryUsernameSuggestions(normalizedUsername, selectedUser);
  const visibleSuggestions = shouldQuerySuggestions ? suggestions : [];

  useEffect(() => {
    if (!shouldQuerySuggestions) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(normalizedUsername)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        setSuggestions(extractSuggestions(await response.json()));
      } catch (searchError) {
        if (!(searchError instanceof DOMException && searchError.name === 'AbortError')) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedUsername, shouldQuerySuggestions]);

  function chooseUser(user: UserSuggestion) {
    setSelectedUser(user);
    setUsername(`@${user.username}`);
    setSuggestions([]);
    setError('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser || selectedUser.username.toLowerCase() !== normalizedUsername) {
      setError('Pilih akun Lajukan dari hasil pencarian username.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch(`/api/businesses/${businessId}/team/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUser.username,
          role,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Undangan belum berhasil dikirim.');
        return;
      }

      const invitedUsername = selectedUser.username;
      setUsername('');
      setSelectedUser(null);
      setSuggestions([]);
      setRole('manager');
      setSuccess(`Undangan untuk @${invitedUsername} terkirim dan menunggu persetujuan.`);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="team-username" className="text-sm font-semibold text-portal-ink">
          Username Lajukan
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-portal-soft" />
          <input
            id="team-username"
            value={username}
            onChange={event => {
              setUsername(event.target.value);
              setSelectedUser(null);
              setError('');
              if (event.target.value.trim().replace(/^@/, '').length < 2) {
                setSuggestions([]);
              }
            }}
            placeholder="Cari @username"
            autoComplete="off"
            className="portal-input pl-9"
          />
          {isSearching && shouldQuerySuggestions ? (
            <span className="absolute right-3 top-3 text-xs text-portal-soft">Mencari...</span>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-portal-soft">
          Anggota harus sudah punya akun Lajukan. Undangan baru aktif setelah mereka menerima.
        </p>

        {visibleSuggestions.length ? (
          <div className="overflow-hidden rounded-2xl border border-portal-line bg-white shadow-sm">
            {visibleSuggestions.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => chooseUser(user)}
                className="flex w-full items-center gap-3 border-b border-portal-line px-3 py-3 text-left last:border-b-0 hover:bg-portal-mist"
              >
                <UserRoundCheck className="h-4 w-4 shrink-0 text-portal-forest" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-portal-ink">@{user.username}</span>
                  <span className="block truncate text-xs text-portal-soft">{user.fullName}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedUser ? (
          <div className="rounded-2xl border border-portal-forest/20 bg-portal-forest/5 px-3 py-2 text-sm text-portal-ink">
            Dipilih: <strong>@{selectedUser.username}</strong> · {selectedUser.fullName}
          </div>
        ) : null}
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Peran
        <select
          value={role}
          onChange={event => setRole(event.target.value as PortalRole)}
          className="portal-input"
        >
          {roleOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending || !selectedUser} className="portal-button-primary">
        <Send className="h-4 w-4" />
        {isPending ? 'Mengirim...' : 'Kirim undangan'}
      </button>
    </form>
  );
}
