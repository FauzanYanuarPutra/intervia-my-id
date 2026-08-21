'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AtSign,
  Bell,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  CircleX,
  CreditCard,
  Eye,
  Handshake,
  Heart,
  Info,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PackageCheck,
  PlayCircle,
  RefreshCcw,
  Reply,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TriangleAlert,
  Undo2,
  UserPlus,
  WalletCards,
  type LucideIcon,
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

type NotificationSemantic =
  | 'message'
  | 'profile_view'
  | 'follow'
  | 'like'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'video_view'
  | 'business_view'
  | 'map_route'
  | 'buyer_match'
  | 'offer'
  | 'listing_success'
  | 'listing_failed'
  | 'payment_success'
  | 'payment_failed'
  | 'wallet'
  | 'refund'
  | 'security_login'
  | 'security_alert'
  | 'recommendation'
  | 'system';

type NotificationSemanticVisual = {
  semantic: NotificationSemantic;
  Icon: LucideIcon;
  label: string;
  iconClassName: string;
  badgeClassName: string;
  accentClassName: string;
  titleClassName: string;
  labelClassName: string;
  unreadRowClassName: string;
};

const NOTIFICATION_STYLE: Record<
  NotificationSemantic,
  Omit<NotificationSemanticVisual, 'semantic' | 'Icon' | 'label'>
