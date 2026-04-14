'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Plus,
  X,
  Phone,
  Send,
  Loader2,
  Search,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

type DiscoverUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  username?: string | null;
};

type PublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
};

const SUPPORT_ROOMS = [
  { room_id: 'support:aida', room_name: 'Aida Support' },
  { room_id: 'support:agent', room_name: 'Human Support' },
] as const;

function parseDmPeerId(
  roomIdRaw: string,
  currentUserId?: string | null,
): string | null {
  const roomId = String(roomIdRaw || '').trim();
  if (!roomId.startsWith('dm:')) return null;
  const parts = roomId.split(':');
  if (parts.length < 3) return null;

  const first = parts[1] || '';
  const second = parts[2] || '';
  if (!first || !second) return null;

  const current = String(currentUserId || '').toLowerCase();
  if (current && first.toLowerCase() === current) return second;
  if (current && second.toLowerCase() === current) return first;
  return first;
}

function resolveRoomDisplayName({
  roomIdRaw,
  roomNameRaw,
  currentUserId,
  dmNamesByUserId,
}: {
  roomIdRaw: unknown;
  roomNameRaw: unknown;
  currentUserId?: string | null;
  dmNamesByUserId: Record<string, string>;
}): string {
  const roomId = String(roomIdRaw ?? '').trim();
  const roomName = String(roomNameRaw ?? '').trim();
  const peerId = parseDmPeerId(roomId, currentUserId);
  const resolvedDmName = peerId ? dmNamesByUserId[peerId] : '';

  if (resolvedDmName) return resolvedDmName;
  if (roomName && !roomName.startsWith('dm:')) return roomName;
  if (roomId.startsWith('dm:') || roomName.startsWith('dm:'))
    return 'Direct Message';
  if (roomName) return roomName;
  if (roomId) return roomId;
  return 'Conversation';
}

