'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  CheckCheck,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { LocalizedLink as Link } from '@/components/ui-kit';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
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

type LocaleCode = 'id' | 'en';
type NotificationTab = 'all' | 'activity' | 'opportunity' | 'system';
type NotificationGroup = 'new' | 'today' | 'yesterday' | 'earlier';

type NotificationClassifierInput = {
  category?: string | null;
  eventType?: string | null;
  title?: string | null;
  message?: string | null;
};

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
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat(
    locale === 'id' ? 'id-ID' : 'en-US',
    { numeric: 'auto' },
  );

  if (absSeconds < 60) {
    return absSeconds < 10
      ? locale === 'id'
        ? 'Baru saja'
        : 'Just now'
      : rtf.format(diffSeconds, 'second');
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, 'day');
  }

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function normalizeNotificationText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function notificationSearchText(input: NotificationClassifierInput): string {
  return [
    input.category,
    input.eventType,
    input.title,
    input.message,
  ]
    .map(normalizeNotificationText)
    .join(' ');
}

function classifyNotification(
  input: NotificationClassifierInput,
): Exclude<NotificationTab, 'all'> {
  const text = notificationSearchText(input);

  const systemKeywords = [
    'security',
    'keamanan',
    'login',
    'otp',
    'password',
    'verification',
    'verifikasi',
    'verified',
    'moderation',
    'moderasi',
    'account',
    'akun',
    'system',
    'sistem',
    'payment',
    'pembayaran',
    'paid',
    'topup',
    'top-up',
    'refund',
    'wallet',
    'saldo',
    'failed',
    'gagal',
    'cancel',
    'dibatalkan',
    'pending',
    'menunggu',
    'delivered',
    'delivery',
    'pengiriman',
    'support',
    'bantuan',
  ];

  if (systemKeywords.some(keyword => text.includes(keyword))) {
    return 'system';
  }

  const opportunityKeywords = [
    'offer',
    'tawaran',
    'lead',
    'buyer',
    'pembeli',
    'supplier',
    'penyedia',
    'need',
    'kebutuhan',
    'request',
    'permintaan',
    'proposal',
    'penawaran',
    'opportunity',
    'peluang',
    'listing match',
    'saved search',
    'cocok dengan',
  ];

  if (opportunityKeywords.some(keyword => text.includes(keyword))) {
    return 'opportunity';
  }

  return 'activity';
}

