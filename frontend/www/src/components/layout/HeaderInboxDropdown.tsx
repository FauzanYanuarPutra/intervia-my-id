'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Loader2,
  MessageCircle,
  RefreshCcw,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useChatInbox, type InboxRoom } from '@/context/ChatInboxContext';
import {
  useNotificationInbox,
  type InboxNotification,
} from '@/context/NotificationInboxContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { resolveLocaleFromPathname } from '@/lib/locale';
import {
  isMoneyRelatedNotification,
  notificationPresentation,
} from '@/lib/notifications/presentation';
import {
  notificationSocialContext,
  notificationSocialSummary,
  notificationTargetHref,
} from '@/lib/notifications/social';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { cn } from '@/lib/utils';

type HeaderInboxDropdownKind = 'chat' | 'notifications';

type HeaderInboxDropdownProps = {
  kind: HeaderInboxDropdownKind;
  isId?: boolean;
  className?: string;
  iconClassName?: string;
  menuClassName?: string;
  active?: boolean;
};

function compactCount(value: number): string {
  if (value <= 0) return '';
  return value > 99 ? '99+' : String(value);
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function cleanNotificationText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function notificationEmoji(item: InboxNotification, label: string): string {
  const text = [item.category, item.event_type, item.title, item.message, label]
    .map(cleanNotificationText)
    .join(' ');

  if (text.includes('topup') || text.includes('top-up')) return '💚';
  if (text.includes('refund') || text.includes('dikembalikan')) return '↩️';
  if (
    text.includes('payment') ||
    text.includes('pembayaran') ||
    text.includes('paid')
  ) {
    return '💳';
  }
  if (text.includes('wallet') || text.includes('saldo')) return '💰';
  if (
    text.includes('security') ||
    text.includes('keamanan') ||
    text.includes('login') ||
    text.includes('otp')
  ) {
    return '🛡️';
  }
  if (text.includes('chat') || text.includes('message')) return '💬';
  if (
    text.includes('social') ||
    text.includes('profile.viewed') ||
    text.includes('reels.viewed') ||
    text.includes('reels.liked') ||
    text.includes('reels.commented') ||
    text.includes('reels.replied') ||
    text.includes('content.viewed') ||
    text.includes('content.liked') ||
    text.includes('content.commented') ||
    text.includes('content.replied') ||
    text.includes('maps.profile_opened') ||
    text.includes('maps.route_clicked') ||
    text.includes('viewed') ||
    text.includes('liked') ||
    text.includes('comment') ||
    text.includes('reply')
  ) {
    return '💗';
  }
  if (text.includes('offer') || text.includes('tawaran')) return '🤝';
  if (
    text.includes('failed') ||
    text.includes('gagal') ||
    text.includes('cancel') ||
    text.includes('dibatalkan')
  ) {
    return '⚠️';
  }
  if (text.includes('pending') || text.includes('menunggu')) return '⏳';
  if (text.includes('support') || text.includes('bantuan')) return '🛟';
  if (
    text.includes('business') ||
    text.includes('usaha') ||
    text.includes('profile')
  ) {
    return '🏪';
  }
  if (
    text.includes('success') ||
    text.includes('berhasil') ||
    text.includes('confirmed') ||
    text.includes('terkonfirmasi')
  ) {
    return '✅';
  }

  return '🔔';
}

function formatRelativeTime(value: string | undefined, isId: boolean): string {
  if (!value) return isId ? 'Baru saja' : 'Just now';
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return isId ? 'Baru saja' : 'Just now';

  const diffSeconds = Math.round((parsed - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const locale = isId ? 'id-ID' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffSeconds, 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function roomId(room: InboxRoom): string {
  return toText(room.room_id ?? room.id);
}

function roomName(room: InboxRoom, isId: boolean): string {
  return toText(
    room.room_name ?? room.name,
    isId ? 'Percakapan' : 'Conversation',
  );
}

function roomMessage(room: InboxRoom, isId: boolean): string {
  return toText(
    room.last_message ?? room.lastMsg,
    isId ? 'Belum ada pesan terbaru.' : 'No recent message yet.',
  );
}

function roomAvatar(room: InboxRoom): string {
  return profileAvatarSrc(
    toText(room.room_avatar ?? room.avatar),
    readProfileAvatarStyle(room),
    roomName(room, true),
  );
}

function roomUnread(room: InboxRoom): number {
  const value = Number(room.unread_count ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function notificationHref(item: InboxNotification): string {
  const data = item.data || {};
  const transactionId =
    toText(data.transaction_id) || toText(data.order_id) || toText(data.txn_id);
  if (
    PROMO_ONLY_MODE &&
    (transactionId ||
      item.category === 'wallet' ||
      item.category === 'transaction')
  ) {
    return '/notifications';
  }
  if (transactionId)
    return `/transactions/${encodeURIComponent(transactionId)}`;

  const topupId = toText(data.topup_id);
  if (topupId || item.category === 'wallet') return '/payments';
  if (item.category === 'transaction') return '/transactions';
  if (item.category === 'security') return '/settings';
  return notificationTargetHref(item);
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-5 text-center">
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]">
        {icon}
      </div>
      <p className="mt-3 text-sm font-bold text-[color:var(--app-text)]">
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
        {body}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3"
        >
          <div className="ui-skeleton ui-skeleton-pulse h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="ui-skeleton ui-skeleton-pulse h-3 w-28 rounded-full" />
            <div className="ui-skeleton ui-skeleton-pulse h-2.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeaderInboxDropdown({
  kind,
  isId,
  className,
  iconClassName,
  menuClassName,
  active,
}: HeaderInboxDropdownProps) {
  const pathname = usePathname();
  const locale = resolveLocaleFromPathname(pathname);
  const idLocale = isId ?? locale === 'id';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const chatInbox = useChatInbox();
  const notificationInbox = useNotificationInbox();

  const isChat = kind === 'chat';
  const visibleNotificationItems = useMemo(
    () =>
      notificationInbox.items.filter(
        item =>
          !(
            PROMO_ONLY_MODE &&
            isMoneyRelatedNotification({
              category: item.category,
              eventType: item.event_type,
              title: item.title,
              message: item.message,
            })
          ),
      ),
    [notificationInbox.items],
  );
  const visibleNotificationUnreadCount = useMemo(
    () => visibleNotificationItems.filter(item => !item.is_read).length,
    [visibleNotificationItems],
  );
  const count = isChat
    ? chatInbox.totalUnread
    : PROMO_ONLY_MODE
      ? visibleNotificationUnreadCount
      : notificationInbox.unreadCount;
  const badge = compactCount(count);
  const title = isChat
    ? idLocale
      ? 'Chat terbaru'
      : 'Recent chats'
    : idLocale
      ? 'Notifikasi'
      : 'Notifications';
  const label = isChat ? 'Chat' : idLocale ? 'Notifikasi' : 'Notifications';
  const fullHref = isChat ? '/chat' : '/notifications';

  const sortedRooms = useMemo(
    () =>
      [...chatInbox.rooms]
        .sort(
          (a, b) =>
            new Date(toText(b.last_message_at)).getTime() -
            new Date(toText(a.last_message_at)).getTime(),
        )
        .slice(0, 5),
    [chatInbox.rooms],
  );
  const sortedNotifications = useMemo(
    () =>
      [...visibleNotificationItems]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 6),
    [visibleNotificationItems],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const refresh = () => {
    if (isChat) {
      void chatInbox.refetch();
      return;
    }
    void notificationInbox.refetch();
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setOpen(prev => !prev);
          if (!open) refresh();
        }}
        className={cn(
          'ui-pressable relative inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border shadow-[0_12px_24px_-22px_rgba(15,23,42,0.42)] transition',
          active || open
            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
          className,
        )}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isChat ? (
          <MessageCircle className={cn('h-4 w-4', iconClassName)} />
        ) : (
          <Bell className={cn('h-4 w-4', iconClassName)} />
        )}
        {badge ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            'ui-layer-drawer absolute right-0 top-[calc(100%+12px)] z-[90] w-[min(360px,calc(100vw-2rem))] overflow-visible rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,var(--app-text-soft)_18%)] bg-white p-2 text-[color:var(--app-text)] shadow-[0_28px_76px_-34px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.04] dark:border-slate-700/80 dark:bg-slate-950 dark:ring-white/10',
            menuClassName,
          )}
        >
          <span className="pointer-events-none absolute right-4 top-[-7px] h-3.5 w-3.5 rotate-45 border-l border-t border-[color:color-mix(in_srgb,var(--app-border)_82%,var(--app-text-soft)_18%)] bg-white shadow-[-4px_-4px_10px_-8px_rgba(15,23,42,0.45)] dark:border-slate-700/80 dark:bg-slate-950" />
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
                {title}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[color:var(--app-text-soft)]">
                {isChat
                  ? idLocale
                    ? `${count} pesan belum dibaca`
                    : `${count} unread messages`
                  : idLocale
                    ? `${count} belum dibaca`
                    : `${count} unread`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {!isChat && count > 0 ? (
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={async () => {
                    setMarkingAll(true);
                    try {
                      await notificationInbox.markAllRead();
                    } finally {
                      setMarkingAll(false);
                    }
                  }}
                  className="ui-pressable inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60"
                  aria-label={
                    idLocale ? 'Tandai semua dibaca' : 'Mark all read'
                  }
                >
                  {markingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={refresh}
                className="ui-pressable inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]"
                aria-label={idLocale ? 'Muat ulang' : 'Refresh'}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(440px,calc(var(--app-viewport-height)-150px))] space-y-1 overflow-y-auto px-1 pb-1">
            {isChat ? (
              chatInbox.loading ? (
                <LoadingRows />
              ) : sortedRooms.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle className="h-4 w-4" />}
                  title={idLocale ? 'Belum ada chat' : 'No chats yet'}
                  body={
                    idLocale
                      ? PROMO_ONLY_MODE
                        ? 'Percakapan dari listing, reels, dan profil usaha akan muncul di sini.'
                        : 'Percakapan dari transaksi, reels, dan profil usaha akan muncul di sini.'
                      : PROMO_ONLY_MODE
                        ? 'Conversations from listings, reels, and business profiles will appear here.'
                        : 'Conversations from transactions, reels, and business profiles will appear here.'
                  }
                />
              ) : (
                sortedRooms.map(room => {
                  const id = roomId(room);
                  const name = roomName(room, idLocale);
                  const avatar = roomAvatar(room);
                  const unread = roomUnread(room);
                  const href = id ? `/chat/${encodeURIComponent(id)}` : '/chat';

                  return (
                    <Link
                      key={id || name}
                      href={href}
                      onClick={() => {
                        setOpen(false);
                        if (id) chatInbox.markRoomRead(id);
                      }}
                      className="group flex min-h-[66px] items-center gap-3 rounded-[18px] px-2.5 py-2.5 transition hover:bg-[color:var(--app-surface-muted)]"
                    >
                      <span className="relative inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                        <Image
                          src={avatar}
                          alt=""
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                        {unread > 0 ? (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold text-[color:var(--app-text)]">
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                            {formatRelativeTime(
                              toText(room.last_message_at),
                              idLocale,
                            )}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-xs leading-5',
                              unread > 0
                                ? 'font-bold text-[color:var(--app-text)]'
                                : 'text-[color:var(--app-text-soft)]',
                            )}
                          >
                            {roomMessage(room, idLocale)}
                          </span>
                          {unread > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {compactCount(unread)}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )
            ) : notificationInbox.loading ? (
              <LoadingRows />
            ) : sortedNotifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-4 w-4" />}
                title={
                  idLocale ? 'Belum ada notifikasi' : 'No notifications yet'
                }
                body={
                  idLocale
                    ? PROMO_ONLY_MODE
                      ? 'Update chat, keamanan, dan profil usaha akan tampil di sini.'
                      : 'Update pembayaran, keamanan, dan transaksi penting akan tampil di sini.'
                    : PROMO_ONLY_MODE
                      ? 'Chat, security, and business profile updates will appear here.'
                      : 'Payment, security, and transaction updates will appear here.'
                }
              />
            ) : (
              sortedNotifications.map(item => {
                const href = notificationHref(item);
                const visual = notificationPresentation({
                  category: item.category,
                  eventType: item.event_type,
                  title: item.title,
                  message: item.message,
                });
                const Icon = visual.Icon;
                const legacyEmojiLabel = notificationEmoji(item, visual.label);
                const social = notificationSocialContext(item);
                const summary = notificationSocialSummary(
                  item,
                  idLocale ? 'id' : 'en',
                );
                const actorLabel = summary.actor;
                const actorHandle = summary.handle;
                const hasSocialActor = Boolean(
                  actorLabel || social.actorAvatarUrl,
                );
                const actorAvatar = profileAvatarSrc(
                  social.actorAvatarUrl,
                  readProfileAvatarStyle(item.data),
                  actorLabel ||
                    item.title ||
                    (idLocale ? 'Pengguna Lajukan' : 'Lajukan user'),
                );
                const notificationTitle = summary.title;
                const notificationBody = summary.subtitle;

                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.is_read)
                        void notificationInbox.markRead(item.id);
                    }}
                    className={cn(
                      'group relative flex min-h-[72px] overflow-hidden rounded-[18px] border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-26px_rgba(15,23,42,0.28)]',
                      item.is_read
                        ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-muted)]'
                        : visual.surfaceClassName,
                    )}
                  >
                    {!item.is_read ? (
                      <span
                        className={cn(
                          'absolute left-0 top-0 h-full w-1 opacity-90',
                          visual.accentClassName,
                        )}
                      />
                    ) : null}
                    {hasSocialActor ? (
                      <span
                        className="relative mt-0.5 inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
                        aria-hidden="true"
                      >
                        <Image
                          src={actorAvatar}
                          alt=""
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white shadow-sm dark:border-slate-950',
                            visual.badgeClassName,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'relative mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                          visual.iconClassName,
                        )}
                        aria-hidden="true"
                      >
                        <span className="sr-only">{legacyEmojiLabel}</span>
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm font-bold',
                            visual.titleClassName,
                          )}
                        >
                          {notificationTitle}
                        </span>
                        {!item.is_read ? (
                          <span
                            className={cn(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              visual.accentClassName,
                            )}
                          />
                        ) : null}
                      </span>
                      {actorHandle ? (
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                          {actorHandle}
                        </span>
                      ) : null}
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {notificationBody}
                      </span>
                      {(summary.entity || summary.entityTypeLabel) ? (
                        <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                          {summary.entity ? (
                            <span className="truncate rounded-full border border-[color:var(--app-border)] bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-white/8">
                              {summary.entity}
                            </span>
                          ) : null}
                          {summary.entityTypeLabel ? (
                            <span className="rounded-full border border-[color:var(--app-border)] bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-white/8">
                              {summary.entityTypeLabel}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="mt-1.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            visual.badgeClassName,
                          )}
                        >
                          {visual.label ||
                            item.category ||
                            item.event_type ||
                            'update'}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                          {formatRelativeTime(item.created_at, idLocale)}
                        </span>
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-1 border-t border-[color:var(--app-border)] px-1 pt-2">
            <Link
              href={fullHref}
              onClick={() => setOpen(false)}
              className="ui-pressable flex min-h-[42px] items-center justify-center gap-2 rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
            >
              {isChat
                ? idLocale
                  ? 'Lihat semua chat'
                  : 'View all chats'
                : idLocale
                  ? 'Lihat semua notifikasi'
                  : 'View all notifications'}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
