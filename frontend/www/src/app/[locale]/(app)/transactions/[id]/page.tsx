'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { TransactionPageSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { useAuth } from '@/context/AuthContext';
import {
  getLatestDeliverySubmission,
  parseTransactionDelivery,
} from '@/lib/transactionDelivery';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  Clock4,
  CreditCard,
  ExternalLink,
  Handshake,
  Rocket,
  Shield,
  Truck,
} from 'lucide-react';

type Transaction = {
  id: string;
  content_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  protection_status?: string;
  deal_kind?: string;
  fulfillment_mode?: string;
  transaction_meta?: Record<string, unknown>;
  snapshot_listing?: Record<string, unknown>;
  safety_checklist?: Record<string, unknown>;
  risk_flags?: string[];
  offer_message?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
};

type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type DetailChipConfig = {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: ChipTone;
};

type QuickAction = {
  href: string;
  label: string;
  tone: 'primary' | 'secondary';
  Icon: React.ComponentType<{ className?: string }>;
};

type TimelineItem = {
  id: string;
  title: string;
  note: string;
  at: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeId(value: unknown): string {
  return asString(value).toLowerCase();
}

function humanize(value: string): string {
  const raw = asString(value);
  if (!raw) return '-';
  return raw
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveTxnStatus(txn: Transaction): string {
  const raw =
    txn.status ||
    (txn as unknown as { transaction_status?: string }).transaction_status;
  return asString(raw || 'pending').toLowerCase();
}

function readTransactionMeta(txn: Transaction): Record<string, unknown> {
  return asObject(txn.transaction_meta);
}

function resolvePaymentStatus(txn: Transaction): string {
  const meta = readTransactionMeta(txn);
  const payment = asObject(meta.payment);
  const raw = asString(payment.status).toLowerCase();
  if (raw) return raw;

  const protection = asString(txn.protection_status).toLowerCase();
  if (
    protection === 'funds_held' ||
    protection === 'on_hold' ||
    protection === 'escrow_released'
  ) {
    return 'paid';
  }
  return 'awaiting_payment';
}

function resolveSnapshot(txn: Transaction): { title: string; image: string } {
  const snapshot = asObject(txn.snapshot_listing);
  return {
    title: asString(snapshot.title) || 'Transaksi',
    image: asString(snapshot.cover_image),
  };
}

function isTransactionPaymentReady(txn: Transaction): boolean {
  const paymentStatus = resolvePaymentStatus(txn);
  const protectionStatus = asString(txn.protection_status).toLowerCase();
  return (
    paymentStatus === 'paid' ||
    protectionStatus === 'funds_held' ||
    protectionStatus === 'on_hold'
  );
}

function canUserOpenPayment(txn: Transaction, userId?: string | null): boolean {
  const status = resolveTxnStatus(txn);
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  return (
    isBuyer &&
    (status === 'pending' || status === 'accepted') &&
    !isTransactionPaymentReady(txn)
  );
}

function formatShortOrderId(id: string): string {
  const raw = asString(id);
  if (raw.length <= 16) return raw || '-';
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function formatPrice(
  cents: number,
  currency: string,
  locale: string,
): string {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency || 'IDR'} ${amount.toLocaleString()}`;
  }
}

function formatDateTime(value: string, locale: string): string {
  const text = asString(value);
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveRoleLabel(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): string {
  if (userId && normalizeId(txn.buyer_id) === normalizeId(userId)) {
    return locale === 'id' ? 'Pembeli' : 'Buyer';
  }
  if (userId && normalizeId(txn.seller_id) === normalizeId(userId)) {
    return locale === 'id' ? 'Penjual' : 'Seller';
  }
  return locale === 'id' ? 'Peserta' : 'Participant';
}

function resolveNextStep(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): string {
  const status = resolveTxnStatus(txn);
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  const isSeller = Boolean(
    userId && normalizeId(txn.seller_id) === normalizeId(userId),
  );
  const paymentReady = isTransactionPaymentReady(txn);

  if (status === 'pending') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Bayar dulu supaya seller bisa memproses order.'
        : 'Pay first so the seller can process the order.';
    }
    if (isSeller && paymentReady) {
      return locale === 'id'
        ? 'Dana sudah aman. Tinggal terima atau tolak order.'
        : 'Funds are secured. Accept or decline the order.';
    }
    return locale === 'id'
      ? 'Cek ringkasannya lalu putuskan lanjut atau tidak.'
      : 'Check the summary, then decide whether to continue.';
  }

  if (status === 'accepted') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Seller sudah setuju. Tinggal selesaikan pembayaran.'
        : 'The seller accepted. Complete the payment.';
    }
    if (isSeller) {
      return locale === 'id'
        ? 'Order siap dimulai.'
        : 'The order is ready to start.';
    }
    return locale === 'id'
      ? 'Lanjutkan koordinasi di chat.'
      : 'Continue the coordination in chat.';
  }

  if (status === 'in_progress') {
    return isSeller
      ? locale === 'id'
        ? 'Kirim hasil saat pekerjaan sudah siap.'
        : 'Submit the result once the work is ready.'
      : locale === 'id'
        ? 'Pantau progres dan tunggu hasilnya.'
        : 'Track the progress and wait for the result.';
  }

  if (status === 'delivered') {
    return locale === 'id'
      ? 'Cek hasilnya, lalu terima atau minta revisi.'
      : 'Review the result, then accept it or request a revision.';
  }

  if (status === 'completed') {
    return locale === 'id'
      ? 'Transaksi sudah selesai. Kalau perlu, beri ulasan.'
      : 'The transaction is complete. Leave a review if needed.';
  }

  if (status === 'disputed') {
    return locale === 'id'
      ? 'Support sedang meninjau masalah ini.'
      : 'Support is reviewing this issue.';
  }

  if (status === 'cancelled') {
    return locale === 'id'
      ? 'Transaksi ini sudah dibatalkan.'
      : 'This transaction was cancelled.';
  }

  return locale === 'id'
    ? 'Lanjutkan dari langkah berikutnya.'
    : 'Continue from the next step.';
}

function statusChip(status: string, locale: string): DetailChipConfig {
  switch (status) {
    case 'pending':
      return {
        Icon: Clock4,
        label: locale === 'id' ? 'Menunggu' : 'Pending',
        tone: 'warning',
      };
    case 'accepted':
      return {
        Icon: Handshake,
        label: locale === 'id' ? 'Disetujui' : 'Accepted',
        tone: 'info',
      };
    case 'in_progress':
      return {
        Icon: Rocket,
        label: locale === 'id' ? 'Berjalan' : 'In progress',
        tone: 'info',
      };
    case 'delivered':
      return {
        Icon: Truck,
        label: locale === 'id' ? 'Sudah dikirim' : 'Delivered',
        tone: 'success',
      };
    case 'completed':
      return {
        Icon: CheckCircle2,
        label: locale === 'id' ? 'Selesai' : 'Completed',
        tone: 'success',
      };
    case 'cancelled':
      return {
        Icon: Ban,
        label: locale === 'id' ? 'Dibatalkan' : 'Cancelled',
        tone: 'danger',
      };
    case 'disputed':
      return {
        Icon: AlertTriangle,
        label: locale === 'id' ? 'Bermasalah' : 'Disputed',
        tone: 'warning',
      };
    default:
      return {
        Icon: Shield,
        label: humanize(status),
        tone: 'neutral',
      };
  }
}

function fundsChip(txn: Transaction, locale: string): DetailChipConfig {
  const protection = asString(txn.protection_status).toLowerCase();
  if (protection === 'refunded') {
    return {
      Icon: BadgeDollarSign,
      label: locale === 'id' ? 'Dana kembali' : 'Refunded',
      tone: 'warning',
    };
  }
  if (protection === 'escrow_released') {
    return {
      Icon: BadgeDollarSign,
      label: locale === 'id' ? 'Dana diteruskan' : 'Paid out',
      tone: 'success',
    };
  }
  if (isTransactionPaymentReady(txn)) {
    return {
      Icon: Shield,
      label: locale === 'id' ? 'Dana aman' : 'Funds secured',
      tone: 'info',
    };
  }
  return {
    Icon: CreditCard,
    label: locale === 'id' ? 'Belum dibayar' : 'Awaiting payment',
    tone: 'neutral',
  };
}

function paymentChip(txn: Transaction, locale: string): DetailChipConfig {
  const payment = resolvePaymentStatus(txn);
  if (payment === 'paid') {
    return {
      Icon: CreditCard,
      label: locale === 'id' ? 'Pembayaran masuk' : 'Paid',
      tone: 'success',
    };
  }
  if (payment === 'partial') {
    return {
      Icon: CreditCard,
      label: locale === 'id' ? 'Bayar sebagian' : 'Partial payment',
      tone: 'warning',
    };
  }
  if (payment === 'hold_error') {
    return {
      Icon: AlertTriangle,
      label: locale === 'id' ? 'Pembayaran bermasalah' : 'Payment issue',
      tone: 'danger',
    };
  }
  return {
    Icon: CreditCard,
    label: locale === 'id' ? 'Menunggu bayar' : 'Awaiting payment',
    tone: 'neutral',
  };
}

function buildTimeline(txn: Transaction, locale: string): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: 'created',
      title: locale === 'id' ? 'Order dibuat' : 'Order created',
      note:
        locale === 'id'
          ? 'Transaksi mulai dibuat.'
          : 'The transaction was created.',
      at: asString(txn.created_at),
    },
    {
      id: 'payment',
      title:
        resolvePaymentStatus(txn) === 'paid'
          ? locale === 'id'
            ? 'Pembayaran masuk'
            : 'Payment confirmed'
          : locale === 'id'
            ? 'Menunggu pembayaran'
            : 'Awaiting payment',
      note:
        resolvePaymentStatus(txn) === 'paid'
          ? locale === 'id'
            ? 'Dana sudah masuk proteksi transaksi.'
            : 'Funds are secured for this transaction.'
          : locale === 'id'
            ? 'Pembayaran belum selesai.'
            : 'Payment is not complete yet.',
      at: asString(txn.updated_at || txn.created_at),
    },
    {
      id: 'status',
      title: locale === 'id' ? 'Status terakhir' : 'Latest status',
      note: humanize(resolveTxnStatus(txn)),
      at: asString(txn.updated_at || txn.created_at),
    },
  ];

  const latestDelivery = getLatestDeliverySubmission(txn.transaction_meta);
  if (latestDelivery) {
    items.push({
      id: 'delivery',
      title:
        locale === 'id'
          ? `Pengiriman ke-${latestDelivery.attemptNumber || 1}`
          : `Delivery #${latestDelivery.attemptNumber || 1}`,
      note:
        latestDelivery.title ||
        latestDelivery.note ||
        (locale === 'id'
          ? 'Seller mengirim hasil terbaru.'
          : 'The seller submitted the latest result.'),
      at: asString(latestDelivery.submittedAt || txn.updated_at),
    });
  }

  return items.filter(item => item.at);
}

