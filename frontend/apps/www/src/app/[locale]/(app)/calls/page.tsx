'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Phone,
  RefreshCw,
  Video,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';

type CallType = 'voice' | 'video';
type CallStatus =
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'missed'
  | 'failed';

type CallHistoryItem = {
  call_id: string;
  room_id: string;
  peer_user_id: string;
  caller_user_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  end_reason?: string | null;
};

type Filter = 'all' | 'voice' | 'video';

function localeFromPath(pathname: string) {
  return pathname.startsWith('/en') ? 'en' : 'id';
}

function formatTime(value: string | null, locale: 'id' | 'en') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const sameDay =
    new Date().toDateString() === date.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return minutes > 0
    ? minutes + ':' + String(remainder).padStart(2, '0')
    : '0:' + String(remainder).padStart(2, '0');
}

export default function CallsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const { rooms } = useChatInbox();
  const [items, setItems] = useState<CallHistoryItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = localeFromPath(pathname || '/id');
  const isId = locale === 'id';

  const roomMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        avatar?: string;
        avatarStyle?: unknown;
      }
    >();
    rooms.forEach(room => {
      const id = String(room.room_id ?? room.id ?? '').trim();
      if (!id) return;
      map.set(id, {
        name: String(room.room_name ?? room.name ?? '').trim() || id,
        avatar: String(room.room_avatar ?? room.avatar ?? '').trim() || undefined,
        avatarStyle: readProfileAvatarStyle(room),
      });
    });
    return map;
  }, [rooms]);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const response = await authFetch('/api/chat/calls?limit=200', {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: unknown;
      };
      if (!response.ok || !Array.isArray(payload.data)) {
        throw new Error(
          isId
            ? 'Riwayat panggilan tidak tersedia.'
            : 'Call history is unavailable.',
        );
      }
      setItems(payload.data as CallHistoryItem[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Call history unavailable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    void load();
  }, [authFetch, isId, user?.id]);

  const filtered = useMemo(
    () => items.filter(item => filter === 'all' || item.call_type === filter),
    [items, filter],
  );

  const labels = {
    title: isId ? 'Riwayat panggilan' : 'Call history',
    subtitle: isId
      ? 'Telepon dan video dipisahkan supaya cepat dicari.'
      : 'Voice and video calls are separated for faster scanning.',
    all: isId ? 'Semua' : 'All',
    voice: isId ? 'Telepon' : 'Voice',
    video: isId ? 'Video' : 'Video',
    empty: isId ? 'Belum ada riwayat panggilan.' : 'No calls yet.',
    retry: isId ? 'Coba lagi' : 'Retry',
    incoming: isId ? 'Masuk' : 'Incoming',
    outgoing: isId ? 'Keluar' : 'Outgoing',
    missed: isId ? 'Panggilan tidak terjawab' : 'Missed call',
    declined: isId ? 'Ditolak' : 'Declined',
    cancelled: isId ? 'Dibatalkan' : 'Cancelled',
    failed: isId ? 'Gagal' : 'Failed',
    completed: isId ? 'Selesai' : 'Completed',
    active: isId ? 'Sedang terhubung' : 'Connected',
  };

  const statusLabel = (item: CallHistoryItem, incoming: boolean) => {
    if (item.status === 'missed') return labels.missed;
    if (item.status === 'declined') return labels.declined;
    if (item.status === 'cancelled') return labels.cancelled;
    if (item.status === 'failed') return labels.failed;
    if (item.status === 'connecting' || item.status === 'connected') {
      return labels.active;
    }
    return labels.completed;
  };

  return (
    <main className="page-shell pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 lg:pb-10">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="ui-hero-panel p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
              aria-label={isId ? 'Kembali' : 'Back'}
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Chat & komunikasi' : 'Chat & communication'}
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
                    {labels.title}
                  </h1>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                    {labels.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void load(true)}
                  disabled={refreshing}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)] disabled:opacity-60"
                  aria-label={isId ? 'Refresh' : 'Refresh'}
                >
                  <RefreshCw className={refreshing ? 'h-4.5 w-4.5 animate-spin' : 'h-4.5 w-4.5'} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1 dark:border-[color:var(--app-border-strong)]">
          {([
            ['all', labels.all],
            ['voice', labels.voice],
            ['video', labels.video],
          ] as Array<[Filter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? 'min-h-10 rounded-[12px] bg-[color:var(--app-accent)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] shadow-sm'
                  : 'min-h-10 rounded-[12px] px-3 text-xs font-bold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-3 rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void load(true)}
                className="rounded-full border border-current px-3 py-1.5 text-xs font-black"
              >
                {labels.retry}
              </button>
            </div>
          </div>
        ) : null}

        <section className="mt-3 overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
          {loading ? (
            <div className="divide-y divide-[color:var(--app-border)] dark:divide-[color:var(--app-border-strong)]">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-3 px-3 py-3.5">
                  <div className="h-12 w-12 rounded-full bg-[color:var(--app-surface-muted)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-32 rounded-full bg-[color:var(--app-surface-muted)]" />
                    <div className="h-2.5 w-48 max-w-full rounded-full bg-[color:var(--app-surface-muted)]" />
                  </div>
                  <div className="h-3 w-12 rounded-full bg-[color:var(--app-surface-muted)]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid min-h-[260px] place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  {filter === 'video' ? (
                    <Video className="h-6 w-6" />
                  ) : (
                    <Phone className="h-6 w-6" />
                  )}
                </span>
                <p className="mt-3 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {labels.empty}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--app-border)] dark:divide-[color:var(--app-border-strong)]">
              {filtered.map(item => {
                const incoming = item.caller_user_id !== user?.id;
                const room = roomMap.get(item.room_id);
                const peerName =
                  room?.name ||
                  item.peer_user_id.slice(0, 8) ||
                  (isId ? 'Pengguna Lajukan' : 'Lajukan user');
                const missed = item.status === 'missed';
                const Icon = item.call_type === 'video' ? Video : Phone;

                return (
                  <button
                    key={item.call_id}
                    type="button"
                    onClick={() =>
                      router.push(
                        '/' + locale + '/chat/' + encodeURIComponent(item.room_id),
                      )
                    }
                    className="flex w-full items-center gap-3 px-3 py-3.5 text-left transition hover:bg-[color:var(--app-surface-muted)] sm:px-4"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                      <Image
                        src={profileAvatarSrc(
                          room?.avatar,
                          room?.avatarStyle,
                          peerName,
                        )}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={
                            'truncate text-sm font-black ' +
                            (missed
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]')
                          }
                        >
                          {peerName}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
                          <Icon className="h-3 w-3" />
                          {item.call_type === 'video' ? labels.video : labels.voice}
                        </span>
                      </span>

                      <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                        {incoming ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                        <span>{incoming ? labels.incoming : labels.outgoing}</span>
                        <span>•</span>
                        <span>{statusLabel(item, incoming)}</span>
                        {item.duration_seconds > 0 ? (
                          <>
                            <span>•</span>
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>{formatDuration(item.duration_seconds)}</span>
                          </>
                        ) : null}
                      </span>
                    </span>

                    <span className="shrink-0 text-[11px] font-bold text-[color:var(--app-text-soft)]">
                      {formatTime(item.started_at, locale)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