> = {
  message: {
    iconClassName: 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/70 dark:text-sky-100',
    badgeClassName: 'bg-sky-600 text-white ring-2 ring-sky-200 dark:bg-sky-500 dark:ring-sky-900',
    accentClassName: 'bg-sky-500',
    titleClassName: 'text-sky-950 dark:text-sky-100',
    labelClassName: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-900/60 dark:text-sky-200 dark:ring-sky-800',
    unreadRowClassName: 'bg-sky-50/85 hover:bg-sky-100/80 dark:bg-sky-950/28 dark:hover:bg-sky-950/45',
  },
  profile_view: {
    iconClassName: 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/70 dark:text-violet-100',
    badgeClassName: 'bg-violet-600 text-white ring-2 ring-violet-200 dark:bg-violet-500 dark:ring-violet-900',
    accentClassName: 'bg-violet-500',
    titleClassName: 'text-violet-950 dark:text-violet-100',
    labelClassName: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-900/60 dark:text-violet-200 dark:ring-violet-800',
    unreadRowClassName: 'bg-violet-50/85 hover:bg-violet-100/80 dark:bg-violet-950/28 dark:hover:bg-violet-950/45',
  },
  follow: {
    iconClassName: 'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/70 dark:text-cyan-100',
    badgeClassName: 'bg-cyan-600 text-white ring-2 ring-cyan-200 dark:bg-cyan-500 dark:ring-cyan-900',
    accentClassName: 'bg-cyan-500',
    titleClassName: 'text-cyan-950 dark:text-cyan-100',
    labelClassName: 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200 dark:bg-cyan-900/60 dark:text-cyan-200 dark:ring-cyan-800',
    unreadRowClassName: 'bg-cyan-50/85 hover:bg-cyan-100/80 dark:bg-cyan-950/28 dark:hover:bg-cyan-950/45',
  },
  like: {
    iconClassName: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-900/70 dark:text-rose-100',
    badgeClassName: 'bg-rose-600 text-white ring-2 ring-rose-200 dark:bg-rose-500 dark:ring-rose-900',
    accentClassName: 'bg-rose-500',
    titleClassName: 'text-rose-950 dark:text-rose-100',
    labelClassName: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-900/60 dark:text-rose-200 dark:ring-rose-800',
    unreadRowClassName: 'bg-rose-50/85 hover:bg-rose-100/80 dark:bg-rose-950/28 dark:hover:bg-rose-950/45',
  },
  comment: {
    iconClassName: 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/70 dark:text-blue-100',
    badgeClassName: 'bg-blue-600 text-white ring-2 ring-blue-200 dark:bg-blue-500 dark:ring-blue-900',
    accentClassName: 'bg-blue-500',
    titleClassName: 'text-blue-950 dark:text-blue-100',
    labelClassName: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-900/60 dark:text-blue-200 dark:ring-blue-800',
    unreadRowClassName: 'bg-blue-50/85 hover:bg-blue-100/80 dark:bg-blue-950/28 dark:hover:bg-blue-950/45',
  },
  reply: {
    iconClassName: 'border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-100',
    badgeClassName: 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:bg-indigo-500 dark:ring-indigo-900',
    accentClassName: 'bg-indigo-500',
    titleClassName: 'text-indigo-950 dark:text-indigo-100',
    labelClassName: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-200 dark:ring-indigo-800',
    unreadRowClassName: 'bg-indigo-50/85 hover:bg-indigo-100/80 dark:bg-indigo-950/28 dark:hover:bg-indigo-950/45',
  },
  mention: {
    iconClassName: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-700 dark:bg-fuchsia-900/70 dark:text-fuchsia-100',
    badgeClassName: 'bg-fuchsia-600 text-white ring-2 ring-fuchsia-200 dark:bg-fuchsia-500 dark:ring-fuchsia-900',
    accentClassName: 'bg-fuchsia-500',
    titleClassName: 'text-fuchsia-950 dark:text-fuchsia-100',
    labelClassName: 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200 dark:bg-fuchsia-900/60 dark:text-fuchsia-200 dark:ring-fuchsia-800',
    unreadRowClassName: 'bg-fuchsia-50/85 hover:bg-fuchsia-100/80 dark:bg-fuchsia-950/28 dark:hover:bg-fuchsia-950/45',
  },
  video_view: {
    iconClassName: 'border-pink-300 bg-pink-100 text-pink-800 dark:border-pink-700 dark:bg-pink-900/70 dark:text-pink-100',
    badgeClassName: 'bg-pink-600 text-white ring-2 ring-pink-200 dark:bg-pink-500 dark:ring-pink-900',
    accentClassName: 'bg-pink-500',
    titleClassName: 'text-pink-950 dark:text-pink-100',
    labelClassName: 'bg-pink-100 text-pink-800 ring-1 ring-pink-200 dark:bg-pink-900/60 dark:text-pink-200 dark:ring-pink-800',
    unreadRowClassName: 'bg-pink-50/85 hover:bg-pink-100/80 dark:bg-pink-950/28 dark:hover:bg-pink-950/45',
  },
  business_view: {
    iconClassName: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-100',
    badgeClassName: 'bg-emerald-600 text-white ring-2 ring-emerald-200 dark:bg-emerald-500 dark:ring-emerald-900',
    accentClassName: 'bg-emerald-500',
    titleClassName: 'text-emerald-950 dark:text-emerald-100',
    labelClassName: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 dark:ring-emerald-800',
    unreadRowClassName: 'bg-emerald-50/85 hover:bg-emerald-100/80 dark:bg-emerald-950/28 dark:hover:bg-emerald-950/45',
  },
  map_route: {
    iconClassName: 'border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-700 dark:bg-teal-900/70 dark:text-teal-100',
    badgeClassName: 'bg-teal-600 text-white ring-2 ring-teal-200 dark:bg-teal-500 dark:ring-teal-900',
    accentClassName: 'bg-teal-500',
    titleClassName: 'text-teal-950 dark:text-teal-100',
    labelClassName: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-900/60 dark:text-teal-200 dark:ring-teal-800',
    unreadRowClassName: 'bg-teal-50/85 hover:bg-teal-100/80 dark:bg-teal-950/28 dark:hover:bg-teal-950/45',
  },
  buyer_match: {
    iconClassName: 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/70 dark:text-green-100',
    badgeClassName: 'bg-green-600 text-white ring-2 ring-green-200 dark:bg-green-500 dark:ring-green-900',
    accentClassName: 'bg-green-500',
    titleClassName: 'text-green-950 dark:text-green-100',
    labelClassName: 'bg-green-100 text-green-800 ring-1 ring-green-200 dark:bg-green-900/60 dark:text-green-200 dark:ring-green-800',
    unreadRowClassName: 'bg-green-50/85 hover:bg-green-100/80 dark:bg-green-950/28 dark:hover:bg-green-950/45',
  },
  offer: {
    iconClassName: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/70 dark:text-amber-100',
    badgeClassName: 'bg-amber-500 text-zinc-950 ring-2 ring-amber-200 dark:bg-amber-400 dark:ring-amber-900',
    accentClassName: 'bg-amber-500',
    titleClassName: 'text-amber-950 dark:text-amber-100',
    labelClassName: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:ring-amber-800',
    unreadRowClassName: 'bg-amber-50/90 hover:bg-amber-100/85 dark:bg-amber-950/28 dark:hover:bg-amber-950/45',
  },
  listing_success: {
    iconClassName: 'border-lime-300 bg-lime-100 text-lime-900 dark:border-lime-700 dark:bg-lime-900/70 dark:text-lime-100',
    badgeClassName: 'bg-lime-600 text-white ring-2 ring-lime-200 dark:bg-lime-500 dark:ring-lime-900',
    accentClassName: 'bg-lime-500',
    titleClassName: 'text-lime-950 dark:text-lime-100',
    labelClassName: 'bg-lime-100 text-lime-900 ring-1 ring-lime-200 dark:bg-lime-900/60 dark:text-lime-200 dark:ring-lime-800',
    unreadRowClassName: 'bg-lime-50/85 hover:bg-lime-100/80 dark:bg-lime-950/28 dark:hover:bg-lime-950/45',
  },
  listing_failed: {
    iconClassName: 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900/70 dark:text-orange-100',
    badgeClassName: 'bg-orange-600 text-white ring-2 ring-orange-200 dark:bg-orange-500 dark:ring-orange-900',
    accentClassName: 'bg-orange-500',
    titleClassName: 'text-orange-950 dark:text-orange-100',
    labelClassName: 'bg-orange-100 text-orange-900 ring-1 ring-orange-200 dark:bg-orange-900/60 dark:text-orange-200 dark:ring-orange-800',
    unreadRowClassName: 'bg-orange-50/85 hover:bg-orange-100/80 dark:bg-orange-950/28 dark:hover:bg-orange-950/45',
  },
  payment_success: {
    iconClassName: 'border-emerald-400 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-white',
    badgeClassName: 'bg-emerald-700 text-white ring-2 ring-emerald-200 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-900',
    accentClassName: 'bg-emerald-600',
    titleClassName: 'text-emerald-950 dark:text-emerald-100',
    labelClassName: 'bg-emerald-600 text-white ring-1 ring-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-400',
    unreadRowClassName: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55',
  },
  payment_failed: {
    iconClassName: 'border-red-400 bg-red-600 text-white dark:border-red-400 dark:bg-red-500 dark:text-white',
    badgeClassName: 'bg-red-700 text-white ring-2 ring-red-200 dark:bg-red-400 dark:text-red-950 dark:ring-red-900',
    accentClassName: 'bg-red-600',
    titleClassName: 'text-red-950 dark:text-red-100',
    labelClassName: 'bg-red-600 text-white ring-1 ring-red-700 dark:bg-red-500 dark:text-white dark:ring-red-400',
    unreadRowClassName: 'bg-red-50 hover:bg-red-100 dark:bg-red-950/35 dark:hover:bg-red-950/55',
  },
  wallet: {
    iconClassName: 'border-teal-300 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-white',
    badgeClassName: 'bg-teal-700 text-white ring-2 ring-teal-200 dark:bg-teal-400 dark:text-teal-950 dark:ring-teal-900',
    accentClassName: 'bg-teal-600',
    titleClassName: 'text-teal-950 dark:text-teal-100',
    labelClassName: 'bg-teal-600 text-white ring-1 ring-teal-700 dark:bg-teal-500 dark:text-teal-950 dark:ring-teal-400',
    unreadRowClassName: 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/35 dark:hover:bg-teal-950/55',
  },
  refund: {
    iconClassName: 'border-orange-400 bg-orange-600 text-white dark:border-orange-400 dark:bg-orange-500 dark:text-white',
    badgeClassName: 'bg-orange-700 text-white ring-2 ring-orange-200 dark:bg-orange-400 dark:text-orange-950 dark:ring-orange-900',
    accentClassName: 'bg-orange-600',
    titleClassName: 'text-orange-950 dark:text-orange-100',
    labelClassName: 'bg-orange-600 text-white ring-1 ring-orange-700 dark:bg-orange-500 dark:text-orange-950 dark:ring-orange-400',
    unreadRowClassName: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/35 dark:hover:bg-orange-950/55',
  },
  security_login: {
    iconClassName: 'border-yellow-400 bg-yellow-300 text-yellow-950 dark:border-yellow-500 dark:bg-yellow-400 dark:text-yellow-950',
    badgeClassName: 'bg-yellow-400 text-yellow-950 ring-2 ring-yellow-100 dark:bg-yellow-300 dark:ring-yellow-900',
    accentClassName: 'bg-yellow-400',
    titleClassName: 'text-yellow-950 dark:text-yellow-100',
    labelClassName: 'bg-yellow-200 text-yellow-950 ring-1 ring-yellow-300 dark:bg-yellow-400 dark:text-yellow-950 dark:ring-yellow-500',
    unreadRowClassName: 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:hover:bg-yellow-950/48',
  },
  security_alert: {
    iconClassName: 'border-red-500 bg-red-700 text-white shadow-sm dark:border-red-400 dark:bg-red-600 dark:text-white',
    badgeClassName: 'bg-red-700 text-white ring-2 ring-red-200 dark:bg-red-500 dark:ring-red-950',
    accentClassName: 'bg-red-700',
    titleClassName: 'text-red-950 dark:text-red-100',
    labelClassName: 'bg-red-700 text-white ring-1 ring-red-800 dark:bg-red-600 dark:ring-red-500',
    unreadRowClassName: 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60',
  },
  recommendation: {
    iconClassName: 'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-900/70 dark:text-purple-100',
    badgeClassName: 'bg-purple-600 text-white ring-2 ring-purple-200 dark:bg-purple-500 dark:ring-purple-900',
    accentClassName: 'bg-purple-500',
    titleClassName: 'text-purple-950 dark:text-purple-100',
    labelClassName: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200 dark:bg-purple-900/60 dark:text-purple-200 dark:ring-purple-800',
    unreadRowClassName: 'bg-purple-50/85 hover:bg-purple-100/80 dark:bg-purple-950/28 dark:hover:bg-purple-950/45',
  },
  system: {
    iconClassName: 'border-slate-300 bg-slate-200 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
    badgeClassName: 'bg-slate-700 text-white ring-2 ring-slate-200 dark:bg-slate-300 dark:text-slate-950 dark:ring-slate-800',
    accentClassName: 'bg-slate-500',
    titleClassName: 'text-slate-950 dark:text-slate-100',
    labelClassName: 'bg-slate-200 text-slate-800 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
    unreadRowClassName: 'bg-slate-50/90 hover:bg-slate-100 dark:bg-slate-900/35 dark:hover:bg-slate-900/55',
  },
};

