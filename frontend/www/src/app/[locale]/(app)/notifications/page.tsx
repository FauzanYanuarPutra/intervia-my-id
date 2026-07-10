'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { LocalizedLink as Link } from '@/components/ui-kit';
import {
  Bell,
  CheckCheck,
  Loader2,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import {
  isMoneyRelatedNotification,
  notificationPresentation,
} from '@/lib/notifications/presentation';
import {
  notificationSocialContext,
  notificationTargetHref,
  notificationTargetLabel,
} from '@/lib/notifications/social';
import { cn } from '@/lib/utils';

type LocaleCode = 'id' | 'en';

function formatRelativeTime(
  value: string | null | undefined,
  locale: LocaleCode,
): string {
  if (!value) return locale === 'id' ? 'Baru saja' : 'Just now';

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return locale === 'id' ? 'Baru saja' : 'Just now';
  }

  const diffSeconds = Math.round((parsed - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(
    locale === 'id' ? 'id-ID' : 'en-US',
    { numeric: 'auto' },
  );

  if (abs < 60) return rtf.format(diffSeconds, 'second');

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function pickNotificationEmoji(input: {
  category?: string | null;
  eventType?: string | null;
  title?: string | null;
  message?: string | null;
  label?: string | null;
}): string {
  const text = [
    input.category,
    input.eventType,
    input.title,
    input.message,
    input.label,
  ]
    .map(cleanText)
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
  if (
    text.includes('wallet') ||
    text.includes('saldo') ||
    text.includes('dana masuk')
  ) {
    return '💰';
  }
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
  if (
    text.includes('delivered') ||
    text.includes('dikirim') ||
    text.includes('pengiriman')
  ) {
    return '🚚';
  }
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

export default function NotificationsPage() {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const isId = locale === 'id';
  const { items, loading, refetch, markRead, markAllRead } =
    useNotificationInbox();
  const [submitting, setSubmitting] = useState(false);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [items],
  );
  const visibleItems = useMemo(
    () =>
      sortedItems.filter(
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
    [sortedItems],
  );
  const visibleUnreadCount = useMemo(
    () => visibleItems.filter(item => !item.is_read).length,
    [visibleItems],
  );

  const unreadLabel = isId
    ? `${visibleUnreadCount} belum dibaca`
    : `${visibleUnreadCount} unread`;
  const helperText = PROMO_ONLY_MODE
    ? isId
      ? 'Update chat, keamanan, profil usaha, dan aktivitas penting akan tampil di sini.'
      : 'Chat, security, business profile, and key activity updates appear here.'
    : isId
      ? 'Update pembayaran, keamanan, transaksi, dan aktivitas penting akan tampil di sini.'
      : 'Payment, security, transaction, and key activity updates appear here.';

  return (
    <section className="mx-auto w-full max-w-[920px] px-2 py-3 sm:px-4 sm:py-5">
      <div className="overflow-hidden rounded-[26px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_54%,#eff6ff_100%)] p-3 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[linear-gradient(135deg,#0f766e,#16a34a)] text-white shadow-[0_16px_30px_-22px_rgba(21,128,61,0.95)] sm:h-12 sm:w-12">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-[13px] shadow-sm">
                ✨
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                Inbox
              </p>
              <h1 className="mt-0.5 truncate text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[color:var(--app-text)] sm:text-[1.65rem]">
                {isId ? 'Notifikasi' : 'Notifications'}
              </h1>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-[color:var(--app-text-soft)] sm:text-xs">
                {unreadLabel}. {helperText}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none">
            <button
              type="button"
              onClick={() => void refetch()}
              className="ui-pressable inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-[15px] border border-[color:var(--app-border)] bg-white/88 px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-white/8"
              aria-label={isId ? 'Refresh notifikasi' : 'Refresh notifications'}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              disabled={submitting || visibleUnreadCount === 0}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await markAllRead();
                } finally {
                  setSubmitting(false);
                }
              }}
              className="ui-pressable inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-[15px] bg-[color:var(--app-accent)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={
                isId ? 'Tandai semua dibaca' : 'Mark all notifications read'
              }
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isId ? 'Bereskan' : 'Clear'}
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[22px] border border-[color:var(--app-border)] bg-white/82 p-3 dark:bg-white/8"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-[18px]" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="mt-2 h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-[color:var(--app-border)] bg-white/74 p-8 text-center text-sm font-semibold text-[color:var(--app-text-soft)] dark:bg-white/8">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-[color:var(--app-accent)]" />
            {isId
              ? 'Belum ada notifikasi. Nanti update penting akan muncul di sini.'
              : 'No notifications yet. Important updates will appear here.'}
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {visibleItems.map(item => {
              const visual = notificationPresentation({
                category: item.category,
                eventType: item.event_type,
                title: item.title,
                message: item.message,
              });
              const Icon = visual.Icon;
              const emoji = pickNotificationEmoji({
                category: item.category,
                eventType: item.event_type,
                title: item.title,
                message: item.message,
                label: visual.label,
              });
              const href = notificationTargetHref(item);
              const social = notificationSocialContext(item);

              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => {
                    if (!item.is_read) void markRead(item.id);
                  }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-[20px] border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.32)] sm:p-3',
                    item.is_read
                      ? 'border-[color:var(--app-border)] bg-white/85 opacity-90 dark:bg-white/[0.06]'
                      : visual.surfaceClassName,
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0 top-0 h-full w-1.5 opacity-95',
                      visual.accentClassName,
                    )}
                  />
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border text-[1.22rem] shadow-[0_14px_24px_-22px_rgba(15,23,42,0.32)] sm:h-12 sm:w-12 sm:text-[1.35rem]',
                        visual.iconClassName,
                      )}
                      aria-hidden="true"
                    >
                      <span className="leading-none">{emoji}</span>
                      <span
                        className={cn(
                          'absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border bg-white shadow-sm dark:bg-slate-950',
                          visual.badgeClassName,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block text-[14px] font-bold leading-5 tracking-[-0.01em] sm:text-[15px]',
                              visual.titleClassName,
                            )}
                          >
                            {item.title ||
                              (isId ? 'Notifikasi baru' : 'New notification')}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                            {item.message}
                          </span>
                        </span>

                        {!item.is_read ? (
                          <span
                            className={cn(
                              'mt-1 h-3 w-3 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.75)] dark:shadow-[0_0_0_4px_rgba(15,23,42,0.8)]',
                              visual.accentClassName,
                            )}
                          />
                        ) : null}
                      </span>

                      <span className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-bold',
                            visual.badgeClassName,
                          )}
                        >
                          {emoji} {visual.label}
                        </span>
                        <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-white/8">
                          {formatRelativeTime(item.created_at, locale)}
                        </span>
                        <span className="hidden min-w-0 truncate rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-white/8 sm:inline-flex">
                          {item.event_type || item.category || 'update'}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[10px] font-bold',
                            item.is_read
                              ? 'bg-white/75 text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-white/8'
                              : 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]',
                          )}
                        >
                          {item.is_read
                            ? isId
                              ? 'Dibaca'
                              : 'Read'
                            : isId
                              ? 'Baru'
                              : 'New'}
                        </span>
                      </span>

                      {(social.actorName ||
                        social.actorHandle ||
                        social.entityLabel ||
                        social.entityType) ? (
                        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                          {social.actorName || social.actorHandle ? (
                            <span className="truncate rounded-full border border-[color:var(--app-border)] bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-white/8">
                              {social.actorName ||
                                (social.actorHandle
                                  ? `@${social.actorHandle}`
                                  : '')}
                            </span>
                          ) : null}
                          {social.entityLabel ? (
                            <span className="truncate rounded-full border border-[color:var(--app-border)] bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-white/8">
                              {social.entityLabel}
                            </span>
                          ) : null}
                          {social.entityType ? (
                            <span className="rounded-full border border-[color:var(--app-border)] bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] dark:bg-white/8">
                              {notificationTargetLabel(social.entityType)}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
