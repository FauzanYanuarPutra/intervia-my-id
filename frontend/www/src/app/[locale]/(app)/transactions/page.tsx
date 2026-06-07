'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { Modal } from '@/components/common/Modal';
import { TransactionVerificationPromptModal } from '@/components/verification/TransactionVerificationPromptModal';
import { TransactionPageSkeleton } from '@/components/system/feedback/RouteSkeletons';
import {
  getLatestDeliverySubmission,
  parseTransactionDelivery,
} from '@/lib/transactionDelivery';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readTransactionVerification,
  type TransactionVerificationState,
} from '@/lib/identityVerification';
import { profileAvatarSrc } from '@/lib/profile/avatar';
import {
  AlertTriangle,
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  Clock4,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Handshake,
  Loader2,
  MessageSquareText,
  Package,
  RefreshCcw,
  Rocket,
  Shield,
  ShieldCheck,
  Truck,
  Wallet,
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

type WalletEnvironment = 'development' | 'live';

type WalletAccount = {
  id: string;
  environment: WalletEnvironment;
  currency: string;
  available_balance_cents: number;
  held_balance_cents: number;
  total_balance_cents: number;
  total_topup_cents: number;
  total_spend_cents: number;
  status: string;
  metadata: Record<string, unknown>;
  updated_at: string;
};

type WalletBalancesResponse = {
  accounts: WalletAccount[];
  default_environment: WalletEnvironment;
  live_enabled: boolean;
  provider_default: string;
  generated_at: string;
};

type RewardBalanceResponse = {
  balance?: {
    coin_balance?: number;
    xp_balance?: number;
    voucher_count?: number;
  };
  weekly?: {
    days_claimed?: number;
    days_remaining?: number;
    next_reset_at?: string;
  };
  claimed_today?: boolean;
  can_claim_today?: boolean;
  payment?: {
    coin_value_cents?: number;
    max_discount_bps?: number;
    max_discount_ratio?: number;
    min_cash_payment_cents?: number;
    currency?: string;
  };
  error?: string;
};

type PaymentOption = {
  id: string;
  title: string;
  description: string;
  provider: string;
  method?: string;
  image: string;
  badge: string;
  usesWalletBalance?: boolean;
};

type WalletTopupLite = {
  id: string;
  status: string;
  payment_provider?: string;
  payment_method?: string | null;
  checkout_url?: string | null;
  payment_payload?: Record<string, unknown>;
  environment?: WalletEnvironment;
  amount_cents?: number;
  currency?: string;
};

type CreateTopupResponse = {
  error?: string;
  topup?: WalletTopupLite;
  reused_pending_topup?: boolean;
};

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'qris',
    title: 'QRIS',
    description: 'Scan QR dari semua e-wallet / m-banking',
    provider: 'midtrans',
    method: 'qris',
    image: '/images/payments/qris.svg',
    badge: 'Realtime',
  },
  {
    id: 'gopay',
    title: 'GoPay',
    description: 'Bayar instan dari aplikasi GoPay',
    provider: 'midtrans',
    method: 'gopay',
    image: '/images/payments/gopay.svg',
    badge: 'E-Wallet',
  },
  {
    id: 'shopeepay',
    title: 'ShopeePay',
    description: 'Bayar instan dari aplikasi ShopeePay',
    provider: 'midtrans',
    method: 'shopeepay',
    image: '/images/payments/qris.svg',
    badge: 'E-Wallet',
  },
  {
    id: 'bca_va',
    title: 'BCA Virtual Account',
    description: 'Transfer via BCA mobile, ATM, iBanking',
    provider: 'midtrans',
    method: 'bca_va',
    image: '/images/payments/bca-va.svg',
    badge: 'Bank VA',
  },
  {
    id: 'bank_transfer',
    title: 'Bank Transfer',
    description: 'VA Mix: Mandiri/BNI/BRI/Permata',
    provider: 'midtrans',
    method: 'bank_transfer',
    image: '/images/payments/bank-transfer.svg',
    badge: 'Flexible',
  },
  {
    id: 'mandiri_va',
    title: 'Mandiri Bill / VA',
    description: 'Bayar via Livin Mandiri atau ATM',
    provider: 'midtrans',
    method: 'mandiri_va',
    image: '/images/payments/bank-transfer.svg',
    badge: 'Bank VA',
  },
  {
    id: 'cimb_va',
    title: 'CIMB VA',
    description: 'Transfer via CIMB OCTO Mobile/ATM',
    provider: 'midtrans',
    method: 'cimb_va',
    image: '/images/payments/bank-transfer.svg',
    badge: 'Bank VA',
  },
  {
    id: 'mock_fast',
    title: 'Mock Fast (Dev)',
    description: 'Simulasi cepat untuk testing development',
    provider: 'mock',
    method: 'mock',
    image: '/images/payments/mock-wallet.svg',
    badge: 'Sandbox',
  },
];

const WALLET_BALANCE_PAYMENT_OPTION_ID = 'wallet_balance';
const COMPACT_PAYMENT_OPTION_IDS = ['qris', 'bank_transfer'] as const;
const DEVELOPMENT_COMPACT_PAYMENT_OPTION_IDS = ['mock_fast'] as const;

function normalizeId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function resolveTxnStatus(txn: Transaction): string {
  const raw =
    txn.status ||
    (txn as unknown as { transaction_status?: string }).transaction_status;
  return String(raw || 'pending')
    .trim()
    .toLowerCase();
}

function readTransactionMeta(txn: Transaction): Record<string, unknown> {
  if (!txn.transaction_meta || typeof txn.transaction_meta !== 'object')
    return {};
  return txn.transaction_meta as Record<string, unknown>;
}

function resolveWalletEnvironment(txn: Transaction): WalletEnvironment {
  const meta = readTransactionMeta(txn);
  const flow = meta.flow as Record<string, unknown> | undefined;
  const raw = String(flow?.wallet_environment || '')
    .trim()
    .toLowerCase();
  return raw === 'live' ? 'live' : 'development';
}

function resolvePaymentStatus(txn: Transaction): string {
  const meta = readTransactionMeta(txn);
  const payment = meta.payment as Record<string, unknown> | undefined;
  const raw = String(payment?.status || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    const protection = String(txn.protection_status || '')
      .trim()
      .toLowerCase();
    if (
      protection === 'funds_held' ||
      protection === 'on_hold' ||
      protection === 'escrow_released'
    ) {
      return 'paid';
    }
    return 'awaiting_payment';
  }
  return raw;
}

function resolveSnapshot(txn: Transaction): {
  title: string;
  image: string;
} {
  const snapshot = (txn.snapshot_listing || {}) as Record<string, unknown>;
  const title =
    typeof snapshot.title === 'string' && snapshot.title.trim()
      ? snapshot.title.trim()
      : 'View Content';
  const image =
    typeof snapshot.cover_image === 'string' && snapshot.cover_image.trim()
      ? snapshot.cover_image.trim()
      : '';
  return { title, image };
}

function isTransactionPaymentReady(txn: Transaction): boolean {
  const paymentStatus = resolvePaymentStatus(txn);
  const protectionStatus = txn.protection_status || 'awaiting_funding';
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

function resolveTransactionGuidance(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): string {
  const status = resolveTxnStatus(txn);
  const paymentReady = isTransactionPaymentReady(txn);
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  const isSeller = Boolean(
    userId && normalizeId(txn.seller_id) === normalizeId(userId),
  );

  if (status === 'pending') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Bayar dulu biar order diproses.'
        : 'Pay first so the order can continue.';
    }
    if (isSeller && paymentReady) {
      return locale === 'id'
        ? 'Terima atau tolak order ini.'
        : 'Accept or decline this order.';
    }
    return locale === 'id'
      ? 'Cek detail singkatnya lalu putuskan lanjut atau tidak.'
      : 'Check the basics, then decide whether to continue.';
  }

  if (status === 'accepted') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Seller sudah setuju. Tinggal bayar.'
        : 'The seller accepted. Complete payment.';
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
    return locale === 'id'
      ? 'Order sedang berjalan. Pantau progresnya.'
      : 'The order is ongoing. Track the progress.';
  }

  if (status === 'delivered') {
    return locale === 'id'
      ? 'Hasil sudah dikirim. Cek lalu terima atau revisi.'
      : 'The result was delivered. Review it, then accept or revise.';
  }

  if (status === 'disputed') {
    return locale === 'id'
      ? 'Masalah sedang ditinjau support.'
      : 'Support is reviewing the issue.';
  }

  if (status === 'completed') {
    return locale === 'id'
      ? 'Transaksi selesai.'
      : 'The transaction is complete.';
  }

  if (status === 'cancelled') {
    return locale === 'id'
      ? 'Transaksi dibatalkan.'
      : 'The transaction was cancelled.';
  }

  return locale === 'id'
    ? 'Lanjutkan dari langkah berikutnya.'
    : 'Continue from the next step.';
}

function formatShortOrderId(id: string): string {
  const raw = String(id || '').trim();
  if (raw.length <= 16) return raw || '-';
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function resolveTransactionHeadline(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): string {
  const status = resolveTxnStatus(txn);
  const paymentReady = isTransactionPaymentReady(txn);
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  const isSeller = Boolean(
    userId && normalizeId(txn.seller_id) === normalizeId(userId),
  );

  if (status === 'pending') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Menunggu pembayaran Anda'
        : 'Waiting for your payment';
    }
    if (isSeller && paymentReady) {
      return locale === 'id'
        ? 'Menunggu aksi Anda: terima / tolak'
        : 'Waiting on you: accept / decline';
    }
    if (isSeller) {
      return locale === 'id'
        ? 'Menunggu buyer mengamankan dana'
        : 'Waiting for the buyer to secure funds';
    }
    return locale === 'id'
      ? 'Menunggu konfirmasi order'
      : 'Waiting for order confirmation';
  }

  if (status === 'accepted') {
    if (isBuyer && !paymentReady) {
      return locale === 'id'
        ? 'Seller sudah setuju, tinggal bayar'
        : 'Seller accepted, payment still needed';
    }
    if (isSeller) {
      return locale === 'id'
        ? 'Siap mulai kerja / pengiriman'
        : 'Ready to start work / delivery';
    }
    return locale === 'id' ? 'Order sudah deal' : 'Order is agreed';
  }

  if (status === 'in_progress') {
    return locale === 'id' ? 'Order sedang berjalan' : 'Order in progress';
  }
  if (status === 'delivered') {
    return locale === 'id' ? 'Hasil sudah dikirim' : 'Result delivered';
  }
  if (status === 'completed') {
    return locale === 'id' ? 'Transaksi selesai' : 'Transaction completed';
  }
  if (status === 'cancelled') {
    return locale === 'id' ? 'Transaksi dibatalkan' : 'Transaction cancelled';
  }
  if (status === 'disputed') {
    return locale === 'id'
      ? 'Transaksi sedang dispute'
      : 'Transaction in dispute';
  }

  return locale === 'id' ? 'Perlu ditinjau' : 'Needs review';
}

function resolveTransactionProgress(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): {
  percent: number;
  label: string;
  steps: Array<{ label: string; state: 'done' | 'current' | 'waiting' }>;
} {
  const status = resolveTxnStatus(txn);
  const paymentReady = isTransactionPaymentReady(txn);
  const headline = resolveTransactionHeadline(txn, userId, locale);
  const labels =
    locale === 'id'
      ? [
          'Order dibuat',
          'Seller terima',
          'Dana aman',
          'Diproses',
          'Hasil dikirim',
          'Selesai',
        ]
      : [
          'Order created',
          'Seller accepts',
          'Funds secured',
          'In progress',
          'Delivered',
          'Done',
        ];

  const statusIndex: Record<string, number> = {
    pending: paymentReady ? 1 : 0,
    accepted: paymentReady ? 2 : 1,
    in_progress: 3,
    delivered: 4,
    completed: 5,
    disputed: 3,
    cancelled: 0,
  };
  const currentIndex = statusIndex[status] ?? 0;
  const percent =
    status === 'completed'
      ? 100
      : status === 'cancelled'
        ? 0
        : status === 'pending' && paymentReady
          ? 33
          : Math.max(
              16,
              Math.round(((currentIndex + 1) / labels.length) * 100),
            );

  return {
    percent,
    label: headline,
    steps: labels.map((label, index) => ({
      label,
      state:
        index < currentIndex || (paymentReady && index === 2)
          ? 'done'
          : index === currentIndex
            ? 'current'
            : 'waiting',
    })),
  };
}
async function sha256Hex(value: string): Promise<string> {
  const input = String(value || '');
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser tidak mendukung hashing bukti.');
  }
  const encoded = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(part => part.toString(16).padStart(2, '0'))
    .join('');
}

function humanize(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = readFirstString(...value);
      if (nested) return nested;
      continue;
    }
    const text = asString(value);
    if (text) return text;
  }
  return '';
}

function resolveTransactionVisual(txn: Transaction): string {
  const snapshot = asObject(txn.snapshot_listing);
  const meta = readTransactionMeta(txn);
  const content = asObject(meta.content || meta.listing || meta.item);
  const media = asObject(meta.media);

  return readFirstString(
    snapshot.cover_image,
    snapshot.coverImage,
    snapshot.image,
    snapshot.image_url,
    snapshot.thumbnail,
    snapshot.thumbnail_url,
    snapshot.media_url,
    snapshot.media_urls,
    content.cover_image,
    content.image,
    content.image_url,
    content.thumbnail,
    media.cover_image,
    media.image,
    media.url,
  );
}

function resolveCounterparty(
  txn: Transaction,
  userId: string | null | undefined,
  locale: string,
): { id: string; name: string; avatar: string; role: string } {
  const isBuyer = Boolean(
    userId && normalizeId(txn.buyer_id) === normalizeId(userId),
  );
  const side = isBuyer ? 'seller' : 'buyer';
  const id = side === 'seller' ? txn.seller_id : txn.buyer_id;
  const role =
    side === 'seller'
      ? locale === 'id'
        ? 'Penjual'
        : 'Seller'
      : locale === 'id'
        ? 'Pembeli'
        : 'Buyer';
  const meta = readTransactionMeta(txn);
  const snapshot = asObject(txn.snapshot_listing);
  const profile = asObject(
    meta[`${side}_profile`] || meta[side] || snapshot[`${side}_profile`],
  );
  const owner = asObject(snapshot.owner || snapshot.owner_profile);
  const displayFallback = `${role} ${formatShortOrderId(id)}`;
  const name = readFirstString(
    profile.name,
    profile.full_name,
    profile.fullName,
    profile.username,
    meta[`${side}_name`],
    meta[`${side}_username`],
    snapshot[`${side}_name`],
    side === 'seller' ? snapshot.seller_name : snapshot.buyer_name,
    side === 'seller' ? owner.name || owner.username : '',
    displayFallback,
  );
  const avatar = readFirstString(
    profile.avatar_url,
    profile.avatarUrl,
    profile.photo_url,
    profile.image,
    meta[`${side}_avatar`],
    meta[`${side}_avatar_url`],
    snapshot[`${side}_avatar`],
    snapshot[`${side}_avatar_url`],
    side === 'seller' ? owner.avatar_url || owner.avatarUrl : '',
  );

  return { id, name, avatar, role };
}

type WalletTopupListResponse = {
  error?: string;
  items?: WalletTopupLite[];
};

function readTopupLinkedTransactionId(topup: WalletTopupLite | null): string {
  const payload = asObject(topup?.payment_payload);
  const clientMeta = asObject(payload.client_metadata);
  return asString(clientMeta.transaction_id || payload.transaction_id);
}

function readTopupOriginalTransactionAmount(
  topup: WalletTopupLite | null,
): number {
  const payload = asObject(topup?.payment_payload);
  const clientMeta = asObject(payload.client_metadata);
  return Number(
    clientMeta.original_amount_cents ||
      clientMeta.transaction_amount_cents ||
      payload.original_amount_cents ||
      0,
  );
}

function formatDateTime(value: string): string {
  const text = asString(value);
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function parseReferenceLines(value: string): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .slice(0, 10);
}

type PaymentInstructionView = {
  mode: string;
  paymentType: string;
  transactionId: string;
  transactionStatus: string;
  expiryTime: string;
  checkoutHint: string;
  qrUrl: string;
  qrString: string;
  deeplinkUrl: string;
  vaNumbers: Array<{ bank: string; number: string }>;
  permataVa: string;
  billKey: string;
  billerCode: string;
};