function resolveQuickActions(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): QuickAction[] {
  const status = resolveTxnStatus(txn);
  const encodedId = encodeURIComponent(txn.id);
  const baseFocusHref = `/transactions?focus_transaction_id=${encodedId}`;
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  const isSeller = Boolean(
    userId && normalizeId(txn.seller_id) === normalizeId(userId),
  );

  const actions: QuickAction[] = [
    {
      href: baseFocusHref,
      label: locale === 'id' ? 'Kembali ke daftar' : 'Back to list',
      tone: 'secondary',
      Icon: ArrowLeft,
    },
  ];

  if (canUserOpenPayment(txn, userId)) {
    actions.push({
      href: `${baseFocusHref}&open_payment=1`,
      label: locale === 'id' ? 'Bayar sekarang' : 'Pay now',
      tone: 'primary',
      Icon: CreditCard,
    });
  } else if (isSeller && status === 'in_progress') {
    actions.push({
      href: `${baseFocusHref}&delivery_action=deliver`,
      label: locale === 'id' ? 'Kirim hasil' : 'Submit result',
      tone: 'primary',
      Icon: Truck,
    });
  } else if (isBuyer && status === 'delivered') {
    actions.push({
      href: `${baseFocusHref}&delivery_action=review_accept`,
      label: locale === 'id' ? 'Tinjau hasil' : 'Review result',
      tone: 'primary',
      Icon: CheckCircle2,
    });
  } else if (status === 'completed') {
    actions.push({
      href: `/transactions/${encodedId}/review`,
      label: locale === 'id' ? 'Beri ulasan' : 'Leave review',
      tone: 'primary',
      Icon: CheckCircle2,
    });
  }

  actions.push({
    href: `/content/${txn.content_id}`,
    label: locale === 'id' ? 'Lihat listing' : 'View listing',
    tone: 'secondary',
    Icon: ExternalLink,
  });

  if (status === 'disputed') {
    actions.push({
      href: '/support',
      label: locale === 'id' ? 'Hubungi support' : 'Contact support',
      tone: 'secondary',
      Icon: AlertTriangle,
    });
  }

  return actions.slice(0, 4);
}