function notificationSearchText(item: InboxNotification, fallbackLabel = ''): string {
  let dataText = '';

  try {
    dataText = JSON.stringify(item.data ?? {});
  } catch {
    dataText = '';
  }

  return [
    item.category,
    item.event_type,
    item.title,
    item.message,
    fallbackLabel,
    dataText,
  ]
    .map(cleanNotificationText)
    .join(' ');
}

function includesAny(text: string, values: readonly string[]): boolean {
  return values.some(value => text.includes(value));
}

function resolveNotificationSemanticVisual(
  item: InboxNotification,
  isId: boolean,
): NotificationSemanticVisual {
  const fallback = notificationPresentation({
    category: item.category,
    eventType: item.event_type,
    title: item.title,
    message: item.message,
  });
  const text = notificationSearchText(item, fallback.label);

  const visual = (
    semantic: NotificationSemantic,
    Icon: LucideIcon,
    labelId: string,
    labelEn: string,
    _tone?: string,
  ): NotificationSemanticVisual => ({
    semantic,
    Icon,
    label: isId ? labelId : labelEn,
    ...NOTIFICATION_STYLE[semantic],
  });

  // Keamanan dibuat paling awal supaya kata seperti "login" tidak tertangkap kategori lain.
  if (
    includesAny(text, [
      'security.alert',
      'security_alert',
      'account.compromised',
      'suspicious',
      'mencurigakan',
      'password changed',
      'password_changed',
      'kata sandi',
      'otp failed',
      'otp_failed',
    ])
  ) {
    return visual(
      'security_alert',
      ShieldAlert,
      'Peringatan keamanan',
      'Security alert',
      'danger',
    );
  }

  if (
    includesAny(text, [
      'login.new',
      'login_new',
      'new login',
      'login baru',
      'new device',
      'perangkat baru',
      'otp',
      'sign in',
      'signin',
    ])
  ) {
    return visual(
      'security_login',
      ShieldCheck,
      'Keamanan akun',
      'Account security',
      'attention',
    );
  }

  // Pembayaran / saldo.
  if (
    includesAny(text, [
      'payment.failed',
      'payment_failed',
      'pembayaran gagal',
      'transaction.failed',
      'transaction_failed',
      'transaksi gagal',
      'charge failed',
    ])
  ) {
    return visual(
      'payment_failed',
      TriangleAlert,
      'Pembayaran gagal',
      'Payment failed',
      'danger',
    );
  }

  if (
    includesAny(text, [
      'refund',
      'refunded',
      'dikembalikan',
      'pengembalian dana',
      'money returned',
    ])
  ) {
    return visual('refund', Undo2, 'Pengembalian dana', 'Refund', 'attention');
  }

  if (
    includesAny(text, [
      'wallet',
      'saldo',
      'balance',
      'dana masuk',
      'topup',
      'top-up',
      'top up',
    ])
  ) {
    return visual('wallet', WalletCards, 'Saldo', 'Wallet', 'business');
  }

  if (
    includesAny(text, [
      'payment.success',
      'payment_success',
      'payment paid',
      'pembayaran berhasil',
      'pembayaran diterima',
      'transaction.success',
      'transaction_success',
      'paid',
    ])
  ) {
    return visual(
      'payment_success',
      CreditCard,
      'Pembayaran',
      'Payment',
      'business',
    );
  }

  // Peluang bisnis dan listing.
  if (
    includesAny(text, [
      'buyer.match',
      'buyer_match',
      'buyer matched',
      'calon pembeli',
      'pembeli cocok',
      'need.match',
      'need_match',
      'lead.match',
      'lead_match',
      'peluang baru',
    ])
  ) {
    return visual(
      'buyer_match',
      Target,
      'Peluang bisnis',
      'Business opportunity',
      'business',
    );
  }

  if (
    includesAny(text, [
      'offer',
      'tawaran',
      'proposal',
      'penawaran',
      'bid.',
      'bid_',
    ])
  ) {
    return visual('offer', Handshake, 'Tawaran', 'Offer', 'attention');
  }

  if (
    includesAny(text, [
      'listing.approved',
      'listing_approved',
      'listing published',
      'listing.published',
      'listing_publish',
      'listing berhasil',
      'listing disetujui',
      'produk disetujui',
    ])
  ) {
    return visual(
      'listing_success',
      PackageCheck,
      'Listing aktif',
      'Listing active',
      'business',
    );
  }

  if (
    includesAny(text, [
      'listing.rejected',
      'listing_rejected',
      'listing.failed',
      'listing_failed',
      'listing ditolak',
      'produk ditolak',
      'listing gagal',
    ])
  ) {
    return visual(
      'listing_failed',
      CircleX,
      'Listing perlu diperbaiki',
      'Listing needs attention',
      'danger',
    );
  }

  // Komunikasi / social. Prioritaskan event yang paling spesifik.
  if (
    includesAny(text, [
      'mention',
      'mentioned',
      'tagged',
      'tag.',
      'tag_',
      'menyebut',
      'menandai',
    ])
  ) {
    return visual('mention', AtSign, 'Menyebut kamu', 'Mention', 'discovery');
  }

  if (
    includesAny(text, [
      'content.replied',
      'content_replied',
      'reels.replied',
      'reels_replied',
      'comment.replied',
      'comment_replied',
      'replied',
      'reply',
      'membalas',
      'balasan',
    ])
  ) {
    return visual('reply', Reply, 'Balasan', 'Reply', 'communication');
  }

  if (
    includesAny(text, [
      'content.commented',
      'content_commented',
      'reels.commented',
      'reels_commented',
      'comment.created',
      'comment_created',
      'commented',
      'komentar',
      'mengomentari',
    ])
  ) {
    return visual(
      'comment',
      MessageSquareText,
      'Komentar',
      'Comment',
      'communication',
    );
  }

  if (
    includesAny(text, [
      'reels.liked',
      'reels_liked',
      'content.liked',
      'content_liked',
      'reaction',
      'liked',
      'menyukai',
      'like',
    ])
  ) {
    return visual('like', Heart, 'Suka', 'Like', 'social');
  }

  if (
    includesAny(text, [
      'followed',
      'follower',
      'follow.created',
      'follow_created',
      'mulai mengikuti',
      'mengikuti kamu',
      'mengikuti anda',
    ])
  ) {
    return visual('follow', UserPlus, 'Pengikut baru', 'New follower', 'communication');
  }

  if (
    includesAny(text, [
      'profile.viewed',
      'profile_viewed',
      'user.profile.viewed',
      'user_profile_viewed',
      'melihat profil kamu',
      'melihat profilmu',
      'viewed your profile',
    ])
  ) {
    return visual('profile_view', Eye, 'Melihat profil', 'Profile view', 'discovery');
  }

  if (
    includesAny(text, [
      'maps.profile_opened',
      'maps_profile_opened',
      'business.profile.viewed',
      'business_profile_viewed',
      'business viewed',
      'melihat usaha',
      'membuka profil usaha',
      'profil usaha dilihat',
    ])
  ) {
    return visual('business_view', Store, 'Profil usaha dilihat', 'Business view', 'business');
  }

  if (
    includesAny(text, [
      'maps.route_clicked',
      'maps_route_clicked',
      'route.clicked',
      'route_clicked',
      'directions',
      'rute',
      'petunjuk arah',
    ])
  ) {
    return visual('map_route', MapPin, 'Rute usaha', 'Business route', 'business');
  }

  if (
    includesAny(text, [
      'reels.viewed',
      'reels_viewed',
      'video.viewed',
      'video_viewed',
      'watch',
      'menonton video',
      'melihat reels',
    ])
  ) {
    return visual('video_view', PlayCircle, 'Video dilihat', 'Video view', 'discovery');
  }

  if (
    includesAny(text, [
      'chat.message',
      'chat_message',
      'message.created',
      'message_created',
      'new message',
      'pesan baru',
      'mengirim pesan',
      'kirim pesan',
      'chat',
    ])
  ) {
    return visual('message', MessageCircle, 'Pesan', 'Message', 'communication');
  }

  if (
    includesAny(text, [
      'recommendation',
      'recommended',
      'suggestion',
      'suggested',
      'rekomendasi',
      'disarankan',
    ])
  ) {
    return visual(
      'recommendation',
      Sparkles,
      'Rekomendasi',
      'Recommendation',
      'discovery',
    );
  }

  if (
    includesAny(text, [
      'success',
      'berhasil',
      'confirmed',
      'terkonfirmasi',
      'approved',
      'disetujui',
    ])
  ) {
    return visual('system', CircleCheck, 'Berhasil', 'Success', 'business');
  }

  if (
    includesAny(text, [
      'failed',
      'gagal',
      'cancel',
      'dibatalkan',
      'rejected',
      'ditolak',
      'error',
    ])
  ) {
    return visual('system', TriangleAlert, 'Perlu perhatian', 'Needs attention', 'danger');
  }

  if (includesAny(text, ['security', 'keamanan'])) {
    return visual('security_login', LogIn, 'Keamanan akun', 'Account security', 'attention');
  }

  // Fallback tetap memanfaatkan presentation yang sudah ada, tetapi warna dibuat netral.
  return {
    semantic: 'system',
    Icon: fallback.Icon ?? Info,
    label: fallback.label || (isId ? 'Pembaruan' : 'Update'),
    ...NOTIFICATION_STYLE.system,
  };
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
  actionHref,
  actionLabel,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)]">
        {icon}
      </div>
      <p className="mt-3 text-sm font-black tracking-[-0.01em] text-[color:var(--app-text)]">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-[280px] text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">
        {body}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] px-4 text-xs font-bold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-[color:var(--app-border)]">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex min-h-[72px] items-start gap-3 px-3 py-3">
          <div className="ui-skeleton ui-skeleton-pulse h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between gap-3">
              <div className="ui-skeleton ui-skeleton-pulse h-3 w-28 rounded-full" />
              <div className="ui-skeleton ui-skeleton-pulse h-2.5 w-12 rounded-full" />
            </div>
            <div className="ui-skeleton ui-skeleton-pulse mt-2 h-2.5 w-[88%] rounded-full" />
            <div className="ui-skeleton ui-skeleton-pulse mt-2 h-2.5 w-[58%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

