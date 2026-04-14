'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Loader2,
  RefreshCcw,
  ArrowDownToLine,
  ArrowUpRight,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  BadgeCheck,
  XCircle,
  Info,
} from 'lucide-react';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { Skeleton } from '@/components/ui/Skeleton';

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function badgeClass(category: string): string {
  if (category === 'wallet') return 'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)]';
  if (category === 'transaction') return 'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)]';
  if (category === 'security') return 'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)]';
  return 'bg-[color:color-mix(in_srgb,_var(--app-surface)_15%,_transparent)] text-[color:var(--app-text-soft)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
}

/**
 * Meta utk ikon/emoji/aksen warna.
 * Prioritas: event_type dulu (lebih spesifik), lalu fallback ke category.
 */
function notifMeta(category?: string | null, eventType?: string | null) {
  const ev = (eventType ?? '').toLowerCase();
  const cat = (category ?? '').toLowerCase();

  // helper detect
  const has = (...keys: string[]) => keys.some((k) => ev.includes(k));

  // event_type mapping (silakan tambah sesuai event kamu)
  if (has('topup', 'deposit', 'cash_in', 'credit')) {
    return {
      Icon: ArrowDownToLine,
      emoji: '➕',
      accent: 'bg-[color:var(--app-accent)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-accent)]',
    };
  }
  if (has('withdraw', 'cash_out', 'payout')) {
    return {
      Icon: ArrowUpRight,
      emoji: '↗️',
      accent: 'bg-[color:var(--app-warning)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-warning)]',
    };
  }
  if (has('payment', 'purchase', 'bill')) {
    return {
      Icon: CreditCard,
      emoji: '💳',
      accent: 'bg-[color:var(--app-info)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-info)]',
    };
  }
  if (has('success', 'completed', 'settled')) {
    return {
      Icon: BadgeCheck,
      emoji: '✅',
      accent: 'bg-[color:var(--app-accent)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-accent)]',
    };
  }
  if (has('failed', 'error', 'rejected')) {
    return {
      Icon: XCircle,
      emoji: '❌',
      accent: 'bg-[color:var(--app-danger)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-danger)]',
    };
  }
  if (has('security', 'login', 'otp', 'fraud', 'device')) {
    return {
      Icon: ShieldAlert,
      emoji: '🛡️',
      accent: 'bg-[color:var(--app-danger)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-danger)]',
    };
  }

  // fallback by category
  if (cat === 'wallet') {
    return {
      Icon: Wallet,
      emoji: '👛',
      accent: 'bg-[color:var(--app-accent)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-accent)]',
    };
  }
  if (cat === 'transaction') {
    return {
      Icon: ArrowUpRight,
      emoji: '🔁',
      accent: 'bg-[color:var(--app-info)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] border-[color:color-mix(in_srgb,_var(--app-info-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-info)]',
    };
  }
  if (cat === 'security') {
    return {
      Icon: ShieldCheck,
      emoji: '🔐',
      accent: 'bg-[color:var(--app-danger)]',
      iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)]',
      title: 'text-[color:var(--app-danger)]',
    };
  }

  return {
    Icon: Info,
    emoji: '🔔',
    accent: 'bg-[color:var(--app-surface)]',
    iconWrap: 'bg-[color:color-mix(in_srgb,_var(--app-surface)_15%,_transparent)] text-[color:var(--app-text-soft)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]',
    title: 'text-[color:var(--app-text-soft)]',
  };
}

export default function NotificationsPage() {
  const { items, unreadCount, loading, refetch, markRead, markAllRead } =
    useNotificationInbox();
  const [submitting, setSubmitting] = useState(false);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [items],
  );

  return (
    <section className="mx-auto w-full max-w-[var(--app-max-width)] px-0 py-4 sm:px-3 sm:py-5">
      <div className="ui-feed-section rounded-none border border-x-0 border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 sm:rounded-3xl sm:border-x sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-page-eyebrow">Notifikasi</p>
            <h1 className="ui-page-title mt-2 text-[1.35rem] sm:text-[1.55rem]">Update penting</h1>
            <p className="ui-page-copy mt-2">
              Cek dulu, lalu lanjut ke transaksi atau saldo.
            </p>
          </div>
          <div className="ui-page-actions items-center">
            <span className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
              Belum dibaca: {unreadCount}
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="ui-button-secondary ui-button-compact inline-flex items-center gap-2 px-3 text-xs font-semibold"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Muat ulang
            </button>
            <button
              type="button"
              disabled={submitting || unreadCount === 0}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await markAllRead();
                } finally {
                  setSubmitting(false);
                }
              }}
              className="ui-button-primary ui-button-compact inline-flex items-center gap-2 px-3 text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Tandai semua
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="ui-feed-row rounded-none border border-x-0 border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3 sm:rounded-2xl sm:border-x"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="ui-feed-section mt-4 rounded-none border border-x-0 border-dashed border-[color:var(--app-border-strong)] p-6 text-center text-sm text-[color:var(--app-text-soft)] sm:rounded-2xl sm:border-x">
            <Bell className="mx-auto mb-2 h-5 w-5 text-[color:var(--app-text)]" />
            Belum ada notifikasi.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {sortedItems.map((item) => {
              const meta = notifMeta(item.category, item.event_type);
              const Icon = meta.Icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!item.is_read) void markRead(item.id);
                  }}
                  className={`ui-feed-row group relative w-full overflow-hidden rounded-none border border-x-0 p-3 text-left transition sm:rounded-2xl sm:border-x ${
                    item.is_read
                      ? 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)]'
                      : 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)]'
                  }`}
                >
                  {/* accent bar */}
                  <span
                    className={`absolute left-0 top-0 h-full w-1.5 opacity-80 ${meta.accent}`}
                  />

                  <div className="flex items-start gap-3">
                    {/* icon bubble */}
                    <div
                      className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${meta.iconWrap}`}
                      aria-hidden="true"
                      title={item.event_type}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`truncate text-sm font-black ${meta.title}`}>
                          <span className="mr-2" aria-hidden="true">
                            {meta.emoji}
                          </span>
                          {item.title}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(
                              item.category,
                            )}`}
                          >
                            {item.category}
                          </span>
                          <span className="text-[11px] text-[color:var(--app-text-soft)]">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">{item.message}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]">
                        <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                          {item.event_type}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            item.is_read
                              ? 'bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] text-[color:var(--app-text-soft)]'
                              : 'bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] text-[color:var(--app-accent)]'
                          }`}
                        >
                          {item.is_read ? 'read' : 'unread'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
