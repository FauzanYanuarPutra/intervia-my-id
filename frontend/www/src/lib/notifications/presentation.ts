import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CircleAlert,
  Clock3,
  CreditCard,
  Handshake,
  Info,
  PackageCheck,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

type NotificationPresentationInput = {
  category?: string | null;
  eventType?: string | null;
  title?: string | null;
  message?: string | null;
};

export type NotificationPresentation = {
  Icon: LucideIcon;
  label: string;
  accentClassName: string;
  badgeClassName: string;
  iconClassName: string;
  surfaceClassName: string;
  titleClassName: string;
};

const neutralTone: NotificationPresentation = {
  Icon: Info,
  label: 'Update',
  accentClassName: 'bg-slate-400',
  badgeClassName:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70',
  iconClassName:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70',
  surfaceClassName:
    'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)]',
  titleClassName: 'text-[color:var(--app-text)]',
};

function makeTone(
  base: Omit<NotificationPresentation, 'badgeClassName'> & {
    badgeClassName?: string;
  },
): NotificationPresentation {
  return {
    ...base,
    badgeClassName: base.badgeClassName ?? base.iconClassName,
  };
}

function cleanText(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function has(source: string, ...needles: string[]): boolean {
  return needles.some(needle => source.includes(needle));
}

export function notificationPresentation({
  category,
  eventType,
  title,
  message,
}: NotificationPresentationInput): NotificationPresentation {
  const cat = cleanText(category);
  const event = cleanText(eventType);
  const text = `${cat} ${event} ${cleanText(title)} ${cleanText(message)}`;

  if (has(text, 'security', 'login', 'otp', 'fraud', 'device')) {
    return makeTone({
      Icon: ShieldAlert,
      label: 'Keamanan',
      accentClassName: 'bg-rose-500',
      iconClassName:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/12 dark:text-rose-100',
      surfaceClassName:
        'border-rose-200/80 bg-[linear-gradient(135deg,#fff7f7_0%,#ffffff_65%,#fff1f2_100%)] dark:border-rose-400/20 dark:bg-rose-400/10',
      titleClassName: 'text-rose-700 dark:text-rose-100',
    });
  }

  if (
    has(
      text,
      'failed',
      'gagal',
      'rejected',
      'dibatalkan',
      'cancelled',
      'expired',
      'kedaluwarsa',
    )
  ) {
    return makeTone({
      Icon: XCircle,
      label: has(text, 'expired', 'kedaluwarsa') ? 'Kedaluwarsa' : 'Gagal',
      accentClassName: 'bg-rose-500',
      iconClassName:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/12 dark:text-rose-100',
      surfaceClassName:
        'border-rose-200/80 bg-[linear-gradient(135deg,#fff7f7_0%,#ffffff_68%,#fff1f2_100%)] dark:border-rose-400/20 dark:bg-rose-400/10',
      titleClassName: 'text-rose-700 dark:text-rose-100',
    });
  }

  if (has(text, 'pending', 'menunggu', 'nunggu')) {
    return makeTone({
      Icon: Clock3,
      label: 'Menunggu',
      accentClassName: 'bg-amber-500',
      iconClassName:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/12 dark:text-amber-100',
      surfaceClassName:
        'border-amber-200/80 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_64%,#fffbeb_100%)] dark:border-amber-400/20 dark:bg-amber-400/10',
      titleClassName: 'text-amber-800 dark:text-amber-100',
    });
  }

  if (has(text, 'refund', 'dikembalikan')) {
    return makeTone({
      Icon: RefreshCcw,
      label: 'Refund',
      accentClassName: 'bg-cyan-500',
      iconClassName:
        'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/12 dark:text-cyan-100',
      surfaceClassName:
        'border-cyan-200/80 bg-[linear-gradient(135deg,#f0fdff_0%,#ffffff_64%,#ecfeff_100%)] dark:border-cyan-400/20 dark:bg-cyan-400/10',
      titleClassName: 'text-cyan-800 dark:text-cyan-100',
    });
  }

  if (has(text, 'topup', 'top-up', 'deposit', 'cash_in')) {
    return makeTone({
      Icon: ArrowDownToLine,
      label: 'Top-up',
      accentClassName: 'bg-emerald-500',
      iconClassName:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-100',
      surfaceClassName:
        'border-emerald-200/80 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_64%,#ecfdf5_100%)] dark:border-emerald-400/20 dark:bg-emerald-400/10',
      titleClassName: 'text-emerald-800 dark:text-emerald-100',
    });
  }

  if (
    has(
      text,
      'payment_released',
      'payout',
      'withdraw',
      'saldo masuk',
      'dana masuk',
    )
  ) {
    return makeTone({
      Icon: ArrowUpRight,
      label: 'Saldo masuk',
      accentClassName: 'bg-teal-500',
      iconClassName:
        'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/20 dark:bg-teal-400/12 dark:text-teal-100',
      surfaceClassName:
        'border-teal-200/80 bg-[linear-gradient(135deg,#f0fdfa_0%,#ffffff_64%,#ccfbf1_100%)] dark:border-teal-400/20 dark:bg-teal-400/10',
      titleClassName: 'text-teal-800 dark:text-teal-100',
    });
  }

  if (has(text, 'payment_confirmed', 'buyer_funded', 'funded', 'pembayaran')) {
    return makeTone({
      Icon: CreditCard,
      label: 'Pembayaran',
      accentClassName: 'bg-sky-500',
      iconClassName:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/12 dark:text-sky-100',
      surfaceClassName:
        'border-sky-200/80 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_64%,#eff6ff_100%)] dark:border-sky-400/20 dark:bg-sky-400/10',
      titleClassName: 'text-sky-800 dark:text-sky-100',
    });
  }

  if (has(text, 'offer', 'counter', 'tawaran')) {
    return makeTone({
      Icon: Handshake,
      label: 'Tawaran',
      accentClassName: 'bg-amber-500',
      iconClassName:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/12 dark:text-amber-100',
      surfaceClassName:
        'border-amber-200/80 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_64%,#fffbeb_100%)] dark:border-amber-400/20 dark:bg-amber-400/10',
      titleClassName: 'text-amber-800 dark:text-amber-100',
    });
  }

  if (has(text, 'delivered', 'dikirim', 'pengiriman', 'pesanan')) {
    return makeTone({
      Icon: Truck,
      label: 'Dikirim',
      accentClassName: 'bg-indigo-500',
      iconClassName:
        'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/12 dark:text-indigo-100',
      surfaceClassName:
        'border-indigo-200/80 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_64%,#eef2ff_100%)] dark:border-indigo-400/20 dark:bg-indigo-400/10',
      titleClassName: 'text-indigo-800 dark:text-indigo-100',
    });
  }

  if (
    has(text, 'accepted', 'completed', 'selesai', 'berhasil', 'success', 'paid')
  ) {
    return makeTone({
      Icon: BadgeCheck,
      label: 'Berhasil',
      accentClassName: 'bg-emerald-500',
      iconClassName:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-100',
      surfaceClassName:
        'border-emerald-200/80 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_64%,#ecfdf5_100%)] dark:border-emerald-400/20 dark:bg-emerald-400/10',
      titleClassName: 'text-emerald-800 dark:text-emerald-100',
    });
  }

  if (has(text, 'in_progress', 'proses', 'pengerjaan')) {
    return makeTone({
      Icon: PackageCheck,
      label: 'Diproses',
      accentClassName: 'bg-violet-500',
      iconClassName:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/12 dark:text-violet-100',
      surfaceClassName:
        'border-violet-200/80 bg-[linear-gradient(135deg,#f5f3ff_0%,#ffffff_64%,#f5f3ff_100%)] dark:border-violet-400/20 dark:bg-violet-400/10',
      titleClassName: 'text-violet-800 dark:text-violet-100',
    });
  }

  if (has(text, 'dispute', 'sengketa', 'support')) {
    return makeTone({
      Icon: CircleAlert,
      label: 'Bantuan',
      accentClassName: 'bg-orange-500',
      iconClassName:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/12 dark:text-orange-100',
      surfaceClassName:
        'border-orange-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_64%,#ffedd5_100%)] dark:border-orange-400/20 dark:bg-orange-400/10',
      titleClassName: 'text-orange-800 dark:text-orange-100',
    });
  }

  if (cat === 'wallet') {
    return makeTone({
      Icon: Wallet,
      label: 'Wallet',
      accentClassName: 'bg-emerald-500',
      iconClassName:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-100',
      surfaceClassName:
        'border-emerald-200/80 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_64%,#ecfdf5_100%)] dark:border-emerald-400/20 dark:bg-emerald-400/10',
      titleClassName: 'text-emerald-800 dark:text-emerald-100',
    });
  }

  if (cat === 'transaction') {
    return makeTone({
      Icon: CreditCard,
      label: 'Transaksi',
      accentClassName: 'bg-sky-500',
      iconClassName:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/12 dark:text-sky-100',
      surfaceClassName:
        'border-sky-200/80 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_64%,#eff6ff_100%)] dark:border-sky-400/20 dark:bg-sky-400/10',
      titleClassName: 'text-sky-800 dark:text-sky-100',
    });
  }

  if (cat === 'security') {
    return makeTone({
      Icon: ShieldCheck,
      label: 'Keamanan',
      accentClassName: 'bg-rose-500',
      iconClassName:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/12 dark:text-rose-100',
      surfaceClassName:
        'border-rose-200/80 bg-[linear-gradient(135deg,#fff7f7_0%,#ffffff_65%,#fff1f2_100%)] dark:border-rose-400/20 dark:bg-rose-400/10',
      titleClassName: 'text-rose-700 dark:text-rose-100',
    });
  }

  if (cat === 'support') {
    return makeTone({
      Icon: CircleAlert,
      label: 'Bantuan',
      accentClassName: 'bg-orange-500',
      iconClassName:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/12 dark:text-orange-100',
      surfaceClassName:
        'border-orange-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_64%,#ffedd5_100%)] dark:border-orange-400/20 dark:bg-orange-400/10',
      titleClassName: 'text-orange-800 dark:text-orange-100',
    });
  }

  if (cat === 'system') {
    return makeTone({
      Icon: Bell,
      label: 'Sistem',
      accentClassName: 'bg-slate-500',
      iconClassName:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70',
      surfaceClassName:
        'border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_64%,#f1f5f9_100%)] dark:border-white/10 dark:bg-white/[0.08]',
      titleClassName: 'text-slate-800 dark:text-white',
    });
  }

  return neutralTone;
}