type NotificationFilter = 'all' | 'unread';

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
  const [notificationFilter, setNotificationFilter] =
    useState<NotificationFilter>('all');

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
      ? 'Chat'
      : 'Messages'
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
        .slice(0, 7),
    [chatInbox.rooms],
  );

  const sortedNotifications = useMemo(
    () =>
      [...visibleNotificationItems].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [visibleNotificationItems],
  );

  const notificationPreviewItems = useMemo(() => {
    const filtered =
      notificationFilter === 'unread'
        ? sortedNotifications.filter(item => !item.is_read)
        : sortedNotifications;
    return filtered.slice(0, 8);
  }, [notificationFilter, sortedNotifications]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setNotificationFilter('all');
  }, [open]);

  const refresh = () => {
    if (isChat) {
      void chatInbox.refetch();
      return;
    }
    void notificationInbox.refetch();
  };

  const unreadCopy = isChat
    ? idLocale
      ? `${count} pesan belum dibaca`
      : `${count} unread messages`
    : idLocale
      ? `${count} belum dibaca`
      : `${count} unread`;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setOpen(previous => !previous);
          if (!open) refresh();
        }}
        className={cn(
          'ui-pressable relative inline-flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full transition sm:h-11 sm:min-h-11 sm:w-11 sm:min-w-11',
          active || open
            ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]'
            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-accent-soft)] hover:text-[color:var(--app-accent)]',
          className,
        )}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isChat ? (
          <MessageCircle className={cn('h-[18px] w-[18px]', iconClassName)} />
        ) : (
          <Bell className={cn('h-[18px] w-[18px]', iconClassName)} />
        )}

        {badge ? (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[color:var(--app-surface-strong)] bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-sm"
            aria-label={unreadCopy}
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            'ui-layer-drawer fixed inset-x-2 z-[100] overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-[0_24px_70px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/[0.03]',
            'top-[calc(var(--app-header-height,52px)+env(safe-area-inset-top)+8px)]',
            'dark:ring-white/[0.05]',
            'sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[400px]',
            menuClassName,
          )}
        >
          <span className="pointer-events-none absolute right-[17px] top-[-6px] hidden h-3 w-3 rotate-45 border-l border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] sm:block" />

          <div className="border-b border-[color:var(--app-border)] px-3 pb-2.5 pt-3 sm:px-4 sm:pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)]">
                  {title}
                </h2>
                <p
                  className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]"
                  aria-live="polite"
                >
                  {count > 0
                    ? unreadCopy
                    : idLocale
                      ? 'Tidak ada yang belum dibaca'
                      : 'You’re all caught up'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
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
                    className="ui-pressable grid h-8 w-8 place-items-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-accent)] disabled:opacity-50"
                    aria-label={
                      idLocale ? 'Tandai semua dibaca' : 'Mark all as read'
                    }
                    title={idLocale ? 'Tandai semua dibaca' : 'Mark all as read'}
                  >
                    {markingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={refresh}
                  className="ui-pressable grid h-8 w-8 place-items-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-accent)]"
                  aria-label={idLocale ? 'Muat ulang' : 'Refresh'}
                  title={idLocale ? 'Muat ulang' : 'Refresh'}
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isChat ? (
              <div
                className="mt-3 flex items-center gap-1.5"
                role="tablist"
                aria-label={idLocale ? 'Filter notifikasi' : 'Notification filter'}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={notificationFilter === 'all'}
                  onClick={() => setNotificationFilter('all')}
                  className={cn(
                    'inline-flex min-h-8 items-center justify-center rounded-full px-3 text-[11px] font-black transition',
                    notificationFilter === 'all'
                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  {idLocale ? 'Semua' : 'All'}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={notificationFilter === 'unread'}
                  onClick={() => setNotificationFilter('unread')}
                  className={cn(
                    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-black transition',
                    notificationFilter === 'unread'
                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]'
                      : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  {idLocale ? 'Belum dibaca' : 'Unread'}
                  {visibleNotificationUnreadCount > 0 ? (
                    <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-1 py-0.5 text-[9px] font-black leading-none text-[color:var(--app-text-inverse)]">
                      {compactCount(visibleNotificationUnreadCount)}
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>

          <div className="max-h-[min(520px,calc(var(--app-viewport-height,100dvh)-170px))] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            {isChat ? (
              chatInbox.loading ? (
                <LoadingRows />
              ) : sortedRooms.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle className="h-5 w-5" />}
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
                  actionHref="/chat"
                  actionLabel={idLocale ? 'Buka chat' : 'Open messages'}
                />
              ) : (
                <div className="divide-y divide-[color:var(--app-border)]">
                  {sortedRooms.map(room => {
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
                        className={cn(
                          'group flex min-h-[74px] items-start gap-3 px-3 py-3 text-left transition sm:px-4',
                          unread > 0
                            ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_62%,var(--app-surface-strong)_38%)] hover:bg-[color:var(--app-accent-soft)]'
                            : 'hover:bg-[color:var(--app-surface-muted)]',
                        )}
                      >
                        <span className="relative inline-flex h-11 w-11 shrink-0 rounded-full bg-[color:var(--app-surface-muted)] ring-1 ring-[color:var(--app-border)]">
                          <Image
                            src={avatar}
                            alt=""
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                          {unread > 0 ? (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--app-surface-strong)] bg-[color:var(--app-accent)]" />
                          ) : null}
                        </span>

                        <span className="min-w-0 flex-1 pt-0.5">
                          <span className="flex min-w-0 items-start justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-[13px] leading-5 sm:text-sm',
                                unread > 0
                                  ? 'font-black text-[color:var(--app-text)]'
                                  : 'font-bold text-[color:var(--app-text)]',
                              )}
                            >
                              {name}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 text-[10px] font-bold',
                                unread > 0
                                  ? 'text-[color:var(--app-accent)]'
                                  : 'text-[color:var(--app-text-soft)]',
                              )}
                            >
                              {formatRelativeTime(
                                toText(room.last_message_at),
                                idLocale,
                              )}
                            </span>
                          </span>

                          <span className="mt-0.5 flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-xs leading-5',
                                unread > 0
                                  ? 'font-semibold text-[color:var(--app-text)]'
                                  : 'font-medium text-[color:var(--app-text-soft)]',
                              )}
                            >
                              {roomMessage(room, idLocale)}
                            </span>

                            {unread > 0 ? (
                              <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-1.5 py-0.5 text-[9px] font-black leading-none text-[color:var(--app-text-inverse)]">
                                {compactCount(unread)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )
            ) : notificationInbox.loading ? (
              <LoadingRows />
            ) : notificationPreviewItems.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title={
                  notificationFilter === 'unread'
                    ? idLocale
                      ? 'Semua sudah dibaca'
                      : 'You’re all caught up'
                    : idLocale
                      ? 'Belum ada notifikasi'
                      : 'No notifications yet'
                }
                body={
                  notificationFilter === 'unread'
                    ? idLocale
                      ? 'Kalau ada update baru, notifikasinya akan muncul di sini.'
                      : 'New updates will appear here when they arrive.'
                    : idLocale
                      ? PROMO_ONLY_MODE
                        ? 'Update aktivitas, keamanan, dan profil usaha akan muncul di sini.'
                        : 'Update transaksi, keamanan, dan aktivitas penting akan muncul di sini.'
                      : PROMO_ONLY_MODE
                        ? 'Activity, security, and business profile updates will appear here.'
                        : 'Transaction, security, and important activity updates will appear here.'
                }
                actionHref="/notifications"
                actionLabel={idLocale ? 'Buka notifikasi' : 'Open notifications'}
              />
            ) : (
              <div className="divide-y divide-[color:var(--app-border)]">
                {notificationPreviewItems.map(item => {
                  const href = notificationHref(item);
                  const visual = resolveNotificationSemanticVisual(
                    item,
                    idLocale,
                  );
                  const Icon = visual.Icon;
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
                  const notificationMeta = summary.metaLabel;

                  return (
                    <Link
                      key={item.id}
                      href={href}
                      onClick={() => {
                        setOpen(false);
                        if (!item.is_read) {
                          void notificationInbox.markRead(item.id);
                        }
                      }}
                      className={cn(
                        'group relative flex min-h-[78px] items-start gap-3 px-3 py-3 text-left transition sm:px-4',
                        item.is_read
                          ? 'hover:bg-[color:var(--app-surface-muted)]'
                          : visual.unreadRowClassName,
                      )}
                    >
                      {!item.is_read ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-y-2 left-0 w-1 rounded-r-full',
                            visual.accentClassName,
                          )}
                        />
                      ) : null}

                      {hasSocialActor ? (
                        <span
                          className="relative mt-0.5 inline-flex h-11 w-11 shrink-0 rounded-full bg-[color:var(--app-surface-muted)] ring-1 ring-[color:var(--app-border)]"
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
                              'absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[color:var(--app-surface-strong)] shadow-md',
                              visual.badgeClassName,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 stroke-[2.6]" />
                          </span>
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-[15px] border-2 shadow-sm',
                            visual.iconClassName,
                          )}
                          aria-hidden="true"
                        >
                          <span className="sr-only">{visual.label}</span>
                          <Icon className="h-5 w-5 stroke-[2.5]" />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-start justify-between gap-2">
                          <span
                            className={cn(
                              'min-w-0 flex-1 text-[13px] leading-[18px] sm:text-sm sm:leading-5',
                              item.is_read ? 'font-bold' : 'font-black',
                              visual.titleClassName,
                            )}
                          >
                            {notificationTitle}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 pt-px text-[10px] font-bold',
                              item.is_read
                                ? 'text-[color:var(--app-text-soft)]'
                                : 'text-[color:var(--app-accent)]',
                            )}
                          >
                            {formatRelativeTime(item.created_at, idLocale)}
                          </span>
                        </span>

                        {actorHandle ? (
                          <span className="mt-0.5 block truncate text-[10px] font-semibold text-[color:var(--app-text-soft)] sm:text-[11px]">
                            {actorHandle}
                          </span>
                        ) : null}

                        {notificationBody ? (
                          <span
                            className={cn(
                              'mt-0.5 line-clamp-2 block text-[11px] leading-[17px] sm:text-xs sm:leading-5',
                              item.is_read
                                ? 'font-medium text-[color:var(--app-text-soft)]'
                                : 'font-semibold text-[color:var(--app-text)]',
                            )}
                          >
                            {notificationBody}
                          </span>
                        ) : null}

                        <span className="mt-1.5 flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex max-w-[150px] shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-black leading-4',
                              visual.labelClassName,
                            )}
                          >
                            <span className="truncate">{visual.label}</span>
                          </span>

                          {notificationMeta ? (
                            <span className="min-w-0 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                              {notificationMeta}
                            </span>
                          ) : null}

                          {!item.is_read ? (
                            <span
                              className={cn(
                                'ml-auto h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[color:var(--app-surface-strong)]',
                                visual.accentClassName,
                              )}
                              aria-label={idLocale ? 'Belum dibaca' : 'Unread'}
                            />
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2">
            <Link
              href={fullHref}
              onClick={() => setOpen(false)}
              className="ui-pressable flex min-h-10 items-center justify-center gap-1.5 rounded-[12px] text-xs font-black text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)]"
            >
              {isChat
                ? idLocale
                  ? 'Lihat semua chat'
                  : 'View all messages'
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