function findActionUrl(actions: unknown, nameCandidates: string[]): string {
  if (!Array.isArray(actions)) return '';
  for (const entry of actions) {
    const row = asObject(entry);
    const name = asString(row.name).toLowerCase();
    if (!name) continue;
    if (!nameCandidates.some(candidate => name.includes(candidate))) continue;
    const url = asString(row.url);
    if (url) return url;
  }
  return '';
}

function extractPaymentInstructionView(
  topup: CreateTopupResponse['topup'] | null,
): PaymentInstructionView | null {
  if (!topup) return null;

  const payload = asObject(topup.payment_payload);
  const mode = asString(payload.mode).toLowerCase();
  const charge =
    mode === 'direct_charge'
      ? asObject(payload.charge)
      : mode === 'snap_redirect'
        ? asObject(payload.snap)
        : payload;

  const actions = charge.actions;
  const paymentType = asString(
    charge.payment_type || topup.payment_method,
  ).toLowerCase();

  const view: PaymentInstructionView = {
    mode: mode || 'unknown',
    paymentType,
    transactionId: asString(charge.transaction_id),
    transactionStatus: asString(charge.transaction_status || topup.status),
    expiryTime: asString(charge.expiry_time),
    checkoutHint: asString(payload.checkout_hint || topup.checkout_url),
    qrUrl:
      findActionUrl(actions, ['generate-qr', 'qr']) || asString(charge.qr_url),
    qrString: asString(charge.qr_string),
    deeplinkUrl:
      findActionUrl(actions, ['deeplink', 'deep_link', 'mobile']) ||
      asString(charge.deeplink_url),
    vaNumbers: [],
    permataVa: asString(charge.permata_va_number),
    billKey: asString(charge.bill_key),
    billerCode: asString(charge.biller_code),
  };

  const vaNumbers = Array.isArray(charge.va_numbers) ? charge.va_numbers : [];
  for (const item of vaNumbers) {
    const row = asObject(item);
    const bank = asString(row.bank).toUpperCase();
    const number = asString(row.va_number || row.account_number);
    if (!number) continue;
    view.vaNumbers.push({ bank: bank || 'BANK', number });
  }

  const hasAny =
    Boolean(view.qrUrl) ||
    Boolean(view.qrString) ||
    Boolean(view.deeplinkUrl) ||
    view.vaNumbers.length > 0 ||
    Boolean(view.permataVa) ||
    Boolean(view.billKey) ||
    Boolean(view.checkoutHint);

  return hasAny ? view : null;
}

/** ---------- UI meta: icons, colors, badges ---------- */

type ChipMeta = {
  Icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  chipClass: string;
  accentClass: string;
};

function statusMeta(statusRaw: string): ChipMeta {
  const status = String(statusRaw || '')
    .trim()
    .toLowerCase();
  switch (status) {
    case 'pending':
      return {
        Icon: Clock4,
        emoji: '⏳',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]',
        accentClass: 'bg-[color:var(--app-warning)]',
      };
    case 'accepted':
      return {
        Icon: Handshake,
        emoji: '🤝',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] dark:text-[color:var(--app-info)]',
        accentClass: 'bg-[color:var(--app-info)]',
      };
    case 'in_progress':
      return {
        Icon: Rocket,
        emoji: '🚀',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] dark:text-[color:var(--app-info)]',
        accentClass: 'bg-[color:var(--app-info)]',
      };
    case 'delivered':
      return {
        Icon: Truck,
        emoji: '📦',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-group-talent)_15%,_transparent)] text-[color:var(--app-group-talent)] dark:text-[color:var(--app-group-talent)]',
        accentClass: 'bg-[color:var(--app-group-talent)]',
      };
    case 'completed':
      return {
        Icon: CheckCircle2,
        emoji: '✅',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]',
        accentClass: 'bg-[color:var(--app-accent)]',
      };
    case 'disputed':
      return {
        Icon: AlertTriangle,
        emoji: '⚠️',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]',
        accentClass: 'bg-[color:var(--app-warning)]',
      };
    case 'cancelled':
      return {
        Icon: Ban,
        emoji: '⛔',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]',
        accentClass: 'bg-[color:var(--app-danger)]',
      };
    default:
      return {
        Icon: ShieldCheck,
        emoji: '🔎',
        chipClass:
          'bg-[color:color-mix(in_srgb,_var(--app-surface)_15%,_transparent)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]',
        accentClass: 'bg-[color:var(--app-surface)]',
      };
  }
}

function protectionMeta(raw: string): ChipMeta {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'funds_held' || v === 'on_hold') {
    return {
      Icon: Shield,
      emoji: '🛡️',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] text-[color:var(--app-info)] dark:text-[color:var(--app-info)]',
      accentClass: 'bg-[color:var(--app-info)]',
    };
  }
  if (v === 'escrow_released') {
    return {
      Icon: BadgeDollarSign,
      emoji: '💸',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]',
      accentClass: 'bg-[color:var(--app-accent)]',
    };
  }
  if (v === 'refunded') {
    return {
      Icon: BadgeDollarSign,
      emoji: '↩️',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]',
      accentClass: 'bg-[color:var(--app-warning)]',
    };
  }
  return {
    Icon: Shield,
    emoji: '🧾',
    chipClass:
      'bg-[color:color-mix(in_srgb,_var(--app-surface)_15%,_transparent)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]',
    accentClass: 'bg-[color:var(--app-surface)]',
  };
}

function paymentMeta(raw: string): ChipMeta {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'paid') {
    return {
      Icon: CreditCard,
      emoji: '✅',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]',
      accentClass: 'bg-[color:var(--app-accent)]',
    };
  }
  if (v === 'partial') {
    return {
      Icon: CreditCard,
      emoji: '🟡',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]',
      accentClass: 'bg-[color:var(--app-warning)]',
    };
  }
  if (v === 'hold_error') {
    return {
      Icon: CreditCard,
      emoji: '❌',
      chipClass:
        'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]',
      accentClass: 'bg-[color:var(--app-danger)]',
    };
  }
  return {
    Icon: CreditCard,
    emoji: '⌛',
    chipClass:
      'bg-[color:color-mix(in_srgb,_var(--app-surface)_15%,_transparent)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]',
    accentClass: 'bg-[color:var(--app-surface)]',
  };
}

function Chip({
  meta,
  label,
  size = 'sm',
}: {
  meta: ChipMeta;
  label: string;
  size?: 'sm' | 'xs';
}) {
  const Icon = meta.Icon;
  const base =
    size === 'xs'
      ? 'px-2.5 py-1 text-[11px] font-semibold'
      : 'px-3 py-1 text-xs font-semibold';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${base} ${meta.chipClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[11px]" aria-hidden="true">
        {meta.emoji}
      </span>
      <span>{label}</span>
    </span>
  );
}

function resolveFriendlyFetchError(
  locale: string,
  error: unknown,
  fallbackId: string,
  fallbackEn: string,
): string {
  const fallback = locale === 'id' ? fallbackId : fallbackEn;
  if (!(error instanceof Error)) return fallback;
  const message = String(error.message || '').trim();
  if (!message) return fallback;
  const normalized = message.toLowerCase();
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  ) {
    return fallback;
  }
  return message;
}

function resolveTransactionFundsChip(
  txn: Transaction,
  locale: string,
): { meta: ChipMeta; label: string } {
  const protection = String(txn.protection_status || '')
    .trim()
    .toLowerCase();
  const payment = resolvePaymentStatus(txn);

  if (protection === 'refunded') {
    return {
      meta: protectionMeta('refunded'),
      label: locale === 'id' ? 'Dana dikembalikan' : 'Refunded',
    };
  }

  if (protection === 'escrow_released') {
    return {
      meta: protectionMeta('escrow_released'),
      label: locale === 'id' ? 'Dana diteruskan' : 'Paid out',
    };
  }

  if (isTransactionPaymentReady(txn)) {
    return {
      meta: protectionMeta('funds_held'),
      label: locale === 'id' ? 'Dana aman' : 'Funds secured',
    };
  }

  if (payment === 'partial') {
    return {
      meta: paymentMeta('partial'),
      label: locale === 'id' ? 'Bayar sebagian' : 'Partial payment',
    };
  }

  return {
    meta: paymentMeta(payment),
    label: locale === 'id' ? 'Belum dibayar' : 'Awaiting payment',
  };
}

type TransactionActionTone = 'primary' | 'secondary' | 'subtle' | 'danger';

type TransactionListFilter = 'all' | 'needs_action' | 'ongoing' | 'completed';

const TRANSACTION_ACTION_PRIORITY = [
  'pay',
  'accept-delivery',
  'request-revision',
  'accept',
  'start',
  'deliver',
  'review',
  'chat',
  'counter-offer',
  'cancel',
  'dispute',
  'decline',
] as const;

type TransactionActionPriorityKey =
  (typeof TRANSACTION_ACTION_PRIORITY)[number];

type TransactionActionKey =
  | TransactionActionPriorityKey
  | 'support'
  | 'listing';

type TransactionCardAction = {
  key: TransactionActionKey;
  label: string;
  tone: TransactionActionTone;
  Icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
};

function getTransactionActionClass(tone: TransactionActionTone): string {
  switch (tone) {
    case 'primary':
      return 'border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_18px_32px_-22px_rgba(37,99,235,0.45)] hover:bg-[color:var(--app-accent-strong)]';
    case 'subtle':
      return 'border border-[color:color-mix(in_srgb,_var(--app-info-border)_45%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_16%,_transparent)]';
    case 'danger':
      return 'border border-[color:color-mix(in_srgb,_var(--app-danger-border)_50%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] text-[color:var(--app-danger)] hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_14%,_transparent)]';
    case 'secondary':
    default:
      return 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_75%,_transparent)]';
  }
}

function resolveTransactionListFilter(
  txn: Transaction,
  userId: string | null | undefined,
): Exclude<TransactionListFilter, 'all'> {
  const status = resolveTxnStatus(txn);
  const isSeller = Boolean(
    userId && normalizeId(txn.seller_id) === normalizeId(userId),
  );

  if (status === 'completed' || status === 'cancelled') {
    return 'completed';
  }

  if (canUserOpenPayment(txn, userId) || (status === 'pending' && isSeller)) {
    return 'needs_action';
  }

  return 'ongoing';
}

function formatTransactionListDate(value: string, locale: string): string {
  const text = asString(value);
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return parsed.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function prioritizeTransactionActions(
  actions: TransactionCardAction[],
): TransactionCardAction[] {
  const priority: Partial<Record<TransactionActionKey, number>> =
    TRANSACTION_ACTION_PRIORITY.reduce<
      Partial<Record<TransactionActionKey, number>>
    >((accumulator, key, index) => {
      accumulator[key] = index;
      return accumulator;
    }, {});

  return [...actions].sort((left, right) => {
    const leftScore = priority[left.key] ?? Number.MAX_SAFE_INTEGER;
    const rightScore = priority[right.key] ?? Number.MAX_SAFE_INTEGER;
    return leftScore - rightScore;
  });
}

function PaymentMethodPill({ option }: { option: PaymentOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-surface-muted)]">
        <Image
          src={option.image}
          alt={option.title}
          width={32}
          height={32}
          className="h-7 w-7 rounded object-contain"
        />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-black text-[color:var(--app-text)]">
          {option.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {option.badge}
        </span>
      </span>
    </span>
  );
}