function chipToneClass(tone: ChipTone): string {
  switch (tone) {
    case 'info':
      return 'border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] text-[color:var(--app-info)]';
    case 'success':
      return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]';
    case 'warning':
      return 'border-[color:var(--app-warning-border)] bg-[color:color-mix(in_srgb,_var(--app-warning)_12%,_transparent)] text-[color:var(--app-warning)]';
    case 'danger':
      return 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]';
    case 'neutral':
    default:
      return 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]';
  }
}

function DetailChip({ chip }: { chip: DetailChipConfig }) {
  const Icon = chip.Icon;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${chipToneClass(chip.tone)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {chip.label}
    </span>
  );
}

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = useLocale() || 'id';
  const { user, authFetch, loading: authLoading } = useAuth();
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(result => setTransactionId(result.id));
  }, [params]);

  useEffect(() => {
    if (!transactionId || authLoading) return;

    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await authFetch(`/api/transactions/${transactionId}`);
        const payload = (await res.json().catch(() => ({}))) as
          | Transaction
          | { error?: string };

        if (!active) return;

        if (!res.ok) {
          throw new Error(
            asString((payload as { error?: string }).error) ||
              (locale === 'id'
                ? 'Gagal memuat detail transaksi.'
                : 'Failed to load transaction details.'),
          );
        }

        setTransaction(payload as Transaction);
      } catch (fetchError) {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : locale === 'id'
              ? 'Gagal memuat detail transaksi.'
              : 'Failed to load transaction details.',
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authFetch, authLoading, locale, transactionId]);

  const computed = useMemo(() => {
    if (!transaction) return null;

    const status = resolveTxnStatus(transaction);
    const paymentStatus = resolvePaymentStatus(transaction);
    const deliveryState = parseTransactionDelivery(transaction.transaction_meta);
    const latestDelivery = getLatestDeliverySubmission(transaction.transaction_meta);
    const roleLabel = resolveRoleLabel(transaction, user?.id, locale);
    const nextStep = resolveNextStep(transaction, user?.id, locale);
    const actions = resolveQuickActions(transaction, user?.id, locale);
    const timeline = buildTimeline(transaction, locale);
    const chips = [
      statusChip(status, locale),
      fundsChip(transaction, locale),
      paymentChip(transaction, locale),
    ];
    const notes = [
      {
        key: 'offer',
        label: locale === 'id' ? 'Pesan awal' : 'Initial note',
        value: asString(transaction.offer_message),
      },
      {
        key: 'response',
        label: locale === 'id' ? 'Balasan' : 'Reply',
        value: asString(transaction.response_message),
      },
    ].filter(item => item.value);

    const simpleFacts = [
      {
        label: locale === 'id' ? 'Nomor order' : 'Order ID',
        value: formatShortOrderId(transaction.id),
      },
      {
        label: locale === 'id' ? 'Peran kamu' : 'Your role',
        value: roleLabel,
      },
      {
        label: locale === 'id' ? 'Dibuat' : 'Created',
        value: formatDateTime(transaction.created_at, locale),
      },
      {
        label: locale === 'id' ? 'Diupdate' : 'Updated',
        value: formatDateTime(transaction.updated_at, locale),
      },
    ];

    const extraFacts = [
      {
        label: locale === 'id' ? 'Jenis transaksi' : 'Deal type',
        value: humanize(transaction.deal_kind || ''),
      },
      {
        label: locale === 'id' ? 'Model pengerjaan' : 'Fulfillment',
        value: humanize(transaction.fulfillment_mode || ''),
      },
      {
        label: locale === 'id' ? 'Proteksi dana' : 'Protection',
        value: humanize(transaction.protection_status || ''),
      },
      {
        label: locale === 'id' ? 'Pembayaran' : 'Payment',
        value: humanize(paymentStatus),
      },
    ].filter(item => item.value && item.value !== '-');

    return {
      actions,
      chips,
      deliveryState,
      extraFacts,
      latestDelivery,
      nextStep,
      notes,
      simpleFacts,
      snapshot: resolveSnapshot(transaction),
      timeline,
    };
  }, [locale, transaction, user?.id]);

  if (authLoading || loading) {
    return <TransactionPageSkeleton />;
  }

  if (!transaction || !computed) {
    return (
      <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="mx-auto w-full max-w-3xl px-0 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-6">
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)]"
            >
              <ArrowLeft className="h-4 w-4" />
              {locale === 'id' ? 'Kembali ke transaksi' : 'Back to transactions'}
            </Link>
            <div className="mt-4 rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-4 text-sm text-[color:var(--app-danger)]">
              {error ||
                (locale === 'id'
                  ? 'Detail transaksi tidak ditemukan.'
                  : 'Transaction details were not found.')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { snapshot } = computed;

  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-3xl px-0 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="space-y-4">
          <section className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-6">
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)]"
            >
              <ArrowLeft className="h-4 w-4" />
              {locale === 'id' ? 'Kembali ke transaksi' : 'Back to transactions'}
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                  {locale === 'id' ? 'Detail transaksi' : 'Transaction details'}
                </p>
                <h1 className="mt-2 text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
                  {snapshot.title}
                </h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {computed.chips.map(chip => (
                    <DetailChip
                      key={`${transaction.id}-${chip.label}`}
                      chip={chip}
                    />
                  ))}
                </div>
              </div>

              <div className="min-w-[140px] rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                  {locale === 'id' ? 'Nominal' : 'Amount'}
                </p>
                <p className="mt-1 text-lg font-black text-[color:var(--app-accent)]">
                  {formatPrice(transaction.amount_cents, transaction.currency, locale)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-muted)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Langkah berikutnya' : 'Next step'}
              </p>
              <p className="mt-1 text-sm font-medium text-[color:var(--app-text)]">
                {computed.nextStep}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {computed.actions.map(action => (
                <Link
                  key={`${transaction.id}-${action.label}`}
                  href={action.href}
                  className={`inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition ${
                    action.tone === 'primary'
                      ? 'border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]'
                      : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]'
                  }`}
                >
                  <action.Icon className="h-4 w-4" />
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-5">
              <h2 className="text-sm font-bold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Ringkasan' : 'Summary'}
              </h2>
              <div className="mt-4 grid gap-3">
                {computed.simpleFacts.map(item => (
                  <div
                    key={`${transaction.id}-${item.label}`}
                    className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] px-3 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-5">
              <h2 className="text-sm font-bold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Info tambahan' : 'Extra info'}
              </h2>
              <div className="mt-4 grid gap-3">
                {computed.extraFacts.length > 0 ? (
                  computed.extraFacts.map(item => (
                    <div
                      key={`${transaction.id}-${item.label}`}
                      className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] px-3 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                        {item.value}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] px-3 py-4 text-sm text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                    {locale === 'id'
                      ? 'Belum ada info tambahan untuk transaksi ini.'
                      : 'There is no extra info for this transaction yet.'}
                  </div>
                )}
              </div>
            </div>
          </section>

          {computed.notes.length > 0 ? (
            <section className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-5">
              <h2 className="text-sm font-bold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Catatan order' : 'Order notes'}
              </h2>
              <div className="mt-4 grid gap-3">
                {computed.notes.map(note => (
                  <div
                    key={`${transaction.id}-${note.key}`}
                    className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                      {note.label}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--app-text)]">
                      {note.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(computed.latestDelivery || computed.deliveryState.attemptsUsed > 0) ? (
            <section className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-5">
              <h2 className="text-sm font-bold text-[color:var(--app-text)]">
                {locale === 'id' ? 'Update pengiriman' : 'Delivery update'}
              </h2>
              <div className="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">
                      {computed.latestDelivery?.title ||
                        (locale === 'id'
                          ? `Pengiriman ke-${Math.max(1, computed.deliveryState.attemptsUsed)}`
                          : `Delivery #${Math.max(1, computed.deliveryState.attemptsUsed)}`)}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                      {computed.latestDelivery?.note ||
                        (locale === 'id'
                          ? 'Belum ada catatan rinci, tapi sistem sudah mencatat update pengiriman.'
                          : 'There is no detailed note yet, but the system has recorded a delivery update.')}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[color:var(--app-text-soft)]">
                    <p>
                      {locale === 'id' ? 'Percobaan' : 'Attempt'}:{' '}
                      {computed.latestDelivery?.attemptNumber ||
                        computed.deliveryState.attemptsUsed}
                      /{computed.deliveryState.maxAttempts}
                    </p>
                    <p className="mt-1">
                      {locale === 'id' ? 'Bukti/link' : 'Proof / links'}:{' '}
                      {computed.latestDelivery?.attachments.length || 0}
                    </p>
                  </div>
                </div>

                {computed.latestDelivery?.buyerFeedbackNote ? (
                  <div className="mt-3 rounded-2xl border border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-3 py-3 text-sm text-[color:var(--app-info)]">
                    <p className="font-semibold">
                      {locale === 'id'
                        ? 'Catatan buyer'
                        : 'Buyer feedback'}
                    </p>
                    <p className="mt-1">
                      {computed.latestDelivery.buyerFeedbackNote}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-5 sm:rounded-3xl sm:border-x sm:px-5">
            <h2 className="text-sm font-bold text-[color:var(--app-text)]">
              {locale === 'id' ? 'Riwayat singkat' : 'Short timeline'}
            </h2>
            <div className="mt-4 space-y-3">
              {computed.timeline.map(item => (
                <div
                  key={`${transaction.id}-${item.id}`}
                  className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--app-text)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                        {item.note}
                      </p>
                    </div>
                    <p className="text-xs text-[color:var(--app-text-soft)]">
                      {formatDateTime(item.at, locale)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