function formatRoomTime(isoOrNull: unknown): string {
  if (!isoOrNull || typeof isoOrNull !== 'string') return '';
  try {
    const d = new Date(isoOrNull);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function normalizeRoomId(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildDraftRoomId(contact: string): string {
  return `draft:${encodeURIComponent(contact)}`;
}

export default function ChatLayout({ children }: { children: ReactNode }) {
  const params = useParams() ?? {};
  const rawId = (params as { id?: unknown })?.id;
  const rawLocale = (params as { locale?: unknown })?.locale;
  const isId = rawLocale !== 'en';
  const activeRoomId = useMemo(() => normalizeRoomId(rawId), [rawId]);

  const { user, authFetch } = useAuth();
  const { rooms: inboxRooms, loading, refetch } = useChatInbox();
  const router = useRouter();

  const [showNewChat, setShowNewChat] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'unread' | 'direct' | 'group'
  >('all');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([]);
  const [dmNamesByUserId, setDmNamesByUserId] = useState<
    Record<string, string>
  >({});
  const [supportInitialized, setSupportInitialized] = useState(false);
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<DiscoverUser[]>([]);

  useEffect(() => {
    setSupportInitialized(false);
  }, [user?.id]);

  const allowedRoomIds = useMemo(() => {
    const set = new Set<string>();
    for (const room of inboxRooms) {
      const roomId = normalizeRoomId((room as any).room_id ?? (room as any).id);
      if (roomId) set.add(roomId);
    }
    return set;
  }, [inboxRooms]);

  useEffect(() => {
    if (!user?.id || inboxRooms.length === 0) return;

    const peerIds = Array.from(
      new Set(
        inboxRooms
          .map(room =>
            parseDmPeerId(
              String((room as any).room_id ?? (room as any).id ?? ''),
              user.id,
            ),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const missing = peerIds.filter(id => !dmNamesByUserId[id]);
    if (missing.length === 0) return;

    let cancelled = false;

    const run = async () => {
      const results = await Promise.all(
        missing.map(async id => {
          try {
            const res = await fetch(
              `/api/users/public/${encodeURIComponent(id)}`,
              { cache: 'no-store' },
            );
            if (!res.ok) return null;
            const payload = (await res
              .json()
              .catch(() => ({}))) as PublicProfile;
            const label =
              (typeof payload.username === 'string' && payload.username.trim()
                ? `@${payload.username.trim()}`
                : typeof payload.full_name === 'string' &&
                    payload.full_name.trim()
                  ? payload.full_name.trim()
                  : null) || null;
            return label ? { id, label } : null;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      setDmNamesByUserId(prev => {
        const next = { ...prev };
        for (const row of results) {
          if (row) next[row.id] = row.label;
        }
        return next;
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [dmNamesByUserId, inboxRooms, user?.id]);

  // Keep support rooms available for every user without showing extra control UI.
  useEffect(() => {
    if (!user?.id || supportInitialized) return;
    let cancelled = false;

    const run = async () => {
      try {
        await Promise.all(
          SUPPORT_ROOMS.map(room =>
            authFetch('/api/chat/support-room', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                room_id: room.room_id,
                room_name: room.room_name,
                member_ids: [user.id],
              }),
            }).catch(() => null),
          ),
        );
        if (!cancelled) {
          setSupportInitialized(true);
          await refetch();
        }
      } catch {
        if (!cancelled) setSupportInitialized(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authFetch, refetch, supportInitialized, user?.id]);

  const rooms = useMemo(() => {
    return inboxRooms.map((room: any) => {
      const roomId = String(room.room_id ?? room.id ?? '');
      const displayName = resolveRoomDisplayName({
        roomIdRaw: room.room_id ?? room.id,
        roomNameRaw: room.name ?? room.room_name,
        currentUserId: user?.id,
        dmNamesByUserId,
      });
      const normalizedName = displayName.toLowerCase();
      const kind =
        roomId.startsWith('support:') || normalizedName.includes('support')
          ? 'support'
          : roomId.startsWith('dm:') ||
              roomId.startsWith('draft:') ||
              normalizedName.includes('direct message')
            ? 'direct'
            : 'group';

      const lastMessage = String(
        (room.last_message ?? room.lastMsg ?? '') || '',
      );
      const lastSender = room.last_sender as string | undefined;
      const isOwnLast =
        lastSender &&
        user?.id &&
        String(lastSender).toLowerCase() === String(user.id).toLowerCase();
      const unreadCount = isOwnLast
        ? 0
        : Math.max(0, Number(room.unread_count ?? 0));

      return {
        ...room,
        id: roomId,
        unread_count: unreadCount,
        name: displayName,
        time: formatRoomTime(room.last_message_at),
        lastPreview:
          (isOwnLast
            ? isId
              ? `Kamu: ${lastMessage}`
              : `You: ${lastMessage}`
            : lastMessage) || (isId ? 'Belum ada chat' : 'No messages yet'),
        kind,
      };
    });
  }, [dmNamesByUserId, inboxRooms, isId, user?.id]);

  const unreadCount = useMemo(
    () => rooms.filter((room: any) => (room.unread_count ?? 0) > 0).length,
    [rooms],
  );
  const directCount = useMemo(
    () => rooms.filter((room: any) => room.kind === 'direct').length,
    [rooms],
  );
  const groupCount = useMemo(
    () => rooms.filter((room: any) => room.kind === 'group').length,
    [rooms],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRooms = useMemo(() => {
    return rooms.filter((room: any) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'unread' && (room.unread_count ?? 0) > 0) ||
        (activeFilter === 'direct' && room.kind === 'direct') ||
        (activeFilter === 'group' && room.kind === 'group');
      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;
      const haystack =
        `${room.name ?? ''} ${String(room.last_message ?? room.lastMsg ?? '')}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [activeFilter, normalizedSearch, rooms]);

  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a: any, b: any) => {
      const aTime = new Date(a.last_message_at ?? 0).getTime();
      const bTime = new Date(b.last_message_at ?? 0).getTime();
      return bTime - aTime;
    });
  }, [filteredRooms]);

  const filterOptions = useMemo(
    () => [
      {
        label: isId ? 'Semua' : 'All',
        value: 'all' as const,
        count: rooms.length,
      },
      {
        label: isId ? 'Belum dibaca' : 'Unread',
        value: 'unread' as const,
        count: unreadCount,
      },
      {
        label: isId ? 'DM' : 'Direct',
        value: 'direct' as const,
        count: directCount,
      },
      {
        label: isId ? 'Grup' : 'Group',
        value: 'group' as const,
        count: groupCount,
      },
    ],
    [directCount, groupCount, isId, rooms.length, unreadCount],
  );

  const selectedMemberIds = useMemo(
    () => new Set(selectedMembers.map(member => member.id)),
    [selectedMembers],
  );

  useEffect(() => {
    if (showNewChat) return;
    setContactInput('');
    setError('');
    setGroupName('');
    setSelectedMembers([]);
    setNewChatMode('direct');
  }, [showNewChat]);

  const safeGoToRoom = (raw: unknown) => {
    const roomId = normalizeRoomId(raw);
    if (!roomId) return;
    if (!allowedRoomIds.has(roomId)) {
      void refetch();
      return;
    }
    router.push(`/chat/${encodeURIComponent(roomId)}`);
  };

  const handleAddMember = (entry: DiscoverUser) => {
    if (selectedMemberIds.has(entry.id)) return;
    setSelectedMembers(prev => [...prev, entry]);
    setContactInput('');
    setDiscoverUsers([]);
  };

  const handleRemoveMember = (id: string) => {
    setSelectedMembers(prev => prev.filter(member => member.id !== id));
  };

  const handleCreateRoom = async () => {
    if (newChatMode === 'group') {
      if (!groupName.trim()) {
        setError(isId ? 'Masukkan nama grup' : 'Enter a group name');
        return;
      }
      if (selectedMembers.length < 1) {
        setError(isId ? 'Pilih minimal 1 anggota' : 'Select at least 1 member');
        return;
      }
      if (!user?.id) {
        setError(
          isId
            ? 'Login dulu untuk membuat grup'
            : 'Log in first to create a group',
        );
        return;
      }

      setCreating(true);
      setError('');
      try {
        const memberIds = Array.from(
          new Set([user.id, ...selectedMembers.map(member => member.id)]),
        ).filter(Boolean);
        const res = await authFetch('/api/chat/create-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_name: groupName.trim(),
            member_ids: memberIds,
            room_type: 'group',
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          room_id?: string;
          id?: string;
          error?: string;
        };
        const roomId = String(payload.room_id || payload.id || '').trim();
        if (!res.ok || !roomId) {
          throw new Error(
            payload.error ||
              (isId
                ? 'Grup belum bisa dibuat.'
                : 'Group chat is not available yet.'),
          );
        }
        setShowNewChat(false);
        setContactInput('');
        setGroupName('');
        setSelectedMembers([]);
        router.push(`/chat/${encodeURIComponent(roomId)}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal membuat grup'
              : 'Failed to create group',
        );
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!contactInput.trim()) {
      setError(
        isId
          ? 'Masukkan nomor HP atau email'
          : 'Please enter a phone number or email',
      );
      return;
    }

    const normalizedContact = contactInput.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact);
    const cleanPhone = normalizedContact.replace(/\D/g, '');

    if (!isEmail && cleanPhone.length < 10) {
      setError(
        isId
          ? 'Nomor HP atau email tidak valid'
          : 'Invalid phone number or email',
      );
      return;
    }

    setCreating(true);
    setError('');

    try {
      const contact = isEmail ? normalizedContact.toLowerCase() : cleanPhone;
      const draftRoomId = buildDraftRoomId(contact);
      setShowNewChat(false);
      setContactInput('');
      router.push(`/chat/${encodeURIComponent(draftRoomId)}`);
    } catch {
      setError(isId ? 'Terjadi kesalahan' : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const handleStartChatWithUser = async (entry: DiscoverUser) => {
    if (!entry?.id) return;
    setCreating(true);
    setError('');
    try {
      const res = await authFetch('/api/chat/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peer_user_id: entry.id, skip_lead: true }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        room_id?: string;
        id?: string;
        error?: string;
      };
      const roomId = String(payload.room_id || payload.id || '').trim();
      if (!res.ok || !roomId) {
        throw new Error(
          payload.error ||
            (isId ? 'Gagal membuat chat' : 'Failed to create chat'),
        );
      }
      setShowNewChat(false);
      setContactInput('');
      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isId
            ? 'Gagal membuat chat'
            : 'Failed to create chat',
      );
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!showNewChat) {
      setDiscoverUsers([]);
      return;
    }

    const keyword = contactInput.trim();
    if (keyword.length < 2) {
      setDiscoverUsers([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setDiscoverLoading(true);
      try {
        const res = await authFetch(
          `/api/users/discover?q=${encodeURIComponent(keyword)}&limit=6`,
        );
        const payload = (await res.json().catch(() => ({}))) as {
          data?: DiscoverUser[];
        };
        if (!cancelled && res.ok) {
          const list = Array.isArray(payload.data) ? payload.data : [];
          setDiscoverUsers(list.filter(entry => entry.id !== user?.id));
        }
      } catch {
        if (!cancelled) setDiscoverUsers([]);
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authFetch, contactInput, showNewChat, user?.id]);

  if (!user) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-[color:var(--app-accent-soft)] via-[color:var(--app-surface-strong)] to-[color:var(--app-info-soft)] dark:from-[color:var(--app-surface-strong)] dark:via-[color:var(--app-surface-strong)] dark:to-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)]">
        <div className="flex min-h-[100svh] items-center justify-center px-0 sm:px-4">
          <div className="w-full max-w-sm rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] p-6 text-center shadow-sm backdrop-blur dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] sm:rounded-3xl sm:border-x">
            <MessageCircle className="mx-auto mb-4 h-14 w-14 text-[color:var(--app-accent)]" />
            <p className="mb-4 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId
                ? 'Masuk dulu untuk buka chat.'
                : 'Please login to access chat'}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="rounded-xl bg-[color:var(--app-accent)] px-6 py-2 text-sm font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent)]"
            >
              {isId ? 'Masuk' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#d9dbd5] dark:bg-[#0b141a]">
      <div className="mx-auto flex h-[100dvh] w-full min-w-0 max-w-[1600px] overflow-hidden lg:px-4 lg:py-4">
        <div className="flex h-full w-full min-w-0 overflow-hidden bg-[#f7f5f3] shadow-none dark:bg-[#111b21] lg:rounded-[18px] lg:border lg:border-black/5 lg:shadow-[0_18px_46px_-30px_rgba(17,27,33,0.45)] dark:lg:border-white/10">
          <section
            className={`h-full min-h-0 w-full min-w-0 max-w-full flex-col border-r border-black/5 bg-white dark:border-white/6 dark:bg-[#111b21] lg:w-[390px] lg:shrink-0 ${
              activeRoomId ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="border-b border-black/5 bg-[#f0f2f5] px-3 py-3 dark:border-white/6 dark:bg-[#202c33] sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">
                    {isId ? 'Chat' : 'Chats'}
                  </h1>
                  <p className="mt-0.5 text-xs text-[#667781] dark:text-[#8696a0]">
                    {isId
                      ? `${rooms.length} percakapan, ${unreadCount} belum dibaca`
                      : `${rooms.length} conversations, ${unreadCount} unread`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => refetch()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5"
                    aria-label={isId ? 'Muat ulang daftar chat' : 'Refresh chats'}
                    title={isId ? 'Muat ulang' : 'Refresh'}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-[#25d366] px-3 text-xs font-semibold text-[#111b21] transition hover:bg-[#22c55e]"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {isId ? 'Chat baru' : 'New chat'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781] dark:text-[#8696a0]" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={
                      isId ? 'Cari nama atau isi chat' : 'Search chats'
                    }
                    className="w-full rounded-full border border-black/5 bg-white py-2 pl-9 pr-3 text-[13px] text-[#111b21] placeholder:text-[#667781] focus:border-[#25d366] focus:outline-none dark:border-white/8 dark:bg-[#111b21] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
                  />
                </div>

                <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
                  <div className="inline-flex min-w-full items-center gap-1.5">
                    {filterOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setActiveFilter(option.value)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                          activeFilter === option.value
                            ? 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#103529] dark:text-[#d1f4cc]'
                            : 'bg-white text-[#54656f] hover:bg-[#e9edef] dark:bg-[#111b21] dark:text-[#aebac1] dark:hover:bg-[#182229]'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            activeFilter === option.value
                              ? 'bg-black/5 text-[#111b21] dark:bg-white/10 dark:text-[#d1f4cc]'
                              : 'bg-[#f0f2f5] text-[#667781] dark:bg-[#202c33] dark:text-[#8696a0]'
                          }`}
                        >
                          {option.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-white dark:bg-[#111b21]">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#25d366]" />
                </div>
              ) : sortedRooms.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
                  <MessageCircle className="h-12 w-12 text-[#25d366]" />
                  <div>
                    <h3 className="text-base font-medium text-[#111b21] dark:text-[#e9edef]">
                      {rooms.length === 0
                        ? isId
                          ? 'Belum ada chat'
                          : 'No conversations yet'
                        : isId
                          ? 'Chat tidak ditemukan'
                          : 'No chats match your search'}
                    </h3>
                    <p className="mt-1 text-sm text-[#667781] dark:text-[#8696a0]">
                      {rooms.length === 0
                        ? isId
                          ? 'Mulai chat baru dari tombol di atas.'
                          : 'Start a new conversation from the button above.'
                        : isId
                          ? 'Coba kata lain atau reset filternya.'
                          : 'Try a different keyword or reset the filters.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setActiveFilter('all');
                      setShowNewChat(true);
                    }}
                    className="rounded-full bg-[#25d366] px-4 py-2 text-xs font-semibold text-[#111b21] shadow-sm transition hover:bg-[#22c55e]"
                  >
                    {isId ? 'Mulai chat' : 'Start a chat'}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/6">
                  {sortedRooms.map((room: any) => {
                    const roomId = normalizeRoomId(room.id || room.room_id);
                    const isActive =
                      roomId && activeRoomId && roomId === activeRoomId;
                    const roomKindLabel =
                      room.kind === 'group'
                        ? isId
                          ? 'Grup'
                          : 'Group'
                        : room.kind === 'support'
                          ? isId
                            ? 'Bantuan'
                            : 'Support'
                          : '';

                    return (
                      <motion.button
                        type="button"
                        key={room.id || room.room_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() =>
                          safeGoToRoom(room.id || room.room_id || '')
                        }
                        className={`group flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition sm:px-4 ${
                          isActive
                            ? 'bg-[#f0f2f5] dark:bg-[#202c33]'
                            : 'hover:bg-[#f5f6f6] dark:hover:bg-[#182229]'
                        }`}
                      >
                        <div className="relative h-11 w-11 shrink-0">
                          {room.avatar || room.room_avatar ? (
                            <img
                              src={(room.avatar || room.room_avatar) as string}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#dfe5e7] text-base font-semibold text-[#54656f] dark:bg-[#2a3942] dark:text-[#d1d7db]">
                              {(room.name || 'U')[0].toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <h3
                                className={`truncate text-[15px] ${
                                  (room.unread_count || 0) > 0
                                    ? 'font-semibold text-[#111b21] dark:text-[#e9edef]'
                                    : 'font-medium text-[#111b21] dark:text-[#e9edef]'
                                }`}
                              >
                                {room.name || 'Conversation'}
                              </h3>
                              {roomKindLabel ? (
                                <span className="shrink-0 rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[10px] font-medium text-[#667781] dark:bg-[#2a3942] dark:text-[#aebac1]">
                                  {roomKindLabel}
                                </span>
                              ) : null}
                            </div>

                            <span
                              className={`shrink-0 text-[11px] ${
                                (room.unread_count || 0) > 0
                                  ? 'font-medium text-[#25d366]'
                                  : 'text-[#667781] dark:text-[#8696a0]'
                              }`}
                            >
                              {room.time || ''}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <p
                              className={`min-w-0 flex-1 truncate text-[13px] ${
                                (room.unread_count || 0) > 0
                                  ? 'font-medium text-[#111b21] dark:text-[#dfe7ea]'
                                  : 'text-[#667781] dark:text-[#8696a0]'
                              }`}
                            >
                              {room.lastPreview}
                            </p>

                            {(room.unread_count || 0) > 0 ? (
                              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-[#111b21]">
                                {room.unread_count}
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[#c1c7cb] transition group-hover:text-[#8696a0] dark:text-[#667781] dark:group-hover:text-[#aebac1]" />
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <div
            className={`min-h-0 w-full min-w-0 flex-1 ${activeRoomId ? 'flex' : 'hidden lg:flex'}`}
          >
            <div className="h-full w-full min-w-0 overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
              {children}
            </div>
          </div>
        </div>
      </div>

      {!activeRoomId ? (
        <button
          onClick={() => setShowNewChat(true)}
          className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-[#111b21] shadow-xl shadow-[rgba(37,211,102,0.28)] transition hover:bg-[#22c55e] lg:hidden"
          aria-label={isId ? 'Chat baru' : 'New chat'}
        >
          <Plus className="h-5 w-5" />
        </button>
      ) : null}

      <AnimatePresence>
        {showNewChat ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] px-0 sm:items-center sm:px-4"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="max-h-[80svh] w-full overflow-y-auto rounded-t-3xl bg-[color:var(--app-surface-strong)] p-4 shadow-2xl dark:bg-[color:var(--app-surface-strong)] sm:max-w-md sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {isId ? 'Mulai chat baru' : 'Start a new chat'}
                </h2>
                <button
                  onClick={() => setShowNewChat(false)}
                  className="rounded-full p-2 hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)]"
                >
                  <X className="h-5 w-5 text-[color:var(--app-text)]" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="inline-flex w-full rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  <button
                    type="button"
                    onClick={() => setNewChatMode('direct')}
                    className={`flex-1 rounded-full px-3 py-1.5 transition ${
                      newChatMode === 'direct'
                        ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                        : 'text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    {isId ? 'Langsung' : 'Direct'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChatMode('group')}
                    className={`flex-1 rounded-full px-3 py-1.5 transition ${
                      newChatMode === 'group'
                        ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                        : 'text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    {isId ? 'Grup' : 'Group'}
                  </button>
                </div>

                {newChatMode === 'group' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        Nama grup
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="Contoh: Tim usaha Jakarta"
                        className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        Tambah anggota
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                        <input
                          type="text"
                          value={contactInput}
                          onChange={e => setContactInput(e.target.value)}
                          placeholder="Cari nama, email, atau telepon"
                          className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
                        />
                      </div>

                      {discoverLoading ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {isId ? 'Mencari pengguna...' : 'Searching users...'}
                        </div>
                      ) : null}

                      {!discoverLoading && discoverUsers.length > 0 ? (
                        <div className="mt-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                          {discoverUsers.map(entry => {
                            if (selectedMemberIds.has(entry.id)) return null;
                            const primary =
                              (entry.username && entry.username.trim()
                                ? `@${entry.username.trim()}`
                                : entry.full_name ||
                                  entry.email ||
                                  entry.phone ||
                                  'User') || 'User';
                            const secondary = entry.email || entry.phone || '';
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => handleAddMember(entry)}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-[color:var(--app-surface-strong)] dark:hover:bg-[color:var(--app-surface-strong)]"
                              >
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                    {primary}
                                  </span>
                                  {secondary ? (
                                    <span className="truncate text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                      {secondary}
                                    </span>
                                  ) : null}
                                </span>
                                <ChevronRight className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {selectedMembers.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedMembers.map(member => (
                            <span
                              key={member.id}
                              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-2 py-1 text-[11px] font-semibold text-[color:var(--app-text)]"
                            >
                              {(member.username && member.username.trim()
                                ? `@${member.username.trim()}`
                                : member.full_name ||
                                  member.email ||
                                  member.phone ||
                                  'User') || 'User'}
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                className="rounded-full p-0.5 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                                aria-label="Remove member"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {isId ? 'Nomor HP atau email' : 'Phone number or email'}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                      <input
                        type="text"
                        value={contactInput}
                        onChange={e => setContactInput(e.target.value)}
                        placeholder={
                          isId
                            ? '+62 812 3456 7890 atau user@email.com'
                            : '+62 812 3456 7890 or user@example.com'
                        }
                        className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
                      />
                    </div>

                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Masukkan kontak orang yang ingin kamu ajak chat.'
                        : 'Enter the phone number or email of the person you want to chat with.'}
                    </p>

                    {discoverLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {isId ? 'Mencari pengguna...' : 'Searching users...'}
                      </div>
                    ) : null}

                    {!discoverLoading && discoverUsers.length > 0 ? (
                      <div className="mt-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                        {discoverUsers.map(entry => {
                          const primary =
                            (entry.username && entry.username.trim()
                              ? `@${entry.username.trim()}`
                              : entry.full_name ||
                                entry.email ||
                                entry.phone ||
                                'User') || 'User';
                          const secondary = entry.email || entry.phone || '';
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => handleStartChatWithUser(entry)}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-[color:var(--app-surface-strong)] dark:hover:bg-[color:var(--app-surface-strong)]"
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {primary}
                                </span>
                                {secondary ? (
                                  <span className="truncate text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                    {secondary}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-[10px] font-semibold text-[color:var(--app-accent)]">
                                {isId ? 'Mulai' : 'Start'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}

                {error ? (
                  <p className="text-sm text-[color:var(--app-danger)]">
                    {error}
                  </p>
                ) : null}

                <button
                  onClick={handleCreateRoom}
                  disabled={
                    creating ||
                    (newChatMode === 'group'
                      ? !groupName.trim() || selectedMembers.length < 1
                      : !contactInput.trim())
                  }
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[color:var(--app-accent)] py-2.5 text-xs font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {newChatMode === 'group' ? 'Create Group' : 'Start Chat'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