export default function TransactionsPage() {
  const { user, authFetch } = useAuth();
  const { prompt } = useDialog();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() || 'id';
  const paymentTransactionId = asString(searchParams?.get('transaction_id'));
  const deliveryAction = asString(searchParams?.get('delivery_action'))
    .toLowerCase()
    .trim();
  const focusTransactionId = asString(
    searchParams?.get('focus_transaction_id') || paymentTransactionId,
  );
  const shouldOpenPaymentFromQuery =
    searchParams?.get('open_payment') === '1' ||
    (Boolean(paymentTransactionId) &&
      !searchParams?.get('focus_transaction_id'));

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(
    null,
  );
  const [refreshingTransactions, setRefreshingTransactions] = useState(false);
  const [listFilter, setListFilter] = useState<TransactionListFilter>('all');
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);

  const [paymentTxn, setPaymentTxn] = useState<Transaction | null>(null);
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState(
    WALLET_BALANCE_PAYMENT_OPTION_ID,
  );
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [syncingTopupStatus, setSyncingTopupStatus] = useState(false);
  const [restoringPendingTopup, setRestoringPendingTopup] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] =
    useState<WalletBalancesResponse | null>(null);
  const [loadingWalletBalances, setLoadingWalletBalances] = useState(false);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null,
  );
  const [rewardBalance, setRewardBalance] =
    useState<RewardBalanceResponse | null>(null);
  const [loadingRewardBalance, setLoadingRewardBalance] = useState(false);
  const [rewardBalanceError, setRewardBalanceError] = useState<string | null>(
    null,
  );
  const [useCoinsForPayment, setUseCoinsForPayment] = useState(true);
  const [latestCheckoutUrl, setLatestCheckoutUrl] = useState<string | null>(
    null,
  );
  const [latestTopup, setLatestTopup] = useState<
    CreateTopupResponse['topup'] | null
  >(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [verificationPrompt, setVerificationPrompt] =
    useState<TransactionVerificationState | null>(null);

  const [counterOfferTxn, setCounterOfferTxn] = useState<Transaction | null>(
    null,
  );
  const [counterOfferAmount, setCounterOfferAmount] = useState('');
  const [counterOfferMessage, setCounterOfferMessage] = useState('');
  const [counterOfferError, setCounterOfferError] = useState<string | null>(
    null,
  );
  const [counterOfferSubmitting, setCounterOfferSubmitting] = useState(false);

  const [cancelTxn, setCancelTxn] = useState<Transaction | null>(null);
  const [cancelReasonCode, setCancelReasonCode] =
    useState('buyer_changed_mind');
  const [cancelMessage, setCancelMessage] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [disputeTxn, setDisputeTxn] = useState<Transaction | null>(null);
  const [disputeReasonCode, setDisputeReasonCode] = useState('other');
  const [disputeMessage, setDisputeMessage] = useState('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [disputeEvidenceContext, setDisputeEvidenceContext] = useState('');
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [deliveryTxn, setDeliveryTxn] = useState<Transaction | null>(null);
  const [deliveryTitle, setDeliveryTitle] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryAttachmentsText, setDeliveryAttachmentsText] = useState('');
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);

  const [deliveryReviewTxn, setDeliveryReviewTxn] =
    useState<Transaction | null>(null);
  const [deliveryReviewDecision, setDeliveryReviewDecision] = useState<
    'accept' | 'request_revision'
  >('accept');
  const [deliveryReviewNote, setDeliveryReviewNote] = useState('');
  const [deliveryReviewAttachmentsText, setDeliveryReviewAttachmentsText] =
    useState('');
  const [deliveryReviewError, setDeliveryReviewError] = useState<string | null>(
    null,
  );
  const [deliveryReviewSubmitting, setDeliveryReviewSubmitting] =
    useState(false);

  const queryPaymentHandledRef = useRef<string | null>(null);
  const focusedTransactionScrollRef = useRef<string | null>(null);
  const queryDeliveryActionHandledRef = useRef<string | null>(null);
  const paymentOptionAutoResolvedForTxnRef = useRef<string | null>(null);

  const openVerificationPrompt = useCallback(() => {
    setVerificationPrompt(readTransactionVerification(user));
  }, [user]);

  const loadTransactions = useCallback(async () => {
    setRefreshingTransactions(true);
    setTransactionsError(null);
    try {
      const res = await authFetch('/api/transactions', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as
        | Transaction[]
        | { error?: string; items?: Transaction[] };

      if (!res.ok) {
        throw new Error(
          asString('error' in payload ? payload.error : '') ||
            (locale === 'id'
              ? 'Riwayat transaksi belum bisa dimuat.'
              : 'Unable to load transactions.'),
        );
      }

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
          ? payload.items
          : [];

      setTransactions(items);
    } catch (error) {
      console.error(error);
      setTransactionsError(
        resolveFriendlyFetchError(
          locale,
          error,
          'Riwayat transaksi belum bisa dimuat. Coba lagi sebentar.',
          'Unable to load transactions right now. Please try again.',
        ),
      );
    } finally {
      setLoading(false);
      setRefreshingTransactions(false);
    }
  }, [authFetch, locale]);

  const loadWalletBalances = useCallback(async () => {
    setLoadingWalletBalances(true);
    setWalletBalanceError(null);

    try {
      const res = await authFetch('/api/wallet/balance', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as
        | WalletBalancesResponse
        | { error?: string };

      if (!res.ok) {
        throw new Error(
          'error' in payload && payload.error
            ? payload.error
            : locale === 'id'
              ? 'Gagal memuat saldo wallet.'
              : 'Failed to load wallet balance.',
        );
      }
      const balances = payload as Partial<WalletBalancesResponse>;

      setWalletBalances({
        accounts: Array.isArray(balances.accounts) ? balances.accounts : [],
        default_environment:
          balances.default_environment === 'live' ? 'live' : 'development',
        live_enabled: Boolean(balances.live_enabled),
        provider_default: asString(balances.provider_default),
        generated_at: asString(balances.generated_at),
      });
    } catch (error) {
      setWalletBalanceError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal memuat saldo wallet.'
            : 'Failed to load wallet balance.',
      );
    } finally {
      setLoadingWalletBalances(false);
    }
  }, [authFetch, locale]);

  const loadRewardBalance = useCallback(async () => {
    setLoadingRewardBalance(true);
    setRewardBalanceError(null);

    try {
      const res = await authFetch('/api/rewards/balance', {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as
        | RewardBalanceResponse
        | { error?: string };

      if (!res.ok) {
        throw new Error(
          payload.error ||
            (locale === 'id'
              ? 'Gagal memuat saldo koin.'
              : 'Failed to load coin balance.'),
        );
      }

      setRewardBalance(payload as RewardBalanceResponse);
    } catch (error) {
      setRewardBalanceError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal memuat saldo koin.'
            : 'Failed to load coin balance.',
      );
    } finally {
      setLoadingRewardBalance(false);
    }
  }, [authFetch, locale]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const onNotification = (event: Event) => {
      const custom = event as CustomEvent<{ category?: string }>;
      const category = String(custom.detail?.category || '').toLowerCase();
      if (category !== 'transaction' && category !== 'wallet') return;
      void loadTransactions();
    };
    window.addEventListener(
      'marketplace:notification',
      onNotification as EventListener,
    );
    return () =>
      window.removeEventListener(
        'marketplace:notification',
        onNotification as EventListener,
      );
  }, [loadTransactions]);

  useEffect(() => {
    if (!focusTransactionId || transactions.length === 0) return;
    const marker = `${focusTransactionId}:${shouldOpenPaymentFromQuery ? 'pay' : 'focus'}`;
    if (queryPaymentHandledRef.current === marker) return;
    const found = transactions.find(txn => txn.id === focusTransactionId);
    if (!found) return;

    queryPaymentHandledRef.current = marker;

    if (!shouldOpenPaymentFromQuery || !canUserOpenPayment(found, user?.id)) {
      return;
    }

    setPaymentTxn(found);
    setSyncingTopupStatus(false);
    setRestoringPendingTopup(false);
    setPaymentError(null);
    setPaymentInfo(null);
    setWalletBalances(null);
    setWalletBalanceError(null);
    setRewardBalance(null);
    setRewardBalanceError(null);
    setUseCoinsForPayment(true);
    setLatestCheckoutUrl(null);
    setLatestTopup(null);
    paymentOptionAutoResolvedForTxnRef.current = null;
    setSelectedPaymentOptionId(WALLET_BALANCE_PAYMENT_OPTION_ID);
  }, [focusTransactionId, shouldOpenPaymentFromQuery, transactions, user?.id]);

  useEffect(() => {
    if (!focusTransactionId || transactions.length === 0) return;
    if (focusedTransactionScrollRef.current === focusTransactionId) return;

    const timer = window.setTimeout(() => {
      const node = document.getElementById(
        `transaction-card-${focusTransactionId}`,
      );
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusedTransactionScrollRef.current = focusTransactionId;
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [focusTransactionId, transactions.length]);

  useEffect(() => {
    if (!deliveryAction || !focusTransactionId || transactions.length === 0)
      return;
    const marker = `${focusTransactionId}:${deliveryAction}`;
    if (queryDeliveryActionHandledRef.current === marker) return;
    const found = transactions.find(txn => txn.id === focusTransactionId);
    if (!found) return;

    const isBuyer = Boolean(
      user?.id && normalizeId(found.buyer_id) === normalizeId(user.id),
    );
    const isSeller = Boolean(
      user?.id && normalizeId(found.seller_id) === normalizeId(user.id),
    );
    const status = resolveTxnStatus(found);

    if (deliveryAction === 'deliver' && isSeller && status === 'in_progress') {
      queryDeliveryActionHandledRef.current = marker;
      openDeliveryModal(found);
      return;
    }
    if (
      deliveryAction === 'review_accept' &&
      isBuyer &&
      status === 'delivered'
    ) {
      queryDeliveryActionHandledRef.current = marker;
      openDeliveryReviewModal(found, 'accept');
      return;
    }
    if (
      deliveryAction === 'review_revision' &&
      isBuyer &&
      status === 'delivered'
    ) {
      queryDeliveryActionHandledRef.current = marker;
      openDeliveryReviewModal(found, 'request_revision');
    }
  }, [deliveryAction, focusTransactionId, transactions, user?.id]);

  useEffect(() => {
    if (!paymentTxn) return;
    void loadWalletBalances();
    void loadRewardBalance();
  }, [loadRewardBalance, loadWalletBalances, paymentTxn]);

  const formatPrice = useCallback((cents: number, currency: string) => {
    const amount = cents / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'IDR',
        maximumFractionDigits: currency === 'IDR' ? 0 : 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }, []);

  const currentWalletEnvironment = useMemo<WalletEnvironment>(
    () => (paymentTxn ? resolveWalletEnvironment(paymentTxn) : 'development'),
    [paymentTxn],
  );

  const paymentCurrency = useMemo(
    () => asString(paymentTxn?.currency || 'IDR').toUpperCase(),
    [paymentTxn],
  );

  const paymentWalletAccount = useMemo(() => {
    const accounts = Array.isArray(walletBalances?.accounts)
      ? walletBalances.accounts
      : [];
    return (
      accounts.find(
        account =>
          account.environment === currentWalletEnvironment &&
          asString(account.currency).toUpperCase() === paymentCurrency,
      ) || null
    );
  }, [currentWalletEnvironment, paymentCurrency, walletBalances]);

  const walletAvailableBalanceCents = Number(
    paymentWalletAccount?.available_balance_cents || 0,
  );
  const rewardCoinBalance = Number(rewardBalance?.balance?.coin_balance || 0);
  const rewardCoinValueCents = Number(
    rewardBalance?.payment?.coin_value_cents || 10_000,
  );
  const rewardCoinMaxDiscountBps = Number(
    rewardBalance?.payment?.max_discount_bps || 2_500,
  );
  const rewardCoinMinCashPaymentCents = Number(
    rewardBalance?.payment?.min_cash_payment_cents || 100_000,
  );
  const rewardCoinCurrency = asString(
    rewardBalance?.payment?.currency || 'IDR',
  ).toUpperCase();
  const canUseRewardCoinsForTxn = Boolean(
    paymentTxn &&
    paymentCurrency === rewardCoinCurrency &&
    rewardCoinBalance > 0 &&
    rewardCoinValueCents > 0,
  );
  const maxRewardCoinDiscountCents = paymentTxn
    ? Math.max(
        0,
        Math.min(
          Math.floor(
            (Number(paymentTxn.amount_cents || 0) * rewardCoinMaxDiscountBps) /
              10_000,
          ),
          Math.max(
            0,
            Number(paymentTxn.amount_cents || 0) -
              rewardCoinMinCashPaymentCents,
          ),
        ),
      )
    : 0;
  const rewardCoinsApplied =
    useCoinsForPayment && canUseRewardCoinsForTxn
      ? Math.max(
          0,
          Math.min(
            rewardCoinBalance,
            Math.floor(maxRewardCoinDiscountCents / rewardCoinValueCents),
          ),
        )
      : 0;
  const rewardCoinDiscountCents = rewardCoinsApplied * rewardCoinValueCents;
  const paymentDueAfterCoinsCents = Math.max(
    0,
    Number(paymentTxn?.amount_cents || 0) - rewardCoinDiscountCents,
  );
  const walletEffectiveBalanceCents =
    walletAvailableBalanceCents + rewardCoinDiscountCents;
  const walletShortfallCents = Math.max(
    0,
    Number(paymentTxn?.amount_cents || 0) - walletEffectiveBalanceCents,
  );
  const canPayWithWalletBalance = Boolean(
    paymentTxn && walletEffectiveBalanceCents >= paymentTxn.amount_cents,
  );

  const walletBalanceOption = useMemo<PaymentOption>(() => {
    const balanceLabel = paymentTxn
      ? formatPrice(walletAvailableBalanceCents, paymentCurrency)
      : '-';
    const amountLabel = paymentTxn
      ? formatPrice(paymentTxn.amount_cents, paymentCurrency)
      : '-';
    const coinDiscountLabel =
      rewardCoinDiscountCents > 0
        ? formatPrice(rewardCoinDiscountCents, paymentCurrency)
        : '';
    const shortfallLabel =
      paymentTxn && walletShortfallCents > 0
        ? formatPrice(walletShortfallCents, paymentCurrency)
        : '';

    let description =
      locale === 'id'
        ? `Bayar langsung dari saldo wallet yang sudah ada. Saldo saat ini ${balanceLabel}.`
        : `Pay directly from your wallet balance. Current balance ${balanceLabel}.`;

    if (loadingWalletBalances) {
      description =
        locale === 'id'
          ? 'Memeriksa saldo wallet yang tersedia untuk transaksi ini.'
          : 'Checking your available wallet balance for this transaction.';
    } else if (
      paymentTxn &&
      rewardCoinDiscountCents > 0 &&
      canPayWithWalletBalance
    ) {
      description =
        locale === 'id'
          ? `Saldo cukup setelah koin memotong ${coinDiscountLabel}. Dana langsung diamankan.`
          : `Balance is sufficient after coins cover ${coinDiscountLabel}. Funds are held instantly.`;
    } else if (paymentTxn && canPayWithWalletBalance) {
      description =
        locale === 'id'
          ? `Saldo cukup untuk langsung membayar ${amountLabel} tanpa top-up baru.`
          : `Your balance is sufficient to pay ${amountLabel} without a new top-up.`;
    } else if (paymentTxn && walletShortfallCents > 0) {
      description =
        locale === 'id'
          ? `Saldo wallet belum cukup. Kurang ${shortfallLabel} untuk membayar ${amountLabel}.`
          : `Your wallet balance is short by ${shortfallLabel} for ${amountLabel}.`;
    }

    return {
      id: WALLET_BALANCE_PAYMENT_OPTION_ID,
      title: locale === 'id' ? 'Saldo Wallet' : 'Wallet Balance',
      description,
      provider: 'wallet',
      method: 'wallet_balance',
      image: '/images/payments/mock-wallet.svg',
      badge: locale === 'id' ? 'Instant' : 'Instant',
      usesWalletBalance: true,
    };
  }, [
    canPayWithWalletBalance,
    formatPrice,
    loadingWalletBalances,
    locale,
    paymentCurrency,
    paymentTxn,
    rewardCoinDiscountCents,
    walletAvailableBalanceCents,
    walletShortfallCents,
  ]);

  const availablePaymentOptions = useMemo(() => {
    const providerOptions =
      currentWalletEnvironment === 'live'
        ? PAYMENT_OPTIONS.filter(option => option.provider !== 'mock')
        : PAYMENT_OPTIONS;
    const compactOptionIds = new Set<string>(COMPACT_PAYMENT_OPTION_IDS);
    if (currentWalletEnvironment !== 'live') {
      DEVELOPMENT_COMPACT_PAYMENT_OPTION_IDS.forEach(optionId => {
        compactOptionIds.add(optionId);
      });
    }

    const nextOptions: PaymentOption[] = [walletBalanceOption];
    const appendOption = (option?: PaymentOption | null) => {
      if (!option) return;
      if (nextOptions.some(existing => existing.id === option.id)) return;
      nextOptions.push(option);
    };

    providerOptions
      .filter(option => compactOptionIds.has(option.id))
      .forEach(option => appendOption(option));

    appendOption(
      providerOptions.find(option => option.id === selectedPaymentOptionId),
    );

    const latestTopupMethod = asString(
      latestTopup?.payment_method,
    ).toLowerCase();
    const latestTopupProvider = asString(
      latestTopup?.payment_provider,
    ).toLowerCase();
    appendOption(
      providerOptions.find(
        option =>
          option.provider === latestTopupProvider &&
          asString(option.method || '').toLowerCase() === latestTopupMethod,
      ) ||
        providerOptions.find(option => option.provider === latestTopupProvider),
    );

    return nextOptions;
  }, [
    currentWalletEnvironment,
    latestTopup?.payment_method,
    latestTopup?.payment_provider,
    selectedPaymentOptionId,
    walletBalanceOption,
  ]);

  const preferredExternalPaymentOptionId = useMemo(
    () =>
      availablePaymentOptions.find(option => option.id === 'qris')?.id ||
      availablePaymentOptions.find(option => !option.usesWalletBalance)?.id ||
      WALLET_BALANCE_PAYMENT_OPTION_ID,
    [availablePaymentOptions],
  );

  useEffect(() => {
    if (
      !availablePaymentOptions.some(
        option => option.id === selectedPaymentOptionId,
      )
    ) {
      setSelectedPaymentOptionId(
        availablePaymentOptions[0]?.id || WALLET_BALANCE_PAYMENT_OPTION_ID,
      );
    }
  }, [availablePaymentOptions, selectedPaymentOptionId]);

  const paymentWalletSelectionReady =
    !loadingWalletBalances &&
    (walletBalances !== null || walletBalanceError !== null);

  useEffect(() => {
    if (!paymentTxn || !paymentWalletSelectionReady || latestTopup) return;
    if (paymentOptionAutoResolvedForTxnRef.current === paymentTxn.id) return;

    setSelectedPaymentOptionId(
      canPayWithWalletBalance
        ? WALLET_BALANCE_PAYMENT_OPTION_ID
        : preferredExternalPaymentOptionId,
    );
    paymentOptionAutoResolvedForTxnRef.current = paymentTxn.id;
  }, [
    canPayWithWalletBalance,
    latestTopup,
    paymentTxn,
    paymentWalletSelectionReady,
    preferredExternalPaymentOptionId,
  ]);

  const cancelReasonOptions = [
    {
      value: 'buyer_changed_mind',
      label:
        locale === 'id'
          ? 'Berubah pikiran / order tidak jadi'
          : 'Changed mind / no longer needed',
    },
    {
      value: 'seller_unresponsive',
      label:
        locale === 'id'
          ? 'Lawan transaksi tidak merespons'
          : 'Counterparty is unresponsive',
    },
    {
      value: 'schedule_issue',
      label: locale === 'id' ? 'Jadwal tidak cocok' : 'Scheduling issue',
    },
    {
      value: 'duplicate_order',
      label:
        locale === 'id'
          ? 'Order ganda / salah buat'
          : 'Duplicate / accidental order',
    },
    {
      value: 'other',
      label: locale === 'id' ? 'Alasan lain' : 'Other reason',
    },
  ];

  const disputeReasonOptions = [
    {
      value: 'non_delivery',
      label:
        locale === 'id'
          ? 'Barang atau jasa belum diterima'
          : 'Item or service not received',
    },
    {
      value: 'item_not_as_described',
      label: locale === 'id' ? 'Tidak sesuai deskripsi' : 'Not as described',
    },
    {
      value: 'damaged_item',
      label:
        locale === 'id'
          ? 'Barang rusak / hasil bermasalah'
          : 'Damaged item / problematic result',
    },
    {
      value: 'service_not_delivered',
      label:
        locale === 'id'
          ? 'Pekerjaan tidak selesai'
          : 'Service was not delivered',
    },
    {
      value: 'other',
      label: locale === 'id' ? 'Masalah lain' : 'Other issue',
    },
  ];

  const orderedTransactions = useMemo(() => {
    const bucketRank: Record<Exclude<TransactionListFilter, 'all'>, number> = {
      needs_action: 0,
      ongoing: 1,
      completed: 2,
    };

    return [...transactions].sort((left, right) => {
      const leftBucket = resolveTransactionListFilter(left, user?.id);
      const rightBucket = resolveTransactionListFilter(right, user?.id);
      const bucketDiff = bucketRank[leftBucket] - bucketRank[rightBucket];
      if (bucketDiff !== 0) return bucketDiff;

      const leftTime = new Date(left.updated_at || left.created_at).getTime();
      const rightTime = new Date(
        right.updated_at || right.created_at,
      ).getTime();
      return rightTime - leftTime;
    });
  }, [transactions, user?.id]);

  const transactionFilters = useMemo(
    () => [
      {
        value: 'all' as const,
        label: locale === 'id' ? 'Semua' : 'All',
        count: orderedTransactions.length,
      },
      {
        value: 'needs_action' as const,
        label: locale === 'id' ? 'Perlu tindakan' : 'Need action',
        count: orderedTransactions.filter(
          txn => resolveTransactionListFilter(txn, user?.id) === 'needs_action',
        ).length,
      },
      {
        value: 'ongoing' as const,
        label: locale === 'id' ? 'Berjalan' : 'Ongoing',
        count: orderedTransactions.filter(
          txn => resolveTransactionListFilter(txn, user?.id) === 'ongoing',
        ).length,
      },
      {
        value: 'completed' as const,
        label: locale === 'id' ? 'Selesai' : 'Completed',
        count: orderedTransactions.filter(
          txn => resolveTransactionListFilter(txn, user?.id) === 'completed',
        ).length,
      },
    ],
    [locale, orderedTransactions, user?.id],
  );

  const visibleTransactions = useMemo(
    () =>
      listFilter === 'all'
        ? orderedTransactions
        : orderedTransactions.filter(
            txn => resolveTransactionListFilter(txn, user?.id) === listFilter,
          ),
    [listFilter, orderedTransactions, user?.id],
  );

  const ensureChatRoom = async (peerUserId: string, txn: Transaction) => {
    const res = await authFetch('/api/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peer_user_id: peerUserId,
        skip_lead: true,
        lead: {
          source: 'transaction',
          name: `Transaction ${txn.id.slice(0, 8)}`,
          content_id: txn.content_id,
          value_cents: txn.amount_cents,
          currency: txn.currency,
          metadata: { transaction_id: txn.id },
        },
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || 'Failed to create chat room');
    }
    return payload?.room_id || payload?.data?.room_id || '';
  };

  const notifyTransactionChat = async (
    txn: Transaction,
    status: string,
    responseMessage?: string,
  ) => {
    if (!user?.id) return;
    const peerUserId = user.id === txn.buyer_id ? txn.seller_id : txn.buyer_id;
    if (!peerUserId) return;

    const roomId = await ensureChatRoom(peerUserId, txn);
    if (!roomId) return;

    const payload = {
      transaction_id: txn.id,
      content_id: txn.content_id,
      amount_cents: txn.amount_cents,
      currency: txn.currency,
      status,
      deal_kind: txn.deal_kind,
      fulfillment_mode: txn.fulfillment_mode,
      transaction_meta: txn.transaction_meta,
      response_message: responseMessage,
      buyer_id: txn.buyer_id,
      seller_id: txn.seller_id,
    };

    const summary = `Transaction ${status}: ${formatPrice(txn.amount_cents, txn.currency)}`;
    await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: summary,
        type: 'transaction',
        attachments: [JSON.stringify(payload)],
      }),
    });
  };

  const handleOpenChat = async (txn: Transaction) => {
    try {
      if (!user?.id) return;
      const peerUserId =
        user.id === txn.buyer_id ? txn.seller_id : txn.buyer_id;
      if (!peerUserId) return;
      const roomId = await ensureChatRoom(peerUserId, txn);
      if (roomId) router.push(`/${locale}/chat/${encodeURIComponent(roomId)}`);
    } catch (error) {
      console.error('[TRANSACTION_OPEN_CHAT_ERROR]', error);
      notify({ title: 'Failed to open chat', variant: 'error' });
    }
  };

  const handleAccept = async (id: string) => {
    const message = await prompt({
      title: locale === 'id' ? 'Terima penawaran' : 'Accept offer',
      description:
        locale === 'id'
          ? 'Tambahkan pesan balasan kalau perlu. Kosongkan bila tidak ada.'
          : 'Add an optional response message before accepting.',
      placeholder:
        locale === 'id'
          ? 'Tulis respon opsional...'
          : 'Write an optional response...',
      confirmLabel: locale === 'id' ? 'Terima' : 'Accept',
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      multiline: true,
    });
    if (message === null) return;
    try {
      const res = await authFetch(`/api/transactions/${id}/accept`, {
        method: 'PUT',
        headers: { 'X-Idempotency-Key': createIdempotencyKey('accept') },
        body: JSON.stringify({
          status: 'accepted',
          response_message: message || undefined,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
        notifyTransactionChat(updated, 'accepted', message || undefined).catch(
          () => {},
        );
      } else {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (errorData.code === 'verification_required') {
          openVerificationPrompt();
          return;
        }
        notify({
          title: errorData.error || 'Failed to accept offer',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error(error);
      notify({ title: 'Error accepting offer', variant: 'error' });
    }
  };

  const handleStart = async (id: string) => {
    try {
      const res = await authFetch(`/api/transactions/${id}/start`, {
        method: 'PUT',
        headers: { 'X-Idempotency-Key': createIdempotencyKey('start') },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
        notifyTransactionChat(updated, 'in_progress', undefined).catch(
          () => {},
        );
      } else {
        notify({ title: 'Failed to start transaction', variant: 'error' });
      }
    } catch (error) {
      console.error(error);
      notify({ title: 'Error starting transaction', variant: 'error' });
    }
  };

  const openDeliveryModal = (txn: Transaction) => {
    setActionNotice(null);
    setDeliveryTxn(txn);
    setDeliveryTitle('');
    setDeliveryNote('');
    setDeliveryAttachmentsText('');
    setDeliveryError(null);
  };

  const closeDeliveryModal = () => {
    if (deliverySubmitting) return;
    setDeliveryTxn(null);
    setDeliveryTitle('');
    setDeliveryNote('');
    setDeliveryAttachmentsText('');
    setDeliveryError(null);
  };

  const submitDelivery = async () => {
    if (!deliveryTxn) return;
    const attachments = parseReferenceLines(deliveryAttachmentsText);
    if (!deliveryNote.trim() && attachments.length === 0) {
      setDeliveryError(
        locale === 'id'
          ? 'Tambahkan catatan hasil kerja atau minimal satu link bukti.'
          : 'Add a delivery note or at least one proof link.',
      );
      return;
    }

    setDeliverySubmitting(true);
    setDeliveryError(null);
    try {
      const res = await authFetch(
        `/api/transactions/${deliveryTxn.id}/deliver`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': createIdempotencyKey(
              `deliver-${deliveryTxn.id}`,
            ),
          },
          body: JSON.stringify({
            delivery_title: deliveryTitle.trim() || undefined,
            delivery_note: deliveryNote.trim() || undefined,
            delivery_attachments: attachments,
            response_message: deliveryNote.trim() || undefined,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorPayload = payload as { error?: string; code?: string };
        throw new Error(
          errorPayload.code === 'delivery_attempt_limit_reached'
            ? locale === 'id'
              ? 'Batas habis. Kalau masih keberatan, masuk review support.'
              : 'The delivery limit has been reached. If the buyer still disagrees, the order will move to support review.'
            : errorPayload.error ||
                (locale === 'id'
                  ? 'Gagal mengirim hasil kerja.'
                  : 'Failed to submit the delivery package.'),
        );
      }

      const updated = payload as Transaction;
      setTransactions(prev =>
        prev.map(txn => (txn.id === deliveryTxn.id ? updated : txn)),
      );
      notifyTransactionChat(
        updated,
        'delivered',
        deliveryNote.trim() || deliveryTitle.trim() || undefined,
      ).catch(() => {});
      setActionNotice(
        locale === 'id'
          ? 'Hasil kerja dikirim. Buyer bisa terima atau minta revisi.'
          : 'The delivery package was sent. The buyer can now accept it or request a revision.',
      );
      setDeliveryTxn(null);
      setDeliveryTitle('');
      setDeliveryNote('');
      setDeliveryAttachmentsText('');
      setDeliveryError(null);
    } catch (error) {
      setDeliveryError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal mengirim hasil kerja.'
            : 'Failed to submit the delivery package.',
      );
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const openDeliveryReviewModal = (
    txn: Transaction,
    decision: 'accept' | 'request_revision',
  ) => {
    setActionNotice(null);
    setDeliveryReviewTxn(txn);
    setDeliveryReviewDecision(decision);
    setDeliveryReviewNote('');
    setDeliveryReviewAttachmentsText('');
    setDeliveryReviewError(null);
  };

  const closeDeliveryReviewModal = () => {
    if (deliveryReviewSubmitting) return;
    setDeliveryReviewTxn(null);
    setDeliveryReviewDecision('accept');
    setDeliveryReviewNote('');
    setDeliveryReviewAttachmentsText('');
    setDeliveryReviewError(null);
  };

  const submitDeliveryReview = async () => {
    if (!deliveryReviewTxn) return;
    const attachments = parseReferenceLines(deliveryReviewAttachmentsText);
    if (
      deliveryReviewDecision === 'request_revision' &&
      !deliveryReviewNote.trim()
    ) {
      setDeliveryReviewError(
        locale === 'id'
          ? 'Tulis revisi yang diminta.'
          : 'Explain the requested revision so the seller has clear guidance.',
      );
      return;
    }

    setDeliveryReviewSubmitting(true);
    setDeliveryReviewError(null);
    try {
      const res = await authFetch(
        `/api/transactions/${deliveryReviewTxn.id}/delivery-review`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': createIdempotencyKey(
              `delivery-review-${deliveryReviewTxn.id}`,
            ),
          },
          body: JSON.stringify({
            decision: deliveryReviewDecision,
            evidence_note: deliveryReviewNote.trim() || undefined,
            evidence_attachments: attachments,
            response_message: deliveryReviewNote.trim() || undefined,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            (locale === 'id'
              ? 'Gagal memproses review hasil kerja.'
              : 'Failed to process the delivery review.'),
        );
      }

      const updated = payload as Transaction;
      setTransactions(prev =>
        prev.map(txn => (txn.id === deliveryReviewTxn.id ? updated : txn)),
      );
      notifyTransactionChat(
        updated,
        updated.status,
        deliveryReviewNote.trim() || undefined,
      ).catch(() => {});
      setActionNotice(
        deliveryReviewDecision === 'accept'
          ? locale === 'id'
            ? 'Hasil kerja diterima dan transaksi selesai.'
            : 'The delivery was accepted and the transaction is now complete.'
          : updated.status === 'disputed'
            ? locale === 'id'
              ? 'Batas tercapai. Order masuk review support.'
              : 'The delivery limit was reached. The order has been auto-escalated to support review with the evidence collected so far.'
            : locale === 'id'
              ? 'Permintaan revisi dikirim. Seller bisa kirim revisi baru.'
              : 'The revision request was sent. The seller can now submit a revised delivery package.',
      );
      setDeliveryReviewTxn(null);
      setDeliveryReviewDecision('accept');
      setDeliveryReviewNote('');
      setDeliveryReviewAttachmentsText('');
      setDeliveryReviewError(null);
    } catch (error) {
      setDeliveryReviewError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal memproses review hasil kerja.'
            : 'Failed to process the delivery review.',
      );
    } finally {
      setDeliveryReviewSubmitting(false);
    }
  };

  const openCancelModal = (txn: Transaction) => {
    setActionNotice(null);
    setCancelTxn(txn);
    setCancelReasonCode('buyer_changed_mind');
    setCancelMessage('');
    setCancelError(null);
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelTxn(null);
    setCancelReasonCode('buyer_changed_mind');
    setCancelMessage('');
    setCancelError(null);
  };

  const submitCancel = async () => {
    if (!cancelTxn) return;
    if (!cancelReasonCode.trim()) {
      setCancelError(
        locale === 'id'
          ? 'Pilih alasan pembatalan.'
          : 'Choose a cancellation reason.',
      );
      return;
    }

    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await authFetch(`/api/transactions/${cancelTxn.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey('cancel'),
        },
        body: JSON.stringify({
          response_message: cancelMessage.trim() || undefined,
          reason_code: cancelReasonCode,
        }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            (locale === 'id'
              ? 'Gagal membatalkan transaksi.'
              : 'Failed to cancel transaction.'),
        );
      }

      const updated = payload as Transaction;
      setTransactions(prev =>
        prev.map(txn => (txn.id === cancelTxn.id ? updated : txn)),
      );
      notifyTransactionChat(
        updated,
        'cancelled',
        cancelMessage.trim() || undefined,
      ).catch(() => {});
      setActionNotice(
        locale === 'id'
          ? 'Pembatalan terkirim dan tercatat.'
          : 'The cancellation was submitted and recorded in transaction history.',
      );
      setCancelTxn(null);
      setCancelReasonCode('buyer_changed_mind');
      setCancelMessage('');
      setCancelError(null);
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal membatalkan transaksi.'
            : 'Failed to cancel transaction.',
      );
    } finally {
      setCancelSubmitting(false);
    }
  };

  const openCounterOfferModal = (txn: Transaction) => {
    setActionNotice(null);
    setCounterOfferTxn(txn);
    setCounterOfferAmount(
      String(Math.max(0, Math.floor(Number(txn.amount_cents || 0) / 100))),
    );
    setCounterOfferMessage('');
    setCounterOfferError(null);
  };

  const closeCounterOfferModal = () => {
    if (counterOfferSubmitting) return;
    setCounterOfferTxn(null);
    setCounterOfferAmount('');
    setCounterOfferMessage('');
    setCounterOfferError(null);
  };

  const submitCounterOffer = async () => {
    if (!counterOfferTxn) return;

    const normalizedAmount = counterOfferAmount.replace(/\D/g, '');
    const amountUnits = Number(normalizedAmount);
    if (!Number.isFinite(amountUnits) || amountUnits <= 0) {
      setCounterOfferError(
        locale === 'id'
          ? 'Masukkan nominal counter offer yang valid.'
          : 'Enter a valid counter offer amount.',
      );
      return;
    }

    const safetyChecklist =
      counterOfferTxn.safety_checklist &&
      Object.keys(counterOfferTxn.safety_checklist).length > 0
        ? counterOfferTxn.safety_checklist
        : {
            identity_confirmed: true,
            platform_payment_confirmed: true,
            item_detail_confirmed: true,
            anti_scam_acknowledged: true,
          };

    setCounterOfferSubmitting(true);
    setCounterOfferError(null);
    try {
      const res = await authFetch(
        `/api/transactions/${counterOfferTxn.id}/counter-offer`,
        {
          method: 'PUT',
          headers: {
            'X-Idempotency-Key': createIdempotencyKey(
              `counter-offer-${counterOfferTxn.id}`,
            ),
          },
          body: JSON.stringify({
            amount_cents: Math.floor(amountUnits * 100),
            currency: counterOfferTxn.currency || 'IDR',
            offer_message: counterOfferMessage.trim() || undefined,
            deal_kind: counterOfferTxn.deal_kind || undefined,
            fulfillment_mode: counterOfferTxn.fulfillment_mode || undefined,
            safety_checklist: safetyChecklist,
            risk_flags: counterOfferTxn.risk_flags || [],
            transaction_meta: {
              source: 'transactions_page_counter_offer',
              parent_transaction_id: counterOfferTxn.id,
            },
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorPayload = payload as { error?: string; code?: string };
        if (errorPayload.code === 'verification_required') {
          closeCounterOfferModal();
          openVerificationPrompt();
          return;
        }
        throw new Error(
          errorPayload.error ||
            (locale === 'id'
              ? 'Gagal mengirim counter offer.'
              : 'Failed to create a counter offer.'),
        );
      }

      const updated = payload as Transaction;
      setTransactions(prev => [
        updated,
        ...prev.filter(item => item.id !== updated.id),
      ]);
      notifyTransactionChat(
        updated,
        'pending',
        counterOfferMessage.trim()
          ? `Counter offer: ${counterOfferMessage.trim()}`
          : 'Counter offer',
      ).catch(() => {});
      setActionNotice(
        locale === 'id'
          ? 'Counter offer terkirim. Balas dari chat atau halaman ini.'
          : 'The counter offer was sent. The counterparty can continue from chat or this page.',
      );
      setCounterOfferTxn(null);
      setCounterOfferAmount('');
      setCounterOfferMessage('');
      setCounterOfferError(null);
    } catch (error) {
      setCounterOfferError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal mengirim counter offer.'
            : 'Failed to create a counter offer.',
      );
    } finally {
      setCounterOfferSubmitting(false);
    }
  };

  const openDisputeModal = (txn: Transaction) => {
    setActionNotice(null);
    setDisputeTxn(txn);
    setDisputeReasonCode('other');
    setDisputeMessage('');
    setDisputeEvidenceUrl('');
    setDisputeEvidenceContext('');
    setDisputeError(null);
  };

  const closeDisputeModal = () => {
    if (disputeSubmitting) return;
    setDisputeTxn(null);
    setDisputeReasonCode('other');
    setDisputeMessage('');
    setDisputeEvidenceUrl('');
    setDisputeEvidenceContext('');
    setDisputeError(null);
  };

  const submitDispute = async () => {
    if (!disputeTxn) return;
    if (!disputeMessage.trim()) {
      setDisputeError(
        locale === 'id'
          ? 'Tulis masalah utama dulu.'
          : 'Describe the main issue first.',
      );
      return;
    }

    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      const evidenceSource = [
        disputeTxn.id,
        disputeReasonCode,
        disputeMessage.trim(),
        disputeEvidenceUrl.trim(),
        disputeEvidenceContext.trim(),
      ].join('|');
      const evidenceHash = await sha256Hex(evidenceSource);
      const evidenceAttachment = disputeEvidenceUrl.trim()
        ? {
            evidence_type: 'external_reference',
            file_url: disputeEvidenceUrl.trim(),
            file_hash_sha256: evidenceHash,
            description: disputeEvidenceContext.trim() || disputeMessage.trim(),
          }
        : {
            evidence_type: 'self_report',
            external_ref: `transactions:self-report:${disputeTxn.id}:${Date.now()}`,
            file_hash_sha256: evidenceHash,
            description: disputeEvidenceContext.trim() || disputeMessage.trim(),
          };

      const res = await authFetch(
        `/api/transactions/${disputeTxn.id}/dispute`,
        {
          method: 'PUT',
          headers: {
            'X-Idempotency-Key': createIdempotencyKey(
              `dispute-${disputeTxn.id}`,
            ),
          },
          body: JSON.stringify({
            response_message: disputeMessage.trim(),
            evidence_note:
              disputeEvidenceContext.trim() || disputeMessage.trim(),
            reason_code: disputeReasonCode,
            evidence_attachments: [evidenceAttachment],
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            (locale === 'id'
              ? 'Gagal mengirim dispute.'
              : 'Failed to submit dispute.'),
        );
      }

      const updated = payload as Transaction;
      setTransactions(prev =>
        prev.map(txn => (txn.id === disputeTxn.id ? updated : txn)),
      );
      notifyTransactionChat(updated, 'disputed', disputeMessage.trim()).catch(
        () => {},
      );
      setActionNotice(
        locale === 'id'
          ? 'Dispute terkirim. Dana ditahan sambil bukti dicek.'
          : 'The dispute was submitted. Funds stay on hold while CRM reviews the timeline and evidence.',
      );
      setDisputeTxn(null);
      setDisputeReasonCode('other');
      setDisputeMessage('');
      setDisputeEvidenceUrl('');
      setDisputeEvidenceContext('');
      setDisputeError(null);
    } catch (error) {
      setDisputeError(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal mengirim dispute.'
            : 'Failed to submit dispute.',
      );
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const selectedPaymentOption = useMemo(
    () =>
      availablePaymentOptions.find(
        option => option.id === selectedPaymentOptionId,
      ) ||
      availablePaymentOptions[0] ||
      null,
    [availablePaymentOptions, selectedPaymentOptionId],
  );

  const latestPaymentInstruction = useMemo(
    () => extractPaymentInstructionView(latestTopup),
    [latestTopup],
  );
  const selectedPaymentUsesWalletBalance =
    selectedPaymentOption?.usesWalletBalance === true;
  const walletBalanceSummary = paymentTxn
    ? formatPrice(walletAvailableBalanceCents, paymentCurrency)
    : '-';
  const walletHeldSummary = paymentTxn
    ? formatPrice(
        Number(paymentWalletAccount?.held_balance_cents || 0),
        paymentCurrency,
      )
    : '-';
  const walletShortfallSummary =
    paymentTxn && walletShortfallCents > 0
      ? formatPrice(walletShortfallCents, paymentCurrency)
      : '';
  const rewardCoinDiscountSummary =
    paymentTxn && rewardCoinDiscountCents > 0
      ? formatPrice(rewardCoinDiscountCents, paymentCurrency)
      : '';
  const paymentDueAfterCoinsSummary = paymentTxn
    ? formatPrice(paymentDueAfterCoinsCents, paymentCurrency)
    : '-';
  const paymentActionDisabled =
    submittingPayment ||
    syncingTopupStatus ||
    !selectedPaymentOption ||
    (selectedPaymentUsesWalletBalance && loadingWalletBalances) ||
    (selectedPaymentUsesWalletBalance &&
      !loadingWalletBalances &&
      !canPayWithWalletBalance);
  const paymentActionLabel = submittingPayment
    ? selectedPaymentUsesWalletBalance
      ? locale === 'id'
        ? 'Memproses saldo wallet...'
        : 'Processing wallet balance...'
      : locale === 'id'
        ? 'Membuat instruksi bayar...'
        : 'Creating payment...'
    : selectedPaymentUsesWalletBalance && loadingWalletBalances
      ? locale === 'id'
        ? 'Mengecek saldo wallet...'
        : 'Checking wallet balance...'
      : selectedPaymentUsesWalletBalance
        ? locale === 'id'
          ? 'Bayar pakai saldo wallet'
          : 'Pay with wallet balance'
        : locale === 'id'
          ? 'Lanjut bayar'
          : 'Continue to payment';

  const copyToClipboard = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setPaymentInfo('Data pembayaran disalin ke clipboard.');
    } catch {
      setPaymentError('Gagal copy ke clipboard. Silakan copy manual.');
    }
  }, []);

  const hydratePendingTopupForTransaction = useCallback(
    async (txn: Transaction) => {
      const environment = resolveWalletEnvironment(txn);
      setRestoringPendingTopup(true);
      try {
        const params = new URLSearchParams({
          environment,
          status: 'pending',
          limit: '25',
          offset: '0',
        });
        const res = await authFetch(`/api/wallet/topups?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await res
          .json()
          .catch(() => ({}))) as WalletTopupListResponse;
        if (!res.ok) return;

        const items = Array.isArray(payload.items) ? payload.items : [];
        const txnCurrency = asString(txn.currency || 'IDR').toUpperCase();
        const matched = items.find(item => {
          if (!item || typeof item !== 'object') return false;
          if (readTopupLinkedTransactionId(item) !== txn.id) return false;
          const topupAmount = Number(item.amount_cents || 0);
          const originalAmount = readTopupOriginalTransactionAmount(item);
          if (
            topupAmount !== txn.amount_cents &&
            originalAmount !== txn.amount_cents
          ) {
            return false;
          }
          const itemCurrency = asString(
            item.currency || txnCurrency,
          ).toUpperCase();
          return itemCurrency === txnCurrency;
        });
        if (!matched) return;

        setLatestTopup(matched);
        setLatestCheckoutUrl(matched.checkout_url || null);

        const matchedMethod = asString(matched.payment_method).toLowerCase();
        const matchedProvider = asString(
          matched.payment_provider,
        ).toLowerCase();
        const matchedOption =
          PAYMENT_OPTIONS.find(
            option =>
              option.provider === matchedProvider &&
              asString(option.method || '').toLowerCase() === matchedMethod,
          ) ||
          PAYMENT_OPTIONS.find(option => option.provider === matchedProvider);
        if (matchedOption) {
          setSelectedPaymentOptionId(matchedOption.id);
        }

        setPaymentInfo(
          'Ada top-up pending. Lanjutkan dari instruksi yang tersedia.',
        );
      } catch (error) {
        console.error(error);
      } finally {
        setRestoringPendingTopup(false);
      }
    },
    [authFetch],
  );

  const openPaymentModal = useCallback((txn: Transaction) => {
    setPaymentTxn(txn);
    setSyncingTopupStatus(false);
    setRestoringPendingTopup(false);
    setPaymentError(null);
    setPaymentInfo(null);
    setWalletBalances(null);
    setWalletBalanceError(null);
    setLatestCheckoutUrl(null);
    setLatestTopup(null);
    paymentOptionAutoResolvedForTxnRef.current = null;
    setSelectedPaymentOptionId(WALLET_BALANCE_PAYMENT_OPTION_ID);
  }, []);

  useEffect(() => {
    if (!paymentTxn) return;
    void hydratePendingTopupForTransaction(paymentTxn);
  }, [hydratePendingTopupForTransaction, paymentTxn]);

  const closePaymentModal = () => {
    if (submittingPayment || syncingTopupStatus || restoringPendingTopup)
      return;
    setPaymentTxn(null);
    setSyncingTopupStatus(false);
    setRestoringPendingTopup(false);
    setPaymentError(null);
    setPaymentInfo(null);
    setWalletBalanceError(null);
    setWalletBalances(null);
    setRewardBalanceError(null);
    setRewardBalance(null);
    setUseCoinsForPayment(true);
    setLatestCheckoutUrl(null);
    setLatestTopup(null);
    paymentOptionAutoResolvedForTxnRef.current = null;
    setSelectedPaymentOptionId(WALLET_BALANCE_PAYMENT_OPTION_ID);
  };

  const syncLatestTopupStatus = useCallback(
    async (silent = false) => {
      const topupId = asString(latestTopup?.id);
      if (!topupId || syncingTopupStatus) return;

      setSyncingTopupStatus(true);
      if (!silent) {
        setPaymentError(null);
      }

      try {
        const res = await authFetch(
          `/api/wallet/topups/${encodeURIComponent(topupId)}/sync`,
          {
            method: 'POST',
            headers: {
              'X-Idempotency-Key': createIdempotencyKey(
                `txn-topup-sync-${topupId}`,
              ),
            },
          },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          synced?: boolean;
          reason?: string;
          topup?: WalletTopupLite;
        };
        if (!res.ok) {
          throw new Error(
            payload.error || 'Gagal sinkronisasi status pembayaran',
          );
        }

        const syncedTopup = payload.topup || null;
        if (syncedTopup) {
          setLatestTopup(syncedTopup);
          setLatestCheckoutUrl(syncedTopup.checkout_url || null);
        }

        const normalizedTopupStatus = asString(
          syncedTopup?.status,
        ).toLowerCase();
        if (normalizedTopupStatus === 'paid') {
          setPaymentInfo('Pembayaran terkonfirmasi. Dana masuk proteksi.');
          await loadTransactions();
          await loadWalletBalances();
          await loadRewardBalance();
          return;
        }

        if (!silent) {
          setPaymentInfo(
            payload.synced
              ? 'Status top-up berhasil diperbarui dari Midtrans.'
              : `Status belum berubah (${payload.reason || 'masih pending'}).`,
          );
        }
      } catch (error) {
        if (!silent) {
          setPaymentError(
            error instanceof Error
              ? error.message
              : 'Gagal sinkronisasi status pembayaran',
          );
        }
      } finally {
        setSyncingTopupStatus(false);
      }
    },
    [
      authFetch,
      latestTopup?.id,
      loadRewardBalance,
      loadTransactions,
      loadWalletBalances,
      syncingTopupStatus,
    ],
  );

  useEffect(() => {
    const topupId = asString(latestTopup?.id);
    const topupStatus = asString(latestTopup?.status).toLowerCase();
    const topupProvider = asString(latestTopup?.payment_provider).toLowerCase();
    if (!paymentTxn || !topupId) return;
    if (topupStatus !== 'pending' || topupProvider !== 'midtrans') return;

    const timer = window.setInterval(() => {
      void syncLatestTopupStatus(true);
    }, 9000);

    return () => window.clearInterval(timer);
  }, [
    latestTopup?.id,
    latestTopup?.payment_provider,
    latestTopup?.status,
    paymentTxn,
    syncLatestTopupStatus,
  ]);

  const handleCreateTransactionPayment = async () => {
    if (!paymentTxn) return;

    const selectedOption =
      availablePaymentOptions.find(
        option => option.id === selectedPaymentOptionId,
      ) || availablePaymentOptions[0];

    if (!selectedOption) {
      setPaymentError('Metode pembayaran tidak tersedia.');
      return;
    }

    const environment = resolveWalletEnvironment(paymentTxn);

    setSubmittingPayment(true);
    setPaymentError(null);
    setPaymentInfo(null);

    try {
      if (selectedOption.usesWalletBalance) {
        const res = await authFetch(`/api/transactions/${paymentTxn.id}/fund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': createIdempotencyKey(
              `txn-fund-${paymentTxn.id}-${rewardCoinsApplied}`,
            ),
          },
          body: JSON.stringify({
            payment_method: 'wallet_balance',
            use_coins: rewardCoinsApplied > 0,
            coin_amount: rewardCoinsApplied,
            coin_discount_cents: rewardCoinDiscountCents,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as Transaction & {
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          if (payload.code === 'insufficient_wallet_balance') {
            throw new Error(
              locale === 'id'
                ? 'Saldo wallet belum cukup. Pilih metode lain atau top-up dulu.'
                : 'Your wallet balance is insufficient. Choose another method or top up first.',
            );
          }
          throw new Error(
            payload.error ||
              (locale === 'id'
                ? 'Gagal membayar transaksi dengan saldo wallet.'
                : 'Failed to fund the transaction from wallet balance.'),
          );
        }

        const updated = payload as Transaction;
        setTransactions(prev =>
          prev.map(txn => (txn.id === updated.id ? updated : txn)),
        );
        setPaymentTxn(updated);
        setLatestCheckoutUrl(null);
        setLatestTopup(null);
        setPaymentInfo(
          locale === 'id'
            ? rewardCoinsApplied > 0
              ? `Pembayaran berhasil. ${rewardCoinsApplied} koin dipakai dan dana masuk escrow.`
              : 'Pembayaran wallet berhasil. Dana masuk escrow.'
            : rewardCoinsApplied > 0
              ? `Payment succeeded. ${rewardCoinsApplied} coins were used and funds are now held.`
              : 'Wallet balance payment succeeded. Funds are now held for this transaction.',
        );
        await loadWalletBalances();
        await loadRewardBalance();
        return;
      }

      setLatestTopup(null);
      const res = await authFetch('/api/wallet/topups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey(
            `txn-topup-${paymentTxn.id}-${selectedOption.id}-${rewardCoinsApplied}-${paymentDueAfterCoinsCents}`,
          ),
        },
        body: JSON.stringify({
          amount_cents: paymentDueAfterCoinsCents,
          currency: (paymentTxn.currency || 'IDR').toUpperCase(),
          environment,
          payment_provider: selectedOption.provider,
          payment_method: selectedOption.method || undefined,
          description: `Funding transaction ${paymentTxn.id}`,
          metadata: {
            transaction_id: paymentTxn.id,
            source: 'transactions_modal',
            payment_option: selectedOption.id,
            original_amount_cents: paymentTxn.amount_cents,
            payment_due_after_reward_cents: paymentDueAfterCoinsCents,
            reward_coin_amount: rewardCoinsApplied,
            reward_coin_discount_cents: rewardCoinDiscountCents,
            reward_coin_value_cents: rewardCoinValueCents,
          },
          auto_settle:
            environment === 'development' && selectedOption.provider === 'mock',
        }),
      });

      const payload = (await res
        .json()
        .catch(() => ({}))) as CreateTopupResponse;
      if (!res.ok)
        throw new Error(payload.error || 'Gagal membuat pembayaran transaksi');

      const topup = payload.topup;
      const checkoutUrl = topup?.checkout_url || null;

      setLatestCheckoutUrl(checkoutUrl);
      setLatestTopup(topup || null);

      if (topup?.status === 'paid') {
        setPaymentInfo(
          rewardCoinsApplied > 0
            ? `Pembayaran terkonfirmasi. ${rewardCoinsApplied} koin dipakai dan dana ditahan aman.`
            : 'Pembayaran terkonfirmasi. Dana ditahan aman.',
        );
        await loadTransactions();
        await loadWalletBalances();
        await loadRewardBalance();
        return;
      }

      if (payload.reused_pending_topup) {
        setPaymentInfo(
          'Instruksi pembayaran masih aktif. Lanjut dari tombol bayar.',
        );
        return;
      }

      if (checkoutUrl) {
        setPaymentInfo(
          'Instruksi pembayaran sudah siap. Lanjutkan ke halaman bayar sekarang.',
        );
      } else {
        setPaymentInfo('Instruksi siap. Ikuti langkah, lalu cek status.');
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Gagal memproses pembayaran transaksi',
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const buildTransactionActions = (
    txn: Transaction,
  ): TransactionCardAction[] => {
    const status = resolveTxnStatus(txn);
    const isBuyer = Boolean(
      user?.id && normalizeId(txn.buyer_id) === normalizeId(user.id),
    );
    const isSeller = Boolean(
      user?.id && normalizeId(txn.seller_id) === normalizeId(user.id),
    );
    const canOpenPayment = canUserOpenPayment(txn, user?.id);

    const primary: TransactionCardAction[] = [];
    const secondary: TransactionCardAction[] = [];
    const utility: TransactionCardAction[] = [];

    const appendUnique = (
      bucket: TransactionCardAction[],
      action: TransactionCardAction,
    ) => {
      if (
        primary.some(item => item.key === action.key) ||
        secondary.some(item => item.key === action.key) ||
        utility.some(item => item.key === action.key)
      ) {
        return;
      }
      bucket.push(action);
    };

    if (canOpenPayment) {
      appendUnique(primary, {
        key: 'pay',
        label: locale === 'id' ? 'Bayar sekarang' : 'Pay now',
        tone: 'primary',
        Icon: CreditCard,
        onClick: () => openPaymentModal(txn),
      });
    }

    if (isSeller && status === 'pending') {
      appendUnique(primary, {
        key: 'accept',
        label: locale === 'id' ? 'Terima order' : 'Accept order',
        tone: 'primary',
        Icon: Handshake,
        onClick: () => void handleAccept(txn.id),
      });
      appendUnique(secondary, {
        key: 'decline',
        label: locale === 'id' ? 'Tolak' : 'Decline',
        tone: 'danger',
        Icon: Ban,
        onClick: () => openCancelModal(txn),
      });
    }

    if (isSeller && status === 'accepted') {
      appendUnique(primary, {
        key: 'start',
        label: locale === 'id' ? 'Mulai order' : 'Start order',
        tone: 'primary',
        Icon: Rocket,
        onClick: () => void handleStart(txn.id),
      });
    }

    if (isSeller && status === 'in_progress') {
      appendUnique(primary, {
        key: 'deliver',
        label: locale === 'id' ? 'Kirim hasil' : 'Submit delivery',
        tone: 'primary',
        Icon: Truck,
        onClick: () => openDeliveryModal(txn),
      });
    }

    if (isBuyer && status === 'delivered') {
      appendUnique(primary, {
        key: 'accept-delivery',
        label: locale === 'id' ? 'Terima hasil' : 'Accept delivery',
        tone: 'primary',
        Icon: CheckCircle2,
        onClick: () => openDeliveryReviewModal(txn, 'accept'),
      });
      appendUnique(secondary, {
        key: 'request-revision',
        label: locale === 'id' ? 'Minta revisi' : 'Request revision',
        tone: 'subtle',
        Icon: RefreshCcw,
        onClick: () => openDeliveryReviewModal(txn, 'request_revision'),
      });
    }

    if (status === 'completed') {
      appendUnique(primary, {
        key: 'review',
        label: locale === 'id' ? 'Beri ulasan' : 'Leave review',
        tone: 'primary',
        Icon: CheckCircle2,
        href: `/transactions/${txn.id}/review`,
      });
    }

    appendUnique(primary.length === 0 ? primary : secondary, {
      key: 'chat',
      label: locale === 'id' ? 'Chat order' : 'Order chat',
      tone: primary.length === 0 ? 'primary' : 'secondary',
      Icon: MessageSquareText,
      onClick: () => void handleOpenChat(txn),
    });

    if (status === 'pending' && (isSeller || isBuyer)) {
      appendUnique(secondary, {
        key: 'counter-offer',
        label: locale === 'id' ? 'Ubah penawaran' : 'Counter offer',
        tone: 'subtle',
        Icon: Handshake,
        onClick: () => openCounterOfferModal(txn),
      });
    }

    if (
      (status === 'pending' && !isSeller) ||
      status === 'accepted' ||
      status === 'in_progress'
    ) {
      appendUnique(secondary, {
        key: 'cancel',
        label: locale === 'id' ? 'Batalkan' : 'Cancel',
        tone: 'danger',
        Icon: Ban,
        onClick: () => openCancelModal(txn),
      });
    }

    if (
      status === 'accepted' ||
      status === 'in_progress' ||
      status === 'delivered'
    ) {
      appendUnique(secondary, {
        key: 'dispute',
        label: locale === 'id' ? 'Laporkan masalah' : 'Open dispute',
        tone: 'subtle',
        Icon: AlertTriangle,
        onClick: () => openDisputeModal(txn),
      });
    }

    appendUnique(utility, {
      key: 'support',
      label: locale === 'id' ? 'Bantuan' : 'Support',
      tone: 'secondary',
      Icon: AlertTriangle,
      href: '/support',
    });

    appendUnique(utility, {
      key: 'listing',
      label: locale === 'id' ? 'Lihat listing' : 'Open listing',
      tone: 'secondary',
      Icon: ExternalLink,
      href: `/content/${txn.content_id}`,
    });

    return [...primary, ...secondary, ...utility];
  };
  if (loading) {
    return <TransactionPageSkeleton />;
  }

  return (
    <div className="min-h-[100svh] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="ui-page-stack mx-auto w-full max-w-[var(--app-max-width)] px-0 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="ui-feed-section overflow-hidden rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-3xl sm:border-x sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {locale === 'id' ? 'Transaksi' : 'Transactions'}
              </h1>
              <p className="mt-0.5 text-xs text-[color:var(--app-text)]">
                {locale === 'id'
                  ? 'Cek status. Lanjut aksi.'
                  : 'See the status and continue the important step.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadTransactions()}
              disabled={refreshingTransactions}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
            >
              <RefreshCcw
                className={`h-4 w-4 ${refreshingTransactions ? 'animate-spin' : ''}`}
              />
              {locale === 'id' ? 'Muat ulang' : 'Refresh'}
            </button>
          </div>
        </section>

        {transactionsError && transactions.length > 0 ? (
          <div className="ui-feed-section mt-0 sm:mt-4 rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-danger-border)_35%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_8%,_transparent)] px-4 py-3 text-sm text-[color:var(--app-danger)] sm:rounded-2xl sm:border-x">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">{transactionsError}</p>
              <button
                type="button"
                onClick={() => void loadTransactions()}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_45%,_transparent)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)] transition hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)]"
              >
                <RefreshCcw className="h-4 w-4" />
                {locale === 'id' ? 'Coba lagi' : 'Try again'}
              </button>
            </div>
          </div>
        ) : null}

        {actionNotice ? (
          <div className="ui-feed-section mt-0 sm:mt-4 rounded-none border border-x-0 border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-3 text-sm font-medium text-[color:var(--app-text)] sm:rounded-2xl sm:border-x">
            {actionNotice}
          </div>
        ) : null}

        <section className="ui-feed-section mt-0 rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] px-4 py-3 sm:mt-4 sm:rounded-2xl sm:border-x sm:px-5">
          <div className="flex flex-wrap gap-2">
            {transactionFilters.map(option => {
              const active = listFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setListFilter(option.value)}
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                    active
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold dark:bg-white/10">
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="ui-page-section mt-0 space-y-3 sm:mt-4">
          {orderedTransactions.length === 0 ? (
            transactionsError ? (
              <div className="ui-feed-section rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-danger-border)_35%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_8%,_transparent)] p-6 text-center text-sm text-[color:var(--app-danger)] sm:rounded-2xl sm:border-x">
                <p className="font-semibold">{transactionsError}</p>
                <button
                  type="button"
                  onClick={() => void loadTransactions()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_45%,_transparent)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)] transition hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {locale === 'id' ? 'Coba lagi' : 'Try again'}
                </button>
              </div>
            ) : (
              <div className="ui-feed-section rounded-none border border-x-0 border-dashed border-[color:var(--app-border)] p-6 text-center text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] sm:rounded-2xl sm:border-x">
                {locale === 'id'
                  ? 'Belum ada transaksi. Mulai dari chat atau listing.'
                  : 'No transactions yet. Start from a listing or chat and all orders will gather here.'}
              </div>
            )
          ) : visibleTransactions.length === 0 ? (
            <div className="ui-feed-section rounded-none border border-x-0 border-dashed border-[color:var(--app-border)] p-6 text-center text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] sm:rounded-2xl sm:border-x">
              {locale === 'id'
                ? 'Tidak ada transaksi di filter ini.'
                : 'No transactions in this filter.'}
            </div>
          ) : (
            visibleTransactions.map(txn => {
              const status = resolveTxnStatus(txn);
              const statusM = statusMeta(status);

              const { title: snapshotTitle } = resolveSnapshot(txn);
              const snapshotImage = resolveTransactionVisual(txn);
              const counterparty = resolveCounterparty(txn, user?.id, locale);

              const updatedLabel = formatTransactionListDate(
                txn.updated_at || txn.created_at,
                locale,
              );
              const isFocused = focusTransactionId === txn.id;
              const headline = resolveTransactionHeadline(
                txn,
                user?.id,
                locale,
              );
              const progress = resolveTransactionProgress(
                txn,
                user?.id,
                locale,
              );
              const cardActions = prioritizeTransactionActions(
                buildTransactionActions(txn).filter(
                  action =>
                    action.key !== 'support' && action.key !== 'listing',
                ),
              ).slice(0, 1);

              return (
                <article
                  key={txn.id}
                  id={`transaction-card-${txn.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailTxn(txn)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setDetailTxn(txn);
                    }
                  }}
                  className={`ui-feed-row relative cursor-pointer overflow-hidden rounded-none border border-x-0 bg-[color:var(--app-surface-strong)] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_28%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-2xl sm:border-x sm:p-4 ${
                    isFocused
                      ? 'border-[color:var(--app-accent-border)] ring-2 ring-[color:color-mix(in_srgb,_var(--app-accent)_25%,_transparent)]'
                      : 'border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)]'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-1.5 opacity-80 ${statusM.accentClass}`}
                  />

                  <div className="grid min-w-0 gap-3 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center">
                    <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 sm:contents">
                      <div className="relative h-[76px] w-[76px] overflow-hidden rounded-2xl bg-[color:var(--app-surface-muted)] sm:h-[92px] sm:w-[92px]">
                        {snapshotImage ? (
                          <Image
                            src={snapshotImage}
                            alt={snapshotTitle}
                            fill
                            unoptimized
                            sizes="92px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[color:var(--app-accent)]">
                            <Package className="h-7 w-7" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip meta={statusM} label={humanize(status)} />
                          {isFocused ? (
                            <span className="inline-flex items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)]">
                              {locale === 'id' ? 'Notifikasi' : 'Notification'}
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                          {snapshotTitle}
                        </h2>

                        <div className="mt-2 flex min-w-0 items-center gap-2">
                          <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--app-accent-soft)] text-[11px] font-black text-[color:var(--app-accent)]">
                            <Image
                              src={profileAvatarSrc(counterparty.avatar)}
                              alt={counterparty.name}
                              fill
                              unoptimized
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {counterparty.name}
                            </span>
                            <span className="block truncate text-[11px] text-[color:var(--app-text-soft)]">
                              {counterparty.role} - {updatedLabel}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:block sm:min-w-[160px] sm:text-right">
                      <div>
                        <p className="text-base font-black text-[color:var(--app-accent)]">
                          {formatPrice(txn.amount_cents, txn.currency)}
                        </p>
                      </div>

                      <div
                        className="shrink-0 sm:mt-3"
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                      >
                        {cardActions.map(action => {
                          const ActionIcon = action.Icon;
                          const className = `inline-flex min-h-[38px] items-center justify-center gap-2 rounded-2xl px-3 text-[12px] font-semibold transition ${getTransactionActionClass(action.tone)}`;

                          if (action.href) {
                            return (
                              <Link
                                key={`${txn.id}-${action.key}`}
                                href={action.href}
                                className={className}
                              >
                                <ActionIcon className="h-4 w-4" />
                                {action.label}
                              </Link>
                            );
                          }

                          return (
                            <button
                              key={`${txn.id}-${action.key}`}
                              type="button"
                              onClick={action.onClick}
                              className={className}
                            >
                              <ActionIcon className="h-4 w-4" />
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[color:var(--app-border)] pt-3 dark:border-[color:var(--app-border-strong)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="line-clamp-1 min-w-0 text-xs font-semibold text-[color:var(--app-text)]">
                        {headline}
                      </p>
                      <span className="shrink-0 text-xs font-black text-[color:var(--app-accent)]">
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--app-accent)]"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Tekan kartu untuk detail'
                        : 'Tap card for details'}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <TransactionVerificationPromptModal
        open={Boolean(verificationPrompt)}
        locale={locale}
        prompt={verificationPrompt}
        onClose={() => setVerificationPrompt(null)}
        onOpenVerification={() => {
          const shouldOpenPhoneVerification = Boolean(
            verificationPrompt?.hasPhone && !verificationPrompt.phoneReady,
          );
          setVerificationPrompt(null);
          router.push(
            shouldOpenPhoneVerification
              ? `/${locale}${PHONE_VERIFICATION_SETTINGS_PATH}`
              : `/${locale}/profile/edit`,
          );
        }}
        onOpenProfile={() => {
          setVerificationPrompt(null);
          router.push(`/${locale}/profile`);
        }}
      />

      <Modal
        open={Boolean(detailTxn)}
        onClose={() => setDetailTxn(null)}
        title={locale === 'id' ? 'Ringkasan transaksi' : 'Transaction summary'}
        className="sm:max-w-xl"
        footer={
          detailTxn ? (
            <>
              {prioritizeTransactionActions(buildTransactionActions(detailTxn))
                .slice(0, 3)
                .map(action => {
                  const ActionIcon = action.Icon;
                  const className = `inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl px-3 text-[13px] font-semibold transition ${getTransactionActionClass(action.tone)}`;

                  if (action.href) {
                    return (
                      <Link
                        key={`detail-${detailTxn.id}-${action.key}`}
                        href={action.href}
                        className={className}
                        onClick={() => setDetailTxn(null)}
                      >
                        <ActionIcon className="h-4 w-4" />
                        {action.label}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={`detail-${detailTxn.id}-${action.key}`}
                      type="button"
                      onClick={() => {
                        setDetailTxn(null);
                        action.onClick?.();
                      }}
                      className={className}
                    >
                      <ActionIcon className="h-4 w-4" />
                      {action.label}
                    </button>
                  );
                })}
            </>
          ) : undefined
        }
      >
        {detailTxn ? (
          <div className="space-y-4">
            {(() => {
              const status = resolveTxnStatus(detailTxn);
              const statusM = statusMeta(status);
              const fundsChip = resolveTransactionFundsChip(detailTxn, locale);
              const { title: snapshotTitle } = resolveSnapshot(detailTxn);
              const snapshotImage = resolveTransactionVisual(detailTxn);
              const counterparty = resolveCounterparty(
                detailTxn,
                user?.id,
                locale,
              );
              const guidance = resolveTransactionGuidance(
                detailTxn,
                user?.id,
                locale,
              );
              const progress = resolveTransactionProgress(
                detailTxn,
                user?.id,
                locale,
              );
              const metaSummary = [
                humanize(detailTxn.deal_kind || ''),
                humanize(detailTxn.fulfillment_mode || ''),
              ].filter(part => part && part !== '-');

              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-[128px_minmax(0,1fr)]">
                    <div className="relative h-[128px] overflow-hidden rounded-2xl bg-[color:var(--app-surface-muted)]">
                      {snapshotImage ? (
                        <Image
                          src={snapshotImage}
                          alt={snapshotTitle}
                          fill
                          unoptimized
                          sizes="128px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[color:var(--app-accent)]">
                          <Package className="h-9 w-9" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Chip meta={statusM} label={humanize(status)} />
                        <Chip
                          meta={fundsChip.meta}
                          label={fundsChip.label}
                          size="xs"
                        />
                      </div>
                      <h3 className="mt-3 text-base font-black leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {snapshotTitle}
                      </h3>
                      <p className="mt-1 text-lg font-black text-[color:var(--app-accent)]">
                        {formatPrice(
                          detailTxn.amount_cents,
                          detailTxn.currency,
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--app-accent-soft)] text-xs font-black text-[color:var(--app-accent)]">
                          <Image
                            src={profileAvatarSrc(counterparty.avatar)}
                            alt={counterparty.name}
                            fill
                            unoptimized
                            sizes="40px"
                            className="object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {counterparty.name}
                          </p>
                          <p className="text-xs text-[color:var(--app-text-soft)]">
                            {counterparty.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[color:var(--app-text)]">
                          {progress.label}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                          {guidance}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-xs font-black text-[color:var(--app-accent)]">
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-strong)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--app-accent)] transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  <details className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[color:var(--app-text)]">
                      {locale === 'id'
                        ? 'Detail transaksi'
                        : 'Transaction detail'}
                      <span className="ml-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'opsional' : 'optional'}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        {[
                          [
                            locale === 'id' ? 'Order' : 'Order',
                            formatShortOrderId(detailTxn.id),
                          ],
                          [
                            locale === 'id' ? 'Update' : 'Updated',
                            formatTransactionListDate(
                              detailTxn.updated_at || detailTxn.created_at,
                              locale,
                            ),
                          ],
                          [
                            locale === 'id' ? 'Tipe' : 'Type',
                            metaSummary.join(' / ') || '-',
                          ],
                          [
                            locale === 'id' ? 'Listing' : 'Listing',
                            formatShortOrderId(detailTxn.content_id),
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={`${detailTxn.id}-${label}`}
                            className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                              {label}
                            </p>
                            <p className="mt-1 truncate font-semibold text-[color:var(--app-text)]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                          {locale === 'id' ? 'Alur' : 'Flow'}
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {progress.steps.map((step, index) => (
                            <div
                              key={`${detailTxn.id}-step-${step.label}`}
                              className="flex items-center gap-2 text-xs font-semibold text-[color:var(--app-text)]"
                            >
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                  step.state === 'done'
                                    ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                                    : step.state === 'current'
                                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                      : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="truncate">{step.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>

                  {detailTxn.offer_message || detailTxn.response_message ? (
                    <details className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Catatan negosiasi'
                          : 'Negotiation notes'}
                      </summary>
                      <div className="space-y-2 border-t border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                        {detailTxn.offer_message ? (
                          <p className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                            {detailTxn.offer_message}
                          </p>
                        ) : null}
                        {detailTxn.response_message ? (
                          <p className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                            {detailTxn.response_message}
                          </p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}

                  <details className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[color:var(--app-text)]">
                      {locale === 'id' ? 'Keamanan & bantuan' : 'Safety & help'}
                    </summary>
                    <p className="border-t border-[color:var(--app-border)] p-3 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                      {guidance}
                    </p>
                  </details>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deliveryTxn)}
        onClose={closeDeliveryModal}
        title={locale === 'id' ? 'Kirim Hasil Kerja' : 'Submit Delivery'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeDeliveryModal}
              disabled={deliverySubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              {locale === 'id' ? 'Nanti saja' : 'Maybe later'}
            </button>
            <button
              type="button"
              onClick={() => void submitDelivery()}
              disabled={deliverySubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[color:var(--app-group-talent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60 hover:bg-[color:var(--app-group-talent)]"
            >
              {deliverySubmitting
                ? locale === 'id'
                  ? 'Mengirim...'
                  : 'Submitting...'
                : locale === 'id'
                  ? 'Kirim Paket Hasil'
                  : 'Send Delivery Package'}
            </button>
          </div>
        }
      >
        {deliveryTxn ? (
          <div className="space-y-4">
            {(() => {
              const deliveryState = parseTransactionDelivery(
                deliveryTxn.transaction_meta,
              );
              const nextAttempt = Math.min(
                deliveryState.attemptsUsed + 1,
                deliveryState.maxAttempts,
              );
              return (
                <>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {resolveSnapshot(deliveryTxn).title}
                    </p>
                    <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? `Pengiriman ke-${nextAttempt}/${deliveryState.maxAttempts}. Buyer bisa terima atau minta revisi.`
                        : `This will be delivery ${nextAttempt}/${deliveryState.maxAttempts}. The buyer can accept it, request a revision, or it will escalate to support review if the limit is reached.`}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'Judul paket' : 'Package title'}
                    </label>
                    <input
                      type="text"
                      value={deliveryTitle}
                      onChange={event => setDeliveryTitle(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      placeholder={
                        locale === 'id'
                          ? 'Contoh: File final, source, dan link preview'
                          : 'Example: Final files, source, and preview links'
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Ringkasan hasil kerja'
                        : 'Delivery summary'}
                    </label>
                    <textarea
                      value={deliveryNote}
                      onChange={event => setDeliveryNote(event.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      placeholder={
                        locale === 'id'
                          ? 'Tulis yang dikirim dan scope yang selesai.'
                          : 'Explain what was delivered, what scope is complete, and the key points for the buyer to review.'
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Link project / bukti'
                        : 'Project / proof links'}
                    </label>
                    <textarea
                      value={deliveryAttachmentsText}
                      onChange={event =>
                        setDeliveryAttachmentsText(event.target.value)
                      }
                      rows={4}
                      className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      placeholder={
                        locale === 'id'
                          ? 'Satu baris satu link. Bisa juga pakai format Nama | https://...'
                          : 'One link per line. You can also use Name | https://...'
                      }
                    />
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Masukkan link bukti kerja.'
                        : 'Add Google Drive, GitHub, Figma, Loom, invoice, or other relevant proof references.'}
                    </p>
                  </div>

                  {deliveryError ? (
                    <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                      {deliveryError}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deliveryReviewTxn)}
        onClose={closeDeliveryReviewModal}
        title={locale === 'id' ? 'Review Hasil Kerja' : 'Review Delivery'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeDeliveryReviewModal}
              disabled={deliveryReviewSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              {locale === 'id' ? 'Kembali' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => void submitDeliveryReview()}
              disabled={deliveryReviewSubmitting}
              className={`inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60 ${
                deliveryReviewDecision === 'accept'
                  ? 'bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-strong)]'
                  : 'bg-[color:var(--app-info)] hover:bg-[color:var(--app-info)]'
              }`}
            >
              {deliveryReviewSubmitting
                ? locale === 'id'
                  ? 'Memproses...'
                  : 'Processing...'
                : deliveryReviewDecision === 'accept'
                  ? locale === 'id'
                    ? 'Terima & Selesaikan'
                    : 'Accept & Complete'
                  : locale === 'id'
                    ? 'Kirim Permintaan Revisi'
                    : 'Send Revision Request'}
            </button>
          </div>
        }
      >
        {deliveryReviewTxn ? (
          <div className="space-y-4">
            {(() => {
              const deliveryState = parseTransactionDelivery(
                deliveryReviewTxn.transaction_meta,
              );
              const latestDelivery = getLatestDeliverySubmission(
                deliveryReviewTxn.transaction_meta,
              );
              const willEscalate =
                deliveryReviewDecision === 'request_revision' &&
                deliveryState.attemptsUsed >= deliveryState.maxAttempts;
              return (
                <>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {resolveSnapshot(deliveryReviewTxn).title}
                    </p>
                    <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {latestDelivery?.title ||
                        (locale === 'id'
                          ? 'Paket hasil kerja terbaru'
                          : 'Latest delivery package')}
                    </p>
                    {latestDelivery?.note ? (
                      <p className="mt-2 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        {latestDelivery.note}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--app-text-soft)]">
                      <span>
                        {locale === 'id' ? 'Pengiriman' : 'Delivery'}:{' '}
                        {latestDelivery?.attemptNumber ||
                          deliveryState.attemptsUsed}
                        /{deliveryState.maxAttempts}
                      </span>
                      <span>
                        {locale === 'id' ? 'Bukti/link' : 'Proof / links'}:{' '}
                        {latestDelivery?.attachments.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryReviewDecision('accept')}
                      className={`rounded-2xl border px-3 py-3 text-left text-xs ${
                        deliveryReviewDecision === 'accept'
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]'
                      }`}
                    >
                      <p className="font-semibold">
                        {locale === 'id'
                          ? 'Terima hasil & selesaikan'
                          : 'Accept and complete'}
                      </p>
                      <p className="mt-1 text-[11px]">
                        {locale === 'id'
                          ? 'Kalau pekerjaan sudah sesuai, dana langsung dirilis ke seller.'
                          : 'Use this when the work is complete and funds can be released to the seller.'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeliveryReviewDecision('request_revision')
                      }
                      className={`rounded-2xl border px-3 py-3 text-left text-xs ${
                        deliveryReviewDecision === 'request_revision'
                          ? 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]'
                      }`}
                    >
                      <p className="font-semibold">
                        {locale === 'id' ? 'Minta revisi' : 'Request revision'}
                      </p>
                      <p className="mt-1 text-[11px]">
                        {willEscalate
                          ? locale === 'id'
                            ? 'Attempt terakhir. Kalau ditolak, masuk review support.'
                            : 'This is the final attempt. Rejecting it will auto-escalate the order to support review instead of an instant refund.'
                          : locale === 'id'
                            ? 'Seller akan diminta kirim revisi baru dengan bukti yang lebih jelas.'
                            : 'The seller will be asked to submit a revised delivery package with clearer proof.'}
                      </p>
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {deliveryReviewDecision === 'accept'
                        ? locale === 'id'
                          ? 'Catatan penerimaan (opsional)'
                          : 'Acceptance note (optional)'
                        : locale === 'id'
                          ? 'Apa yang harus direvisi?'
                          : 'What needs to be revised?'}
                    </label>
                    <textarea
                      value={deliveryReviewNote}
                      onChange={event =>
                        setDeliveryReviewNote(event.target.value)
                      }
                      rows={4}
                      className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      placeholder={
                        deliveryReviewDecision === 'accept'
                          ? locale === 'id'
                            ? 'Opsional: tulis catatan singkat.'
                            : 'Optional: add a short note if you want to confirm the work meets expectations.'
                          : locale === 'id'
                            ? 'Tulis yang kurang dan harus diperbaiki.'
                            : 'Explain what is missing, what should be fixed, and the output you expect.'
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                      {locale === 'id'
                        ? 'Link bukti tambahan'
                        : 'Additional proof links'}
                    </label>
                    <textarea
                      value={deliveryReviewAttachmentsText}
                      onChange={event =>
                        setDeliveryReviewAttachmentsText(event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      placeholder={
                        locale === 'id'
                          ? 'Satu baris satu link bukti.'
                          : 'One link per line. Use this for screenshots, feedback docs, or other supporting proof.'
                      }
                    />
                  </div>

                  {willEscalate ? (
                    <div className="rounded-2xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-xs text-[color:var(--app-warning)]">
                      {locale === 'id'
                        ? 'Attempt ke-3 masuk review support. Dana tetap ditahan.'
                        : 'Rejecting the 3rd attempt does not instantly refund the order. The system will keep funds on hold and send the timeline plus evidence to support/CRM for a safer decision.'}
                    </div>
                  ) : null}

                  {deliveryReviewError ? (
                    <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                      {deliveryReviewError}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(counterOfferTxn)}
        onClose={closeCounterOfferModal}
        title={locale === 'id' ? 'Atur Counter Offer' : 'Prepare Counter Offer'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeCounterOfferModal}
              disabled={counterOfferSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              {locale === 'id' ? 'Batal' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void submitCounterOffer()}
              disabled={counterOfferSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60 hover:bg-[color:var(--app-accent-strong)]"
            >
              {counterOfferSubmitting
                ? locale === 'id'
                  ? 'Mengirim...'
                  : 'Submitting...'
                : locale === 'id'
                  ? 'Kirim Counter Offer'
                  : 'Send Counter Offer'}
            </button>
          </div>
        }
      >
        {counterOfferTxn ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Order yang ditawar ulang'
                  : 'Order being renegotiated'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {resolveSnapshot(counterOfferTxn).title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Harga saat ini' : 'Current amount'}:{' '}
                {formatPrice(
                  counterOfferTxn.amount_cents,
                  counterOfferTxn.currency,
                )}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? `Nominal baru (${counterOfferTxn.currency || 'IDR'})`
                  : `New amount (${counterOfferTxn.currency || 'IDR'})`}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={counterOfferAmount}
                onChange={event => setCounterOfferAmount(event.target.value)}
                className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder={
                  locale === 'id' ? 'Contoh: 250000' : 'Example: 250000'
                }
              />
              <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Masukkan nominal yang jelas.'
                  : 'Use a simple amount so the counterparty can immediately understand the revision.'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Catatan singkat' : 'Short note'}
              </label>
              <textarea
                value={counterOfferMessage}
                onChange={event => setCounterOfferMessage(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder={
                  locale === 'id'
                    ? 'Tulis revisi harga, scope, timeline, atau syarat.'
                    : 'Explain the revised price, scope, timeline, or terms so it is easier to approve.'
                }
              />
            </div>

            {counterOfferError ? (
              <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                {counterOfferError}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(cancelTxn)}
        onClose={closeCancelModal}
        title={locale === 'id' ? 'Batalkan Order' : 'Cancel Order'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeCancelModal}
              disabled={cancelSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              {locale === 'id' ? 'Kembali' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => void submitCancel()}
              disabled={cancelSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[color:var(--app-danger)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60 hover:bg-[color:var(--app-danger)]"
            >
              {cancelSubmitting
                ? locale === 'id'
                  ? 'Memproses...'
                  : 'Submitting...'
                : locale === 'id'
                  ? 'Konfirmasi Batal'
                  : 'Confirm Cancellation'}
            </button>
          </div>
        }
      >
        {cancelTxn ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
              <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {resolveSnapshot(cancelTxn).title}
              </p>
              <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Pilih alasan paling dekat.'
                  : 'Choose the closest reason so the order timeline stays clear.'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Alasan utama' : 'Main reason'}
              </label>
              <select
                value={cancelReasonCode}
                onChange={event => setCancelReasonCode(event.target.value)}
                className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                {cancelReasonOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Catatan tambahan' : 'Additional note'}
              </label>
              <textarea
                value={cancelMessage}
                onChange={event => setCancelMessage(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder={
                  locale === 'id'
                    ? 'Tulis alasan singkat.'
                    : 'Add brief context so buyer, seller, and CRM understand the cancellation.'
                }
              />
            </div>

            {cancelError ? (
              <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                {cancelError}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(disputeTxn)}
        onClose={closeDisputeModal}
        title={
          locale === 'id'
            ? 'Laporkan Masalah / Dispute'
            : 'Report an Issue / Dispute'
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeDisputeModal}
              disabled={disputeSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              {locale === 'id' ? 'Kembali' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => void submitDispute()}
              disabled={disputeSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[color:var(--app-warning)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60 hover:bg-[color:var(--app-warning)]"
            >
              {disputeSubmitting
                ? locale === 'id'
                  ? 'Mengirim...'
                  : 'Submitting...'
                : locale === 'id'
                  ? 'Kirim Dispute'
                  : 'Submit Dispute'}
            </button>
          </div>
        }
      >
        {disputeTxn ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-3 text-xs text-[color:var(--app-text)]">
              <p className="font-semibold">
                {locale === 'id'
                  ? 'Dana akan tetap ditahan sampai dispute ditinjau.'
                  : 'Funds will remain on hold until the dispute is reviewed.'}
              </p>
              <p className="mt-1">
                {locale === 'id'
                  ? 'Isi ringkas dan faktual. Bukti akan dicek.'
                  : 'Keep it brief, clear, and factual. CRM will review the order timeline, chat, fund status, and the evidence you provide.'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Jenis masalah' : 'Issue type'}
              </label>
              <select
                value={disputeReasonCode}
                onChange={event => setDisputeReasonCode(event.target.value)}
                className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
              >
                {disputeReasonOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Apa yang terjadi?' : 'What happened?'}
              </label>
              <textarea
                value={disputeMessage}
                onChange={event => setDisputeMessage(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder={
                  locale === 'id'
                    ? 'Tulis kronologi singkat dan solusi yang diharapkan.'
                    : 'Describe the timeline briefly: when it happened, what was promised, what went wrong, and the outcome you expect.'
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Link bukti (opsional)'
                  : 'Evidence link (optional)'}
              </label>
              <input
                type="url"
                value={disputeEvidenceUrl}
                onChange={event => setDisputeEvidenceUrl(event.target.value)}
                className="h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Catatan bukti' : 'Evidence note'}
              </label>
              <textarea
                value={disputeEvidenceContext}
                onChange={event =>
                  setDisputeEvidenceContext(event.target.value)
                }
                rows={3}
                className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                placeholder={
                  locale === 'id'
                    ? 'Contoh: foto, resi, jam kejadian, bukti chat.'
                    : 'Example: unboxing photo, tracking number, incident time, or a summary of the evidence in chat.'
                }
              />
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
              <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Butuh bantuan lebih lanjut?'
                  : 'Need more help?'}
              </p>
              <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Setelah dispute, bisa tambah konteks di support.'
                  : 'After the dispute is submitted, you can continue in support to add more context if needed.'}
              </p>
              <div className="mt-2">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                >
                  {locale === 'id' ? 'Buka Support Hub' : 'Open Support Hub'}
                </Link>
              </div>
            </div>

            {disputeError ? (
              <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-danger)]">
                {disputeError}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paymentTxn)}
        onClose={closePaymentModal}
        title={locale === 'id' ? 'Bayar transaksi' : 'Pay transaction'}
        className="max-w-xl"
      >
        {paymentTxn ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.34)] dark:border-[color:var(--app-border-strong)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                    {locale === 'id' ? 'Total bayar' : 'Total payment'}
                  </p>
                  <p className="mt-1 text-2xl font-black leading-tight text-[color:var(--app-text)]">
                    {formatPrice(paymentTxn.amount_cents, paymentTxn.currency)}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                    #{paymentTxn.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--app-text)]">
                {locale === 'id'
                  ? 'Dana aman dulu. Seller menerima setelah transaksi selesai.'
                  : 'Funds are protected first. Seller receives them after the transaction is completed.'}
              </p>
              {rewardCoinDiscountCents > 0 ? (
                <div className="mt-3 grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-800 sm:grid-cols-2">
                  <span>
                    {locale === 'id' ? 'Koin dipakai' : 'Coins used'}:{' '}
                    <b>{rewardCoinsApplied}</b>
                  </span>
                  <span>
                    {locale === 'id' ? 'Sisa bayar' : 'Amount due'}:{' '}
                    <b>{paymentDueAfterCoinsSummary}</b>
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-[22px] border border-amber-200 bg-[linear-gradient(135deg,#fffdf2,#ffffff_58%,#ecfdf5)] p-3 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.22)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                  <Coins className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Pakai Koin Lajukan'
                          : 'Use Lajukan Coins'}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                        {loadingRewardBalance
                          ? locale === 'id'
                            ? 'Mengecek saldo koin...'
                            : 'Checking coin balance...'
                          : locale === 'id'
                            ? `${rewardCoinBalance} koin tersedia. Maksimal 25% nilai transaksi.`
                            : `${rewardCoinBalance} coins available. Max 25% of this transaction.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseCoinsForPayment(value => !value)}
                      disabled={
                        !canUseRewardCoinsForTxn || loadingRewardBalance
                      }
                      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-full px-3 text-xs font-black transition ${
                        useCoinsForPayment && rewardCoinsApplied > 0
                          ? 'bg-[color:var(--app-accent)] text-white'
                          : 'border border-amber-200 bg-white text-amber-700'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {useCoinsForPayment && rewardCoinsApplied > 0
                        ? locale === 'id'
                          ? 'Aktif'
                          : 'On'
                        : locale === 'id'
                          ? 'Pakai'
                          : 'Use'}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-amber-100 bg-white/82 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Potongan' : 'Discount'}
                      </p>
                      <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">
                        {rewardCoinDiscountCents > 0
                          ? rewardCoinDiscountSummary
                          : '-'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-white/82 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Koin' : 'Coins'}
                      </p>
                      <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">
                        {rewardCoinsApplied > 0
                          ? `${rewardCoinsApplied}`
                          : rewardCoinBalance}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-white/82 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Sisa bayar' : 'Due'}
                      </p>
                      <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">
                        {paymentDueAfterCoinsSummary}
                      </p>
                    </div>
                  </div>

                  {rewardBalanceError ? (
                    <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {rewardBalanceError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-black text-[color:var(--app-text)]">
                {locale === 'id' ? 'Pilih metode' : 'Choose method'}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {availablePaymentOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedPaymentOptionId(option.id)}
                    className={`ui-pressable flex min-h-[64px] items-center justify-between gap-2 rounded-[20px] border px-3 py-2 text-left transition ${
                      selectedPaymentOptionId === option.id
                        ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)]'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)]'
                    }`}
                  >
                    <PaymentMethodPill option={option} />
                    {selectedPaymentOptionId === option.id ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {selectedPaymentOption ? (
              <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5 dark:border-[color:var(--app-border-strong)]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[color:var(--app-text)]">
                      {selectedPaymentOption.title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                      {selectedPaymentOption.description}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-[color:var(--app-text)]">
                  {selectedPaymentUsesWalletBalance
                    ? locale === 'id'
                      ? rewardCoinsApplied > 0
                        ? 'Koin jadi kredit transaksi dulu, lalu dana langsung diamankan.'
                        : 'Kalau saldo cukup, dana langsung diamankan.'
                      : rewardCoinsApplied > 0
                        ? 'Coins become transaction credit first, then funds are held directly.'
                        : 'If the balance is sufficient, funds are held directly from wallet balance without creating a new top-up instruction.'
                    : locale === 'id'
                      ? rewardCoinsApplied > 0
                        ? 'Klik lanjut. Instruksi bayar hanya untuk sisa setelah koin.'
                        : 'Klik lanjut. Instruksi bayar akan muncul di sini.'
                      : rewardCoinsApplied > 0
                        ? 'Continue. The payment instruction only covers the amount after coins.'
                        : 'Click "Continue to payment" to open the payment instruction.'}
                </p>
              </div>
            ) : null}

            {selectedPaymentUsesWalletBalance ? (
              <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)]">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,_var(--app-accent)_14%,_transparent)] text-[color:var(--app-accent)]">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-[color:var(--app-text)]">
                          {locale === 'id' ? 'Saldo Wallet' : 'Wallet Balance'}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                          {locale === 'id' ? 'Tersedia' : 'Available'}
                        </p>
                      </div>
                      <p className="text-base font-black text-[color:var(--app-text)]">
                        {loadingWalletBalances ? '...' : walletBalanceSummary}
                      </p>
                    </div>
                    <p
                      className={`mt-2 text-xs font-semibold leading-5 ${
                        loadingWalletBalances
                          ? 'text-[color:var(--app-text-soft)]'
                          : canPayWithWalletBalance
                            ? 'text-[color:var(--app-accent)]'
                            : 'text-[color:var(--app-warning)]'
                      }`}
                    >
                      {loadingWalletBalances
                        ? locale === 'id'
                          ? 'Mengecek saldo terbaru...'
                          : 'Loading the latest wallet balance for this transaction.'
                        : canPayWithWalletBalance
                          ? locale === 'id'
                            ? rewardCoinsApplied > 0
                              ? `Saldo + koin cukup. Koin memotong ${rewardCoinDiscountSummary}.`
                              : 'Saldo cukup. Bisa langsung bayar.'
                            : rewardCoinsApplied > 0
                              ? `Wallet + coins are sufficient. Coins cover ${rewardCoinDiscountSummary}.`
                              : 'Your wallet balance is sufficient. Funds will move directly into transaction escrow.'
                          : locale === 'id'
                            ? `Saldo kurang ${walletShortfallSummary}. Pilih QRIS atau bank transfer.`
                            : `Your balance is short by ${walletShortfallSummary}. You can still choose QRIS, virtual account, or another method.`}
                    </p>
                    <details className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      <summary className="cursor-pointer font-semibold text-[color:var(--app-text)]">
                        {locale === 'id' ? 'Detail saldo' : 'Balance detail'}
                      </summary>
                      <div className="mt-2 grid gap-2 rounded-xl bg-[color:var(--app-surface-muted)] p-2 sm:grid-cols-2">
                        <span>
                          {locale === 'id' ? 'Ditahan' : 'Held'}:{' '}
                          <b>
                            {loadingWalletBalances ? '...' : walletHeldSummary}
                          </b>
                        </span>
                        <span>
                          Wallet: <b>{currentWalletEnvironment}</b>
                        </span>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ) : null}

            {walletBalanceError ? (
              <p className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
                {walletBalanceError}
              </p>
            ) : null}

            {paymentError ? (
              <p className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]">
                {paymentError}
              </p>
            ) : null}

            {paymentInfo ? (
              <p className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                {paymentInfo}
              </p>
            ) : null}

            {restoringPendingTopup ? (
              <p className="inline-flex items-center gap-2 rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-info)] dark:text-[color:var(--app-info)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Mengecek top-up pending yang sudah pernah dibuat...
              </p>
            ) : null}

            {latestTopup ? (
              <div className="space-y-3">
                <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[color:var(--app-text)]">
                        {latestPaymentInstruction?.qrUrl
                          ? locale === 'id'
                            ? 'QRIS siap discan'
                            : 'QRIS is ready'
                          : latestPaymentInstruction?.vaNumbers?.[0]?.number ||
                              latestPaymentInstruction?.permataVa ||
                              latestPaymentInstruction?.billKey
                            ? locale === 'id'
                              ? 'Nomor bayar siap'
                              : 'Payment number is ready'
                            : latestCheckoutUrl
                              ? locale === 'id'
                                ? 'Instruksi pembayaran siap'
                                : 'Payment instruction is ready'
                              : locale === 'id'
                                ? 'Pembayaran dibuat'
                                : 'Payment created'}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-[color:var(--app-text)]">
                        {locale === 'id'
                          ? 'Ikuti instruksi, lalu cek status setelah bayar.'
                          : 'Follow the instruction, then check the status after paying.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {latestCheckoutUrl ? (
                          <a
                            href={latestCheckoutUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[color:var(--app-accent)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                          >
                            {locale === 'id'
                              ? 'Buka instruksi'
                              : 'Open instruction'}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {latestPaymentInstruction?.qrUrl ? (
                          <a
                            href={latestPaymentInstruction.qrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-muted)]"
                          >
                            {locale === 'id' ? 'Buka QR' : 'Open QR'}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {latestPaymentInstruction?.vaNumbers?.[0]?.number ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(
                                latestPaymentInstruction.vaNumbers[0].number,
                              )
                            }
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-muted)]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {locale === 'id' ? 'Salin VA' : 'Copy VA'}
                          </button>
                        ) : null}
                        {latestPaymentInstruction?.permataVa ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(
                                latestPaymentInstruction.permataVa,
                              )
                            }
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-muted)]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {locale === 'id' ? 'Salin VA' : 'Copy VA'}
                          </button>
                        ) : null}
                        {latestPaymentInstruction?.billKey ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(
                                `${latestPaymentInstruction.billerCode || ''} ${latestPaymentInstruction.billKey}`.trim(),
                              )
                            }
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-black text-[color:var(--app-accent)] hover:bg-[color:var(--app-surface-muted)]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {locale === 'id' ? 'Salin kode' : 'Copy code'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <details className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[color:var(--app-text)]">
                    {locale === 'id' ? 'Detail pembayaran' : 'Payment detail'}
                    <span className="ml-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {locale === 'id' ? 'opsional' : 'optional'}
                    </span>
                  </summary>
                  <div className="border-t border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                    <div className="space-y-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                          Topup {humanize(latestTopup.status || 'pending')}
                        </span>
                        <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_15%,_transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--app-info)] dark:text-[color:var(--app-info)]">
                          {humanize(
                            latestPaymentInstruction?.paymentType ||
                              latestTopup.payment_method ||
                              selectedPaymentOption?.method ||
                              selectedPaymentOption?.provider ||
                              '-',
                          )}
                        </span>
                        {latestPaymentInstruction?.mode ? (
                          <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-group-talent)_15%,_transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--app-group-talent)] dark:text-[color:var(--app-group-talent)]">
                            Flow {humanize(latestPaymentInstruction.mode)}
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-[color:var(--app-text)]">
                            Topup ID
                          </p>
                          <p className="mt-1 break-all text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {latestTopup.id}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-[color:var(--app-text)]">
                            Provider Transaction
                          </p>
                          <p className="mt-1 break-all text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {latestPaymentInstruction?.transactionId || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-[color:var(--app-text)]">
                            Provider Status
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {humanize(
                              latestPaymentInstruction?.transactionStatus ||
                                latestTopup.status ||
                                '-',
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-[color:var(--app-text)]">
                            Expiry
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {formatDateTime(
                              latestPaymentInstruction?.expiryTime || '',
                            )}
                          </p>
                        </div>
                      </div>

                      {latestPaymentInstruction?.qrUrl ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                            QR Payment
                          </p>
                          <p className="mt-1 break-all text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {latestPaymentInstruction.qrUrl}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={latestPaymentInstruction.qrUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--app-info)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-info)]"
                            >
                              Open QR <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                void copyToClipboard(
                                  latestPaymentInstruction.qrUrl,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                            >
                              <Copy className="h-4 w-4" />
                              Copy QR Link
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {latestPaymentInstruction?.qrString ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                            QR String
                          </p>
                          <p className="mt-1 break-all rounded-lg bg-[color:var(--app-surface-muted)] px-2 py-1 text-[11px] text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
                            {latestPaymentInstruction.qrString}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              void copyToClipboard(
                                latestPaymentInstruction.qrString,
                              )
                            }
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                          >
                            <Copy className="h-4 w-4" />
                            Copy QR String
                          </button>
                        </div>
                      ) : null}

                      {latestPaymentInstruction?.deeplinkUrl ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                            App Deeplink
                          </p>
                          <p className="mt-1 break-all text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {latestPaymentInstruction.deeplinkUrl}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={latestPaymentInstruction.deeplinkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                            >
                              Open Payment App{' '}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                void copyToClipboard(
                                  latestPaymentInstruction.deeplinkUrl,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                            >
                              <Copy className="h-4 w-4" />
                              Copy Deeplink
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {latestPaymentInstruction &&
                      (latestPaymentInstruction.vaNumbers.length > 0 ||
                        latestPaymentInstruction.permataVa ||
                        latestPaymentInstruction.billKey ||
                        latestPaymentInstruction.billerCode) ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                            Virtual Account / Bill
                          </p>

                          <div className="mt-2 space-y-2">
                            {latestPaymentInstruction.vaNumbers.map(va => (
                              <div
                                key={`${va.bank}-${va.number}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]"
                              >
                                <div>
                                  <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                    {va.bank}
                                  </p>
                                  <p className="text-sm font-bold tracking-wide text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                    {va.number}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(va.number)
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </button>
                              </div>
                            ))}

                            {latestPaymentInstruction.permataVa ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                                <div>
                                  <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                    Permata VA
                                  </p>
                                  <p className="text-sm font-bold tracking-wide text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                    {latestPaymentInstruction.permataVa}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(
                                      latestPaymentInstruction.permataVa,
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </button>
                              </div>
                            ) : null}

                            {latestPaymentInstruction.billKey ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                                <div>
                                  <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                    Bill Key
                                  </p>
                                  <p className="text-sm font-bold tracking-wide text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                    {latestPaymentInstruction.billKey}
                                  </p>
                                  {latestPaymentInstruction.billerCode ? (
                                    <p className="text-[11px] text-[color:var(--app-text)]">
                                      Biller Code:{' '}
                                      {latestPaymentInstruction.billerCode}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(
                                      `${latestPaymentInstruction.billerCode || ''} ${latestPaymentInstruction.billKey}`.trim(),
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy Bill Data
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {latestPaymentInstruction?.checkoutHint ? (
                        <div className="rounded-xl border border-[color:var(--app-border)] p-3 dark:border-[color:var(--app-border-strong)]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text)]">
                            Extra Action URL
                          </p>
                          <p className="mt-1 break-all text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {latestPaymentInstruction.checkoutHint}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={latestPaymentInstruction.checkoutHint}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                            >
                              Open URL <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                void copyToClipboard(
                                  latestPaymentInstruction.checkoutHint,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                            >
                              <Copy className="h-4 w-4" />
                              Copy URL
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-[color:var(--app-border)] pt-3 dark:border-[color:var(--app-border-strong)] sm:flex-row">
              <button
                type="button"
                onClick={() => void handleCreateTransactionPayment()}
                disabled={paymentActionDisabled}
                className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--app-accent)] px-4 text-sm font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
              >
                {submittingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : selectedPaymentUsesWalletBalance ? (
                  <Wallet className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {paymentActionLabel}
              </button>

              {latestTopup &&
              asString(latestTopup.status).toLowerCase() === 'pending' &&
              asString(latestTopup.payment_provider).toLowerCase() ===
                'midtrans' ? (
                <button
                  type="button"
                  onClick={() => void syncLatestTopupStatus(false)}
                  disabled={syncingTopupStatus || submittingPayment}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] px-4 text-sm font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                >
                  {syncingTopupStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  {syncingTopupStatus
                    ? locale === 'id'
                      ? 'Mengecek...'
                      : 'Checking...'
                    : locale === 'id'
                      ? 'Cek status'
                      : 'Check status'}
                </button>
              ) : null}

              {latestCheckoutUrl && !latestTopup ? (
                <a
                  href={latestCheckoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[46px] items-center justify-center gap-1 rounded-2xl border border-[color:var(--app-border)] px-4 text-sm font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                >
                  {locale === 'id' ? 'Buka pembayaran' : 'Open payment'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void loadTransactions();
                  void loadWalletBalances();
                }}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] px-4 text-sm font-black text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                <RefreshCcw className="h-4 w-4" />
                {locale === 'id' ? 'Refresh' : 'Refresh'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