function startOfLocalDay(value: Date): number {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function resolveNotificationGroup(
  createdAt: string | null | undefined,
  isRead: boolean,
): NotificationGroup {
  if (!isRead) return 'new';

  if (!createdAt) return 'earlier';

  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return 'earlier';

  const today = startOfLocalDay(new Date());
  const createdDay = startOfLocalDay(created);
  const dayDiff = Math.round((today - createdDay) / 86_400_000);

  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  return 'earlier';
}

function tabLabel(tab: NotificationTab, isId: boolean): string {
  switch (tab) {
    case 'activity':
      return isId ? 'Aktivitas' : 'Activity';
    case 'opportunity':
      return isId ? 'Peluang' : 'Opportunities';
    case 'system':
      return isId ? 'Sistem' : 'System';
    default:
      return isId ? 'Semua' : 'All';
  }
}

function groupLabel(group: NotificationGroup, isId: boolean): string {
  switch (group) {
    case 'new':
      return isId ? 'Baru' : 'New';
    case 'today':
      return isId ? 'Hari ini' : 'Today';
    case 'yesterday':
      return isId ? 'Kemarin' : 'Yesterday';
    default:
      return isId ? 'Sebelumnya' : 'Earlier';
  }
}

function tabIcon(tab: NotificationTab) {
  switch (tab) {
    case 'activity':
      return Activity;
    case 'opportunity':
      return BriefcaseBusiness;
    case 'system':
      return ShieldCheck;
    default:
      return Inbox;
  }
}

export default function NotificationsPage() {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const isId = locale === 'id';

  const {
    items,
    loading,
    refetch,
    markRead,
    markAllRead,
  } = useNotificationInbox();

  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
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

  const counts = useMemo(() => {
    const next = {
      all: visibleItems.length,
      activity: 0,
      opportunity: 0,
      system: 0,
    };

    visibleItems.forEach(item => {
      const category = classifyNotification({
        category: item.category,
        eventType: item.event_type,
        title: item.title,
        message: item.message,
      });

      next[category] += 1;
    });

    return next;
  }, [visibleItems]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return visibleItems;

    return visibleItems.filter(
      item =>
        classifyNotification({
          category: item.category,
          eventType: item.event_type,
          title: item.title,
          message: item.message,
        }) === activeTab,
    );
  }, [activeTab, visibleItems]);

  const groupedItems = useMemo(() => {
    const groups: Record<NotificationGroup, typeof filteredItems> = {
      new: [],
      today: [],
      yesterday: [],
      earlier: [],
    };

    filteredItems.forEach(item => {
      groups[
        resolveNotificationGroup(item.created_at, item.is_read)
      ].push(item);
    });

    return groups;
  }, [filteredItems]);

  const groupOrder: NotificationGroup[] = [
    'new',
    'today',
    'yesterday',
    'earlier',
  ];

  const tabs: NotificationTab[] = [
    'all',
    'activity',
    'opportunity',
    'system',
  ];

  const helperText = PROMO_ONLY_MODE
    ? isId
      ? 'Komentar, chat, peluang usaha, keamanan, dan aktivitas penting ada di sini.'
      : 'Comments, chats, business opportunities, security, and important activity appear here.'
    : isId
      ? 'Aktivitas, peluang bisnis, transaksi, dan keamanan akun ada di satu tempat.'
      : 'Activity, business opportunities, transactions, and account security are all in one place.';

  const emptyTitle =
    activeTab === 'all'
      ? isId
        ? 'Belum ada kabar baru'
        : 'No updates yet'
      : isId
        ? `Belum ada ${tabLabel(activeTab, true).toLowerCase()}`
        : `No ${tabLabel(activeTab, false).toLowerCase()} yet`;

  const emptyDescription =
    activeTab === 'all'
      ? isId
        ? 'Kalau ada komentar, calon pembeli, update listing, atau aktivitas penting, semuanya akan muncul di sini.'
        : 'Comments, potential buyers, listing updates, and important activity will appear here.'
      : isId
        ? 'Coba pilih Semua untuk melihat notifikasi dari kategori lain.'
        : 'Choose All to see notifications from other categories.';

  return (
    <section className="page-shell pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 sm:pt-4 lg:pb-10">
      <div className="mx-auto w-full max-w-[820px]">
        {/* Header */}
        <header className="px-1 pb-3 sm:px-0 sm:pb-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                  <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                  {visibleUnreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--app-accent)] ring-[3px] ring-[color:var(--app-surface-muted)]" />
                  ) : null}
                </span>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="truncate text-[1.35rem] font-black leading-none tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.65rem]">
                      {isId ? 'Notifikasi' : 'Notifications'}
                    </h1>

                    {visibleUnreadCount > 0 ? (
                      <span className="inline-flex min-h-5 items-center rounded-full bg-[color:var(--app-accent)] px-2 text-[10px] font-black text-[color:var(--app-text-inverse)]">
                        {visibleUnreadCount > 99
                          ? '99+'
                          : visibleUnreadCount}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 max-w-[570px] text-[11px] font-medium leading-4.5 text-[color:var(--app-text-soft)] sm:text-xs sm:leading-5">
                    {helperText}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void refetch()}
                className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface)] hover:text-[color:var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/30"
                aria-label={isId ? 'Muat ulang notifikasi' : 'Refresh notifications'}
                title={isId ? 'Muat ulang' : 'Refresh'}
              >
                <RefreshCcw className="h-4 w-4" />
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
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-[10px] font-black text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/30 disabled:pointer-events-none disabled:opacity-40 sm:px-3 sm:text-[11px]"
                aria-label={
                  isId
                    ? 'Tandai semua notifikasi sudah dibaca'
                    : 'Mark all notifications as read'
                }
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                <span className="hidden min-[390px]:inline">
                  {isId ? 'Tandai dibaca' : 'Mark read'}
                </span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="mt-4 flex w-full min-w-0 gap-1 overflow-x-auto rounded-[14px] bg-[color:var(--app-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-fit"
            role="tablist"
            aria-label={isId ? 'Filter notifikasi' : 'Notification filters'}
          >
            {tabs.map(tab => {
              const selected = activeTab === tab;
              const Icon = tabIcon(tab);
              const count = counts[tab];

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/25 sm:px-3 sm:text-[11px]',
                    selected
                      ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-sm ring-1 ring-[color:var(--app-border)]'
                      : 'text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      selected && 'text-[color:var(--app-accent)]',
                    )}
                  />
                  <span>{tabLabel(tab, isId)}</span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        'min-w-4 rounded-full px-1 text-center text-[9px] font-black',
                        selected
                          ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                      )}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </header>

        {/* Feed */}
        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
            <div className="border-b border-[color:var(--app-border)] px-4 py-3">
              <Skeleton className="h-3 w-16" />
            </div>

            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 px-3 py-3.5 sm:px-4',
                  index > 0 &&
                    'border-t border-[color:var(--app-border)]',
                )}
              >
                <Skeleton className="h-11 w-11 shrink-0 rounded-full sm:h-12 sm:w-12" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-3/5" />
                  <Skeleton className="mt-2 h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-5 py-12 text-center sm:py-16">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {activeTab === 'all' ? (
                <Bell className="h-6 w-6" />
              ) : (
                (() => {
                  const Icon = tabIcon(activeTab);
                  return <Icon className="h-6 w-6" />;
                })()
              )}
            </span>

            <h2 className="mt-4 text-base font-black tracking-[-0.02em] text-[color:var(--app-text)]">
              {emptyTitle}
            </h2>

            <p className="mx-auto mt-1.5 max-w-[420px] text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">
              {emptyDescription}
            </p>

            {activeTab !== 'all' ? (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[color:var(--app-accent-soft)] px-4 text-xs font-black text-[color:var(--app-accent)] transition hover:brightness-95"
              >
                {isId ? 'Lihat semua' : 'View all'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {groupOrder.map(group => {
              const groupItems = groupedItems[group];
              if (groupItems.length === 0) return null;

              return (
                <section
                  key={group}
                  aria-labelledby={`notification-group-${group}`}
                >
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <h2
                      id={`notification-group-${group}`}
                      className={cn(
                        'text-[11px] font-black tracking-[-0.01em] sm:text-xs',
                        group === 'new'
                          ? 'text-[color:var(--app-accent)]'
                          : 'text-[color:var(--app-text-soft)]',
                      )}
                    >
                      {groupLabel(group, isId)}
                    </h2>

                    {group === 'new' ? (
                      <span className="text-[9px] font-bold text-[color:var(--app-text-soft)] sm:text-[10px]">
                        {isId
                          ? `${groupItems.length} belum dibaca`
                          : `${groupItems.length} unread`}
                      </span>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]">
                    {groupItems.map((item, index) => {
                      const visual = notificationPresentation({
                        category: item.category,
                        eventType: item.event_type,
                        title: item.title,
                        message: item.message,
                      });

                      const Icon = visual.Icon;
                      const href = notificationTargetHref(item);
                      const social = notificationSocialContext(item);
                      const summary = notificationSocialSummary(item, locale);

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
                          (isId ? 'Pengguna Lajukan' : 'Lajukan user'),
                      );

                      const notificationTitle = summary.title;
                      const notificationBody = summary.subtitle;
                      const notificationMeta = summary.metaLabel;
                      const category = classifyNotification({
                        category: item.category,
                        eventType: item.event_type,
                        title: item.title,
                        message: item.message,
                      });

                      return (
                        <Link
                          key={item.id}
                          href={href}
                          onClick={() => {
                            if (!item.is_read) {
                              void markRead(item.id);
                            }
                          }}
                          className={cn(
                            'group relative flex min-w-0 items-start gap-3 px-3 py-3.5 text-left transition sm:px-4 sm:py-4',
                            index > 0 &&
                              'border-t border-[color:var(--app-border)]',
                            item.is_read
                              ? 'bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface)]'
                              : 'bg-[color:var(--app-accent-soft)]/55 hover:bg-[color:var(--app-accent-soft)]',
                          )}
                        >
                          {!item.is_read ? (
                            <span
                              className="absolute left-0 top-0 h-full w-[3px] bg-[color:var(--app-accent)]"
                              aria-hidden="true"
                            />
                          ) : null}

                          {/* Actor / notification visual */}
                          {hasSocialActor ? (
                            <span
                              className="relative inline-flex h-11 w-11 shrink-0 overflow-visible rounded-full sm:h-12 sm:w-12"
                              aria-hidden="true"
                            >
                              <span className="h-full w-full overflow-hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]">
                                <Image
                                  src={actorAvatar}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              </span>

                              <span
                                className={cn(
                                  'absolute -bottom-1 -right-1 grid h-5.5 w-5.5 place-items-center rounded-full border-2 border-[color:var(--app-surface-strong)] shadow-sm',
                                  visual.badgeClassName,
                                )}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'grid h-11 w-11 shrink-0 place-items-center rounded-full border sm:h-12 sm:w-12',
                                visual.iconClassName,
                              )}
                              aria-hidden="true"
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                          )}

                          {/* Copy */}
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-start gap-2">
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    'block text-[13px] leading-[18px] tracking-[-0.01em] sm:text-sm sm:leading-5',
                                    item.is_read
                                      ? 'font-semibold text-[color:var(--app-text)]'
                                      : 'font-black text-[color:var(--app-text)]',
                                  )}
                                >
                                  {notificationTitle}
                                </span>

                                {actorHandle ? (
                                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                                    {actorHandle}
                                  </span>
                                ) : null}
                              </span>

                              <span
                                className={cn(
                                  'shrink-0 pt-0.5 text-[9px] font-semibold sm:text-[10px]',
                                  item.is_read
                                    ? 'text-[color:var(--app-text-soft)]'
                                    : 'text-[color:var(--app-accent)]',
                                )}
                              >
                                {formatRelativeTime(item.created_at, locale)}
                              </span>
                            </span>

                            {notificationBody ? (
                              <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-[17px] text-[color:var(--app-text-soft)] sm:text-xs sm:leading-[18px]">
                                {notificationBody}
                              </span>
                            ) : null}

                            <span className="mt-2 flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex min-w-0 items-center gap-1 text-[9px] font-bold sm:text-[10px]',
                                  category === 'opportunity'
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : category === 'system'
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-[color:var(--app-text-soft)]',
                                )}
                              >
                                {category === 'opportunity' ? (
                                  <BriefcaseBusiness className="h-3 w-3 shrink-0" />
                                ) : category === 'system' ? (
                                  <ShieldCheck className="h-3 w-3 shrink-0" />
                                ) : (
                                  <Activity className="h-3 w-3 shrink-0" />
                                )}

                                <span className="truncate">
                                  {tabLabel(category, isId)}
                                  {notificationMeta
                                    ? ` · ${notificationMeta}`
                                    : ''}
                                </span>
                              </span>

                              {!item.is_read ? (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
                              ) : null}
                            </span>
                          </span>

                          <span className="mt-4 hidden h-7 w-7 shrink-0 place-items-center rounded-full text-[color:var(--app-text-soft)] transition group-hover:bg-[color:var(--app-surface-strong)] group-hover:text-[color:var(--app-text)] sm:grid">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Bottom hint */}
        {!loading && filteredItems.length > 0 ? (
          <div className="mt-4 flex items-start gap-2 px-2 text-[10px] font-medium leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
            <p>
              {isId
                ? 'Notifikasi yang belum dibaca ditandai lebih jelas. Buka notifikasi untuk melihat detail dan otomatis menandainya sebagai dibaca.'
                : 'Unread notifications are highlighted. Open a notification to view details and automatically mark it as read.'}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}