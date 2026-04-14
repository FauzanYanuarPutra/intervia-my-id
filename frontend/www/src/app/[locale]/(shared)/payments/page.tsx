'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { Modal } from '@/components/common/Modal';
import { PaymentsPageSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { DetailAccordion } from '@/components/ui/DetailAccordion';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  QrCode,
  RefreshCcw,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type WalletAccount = {
  id: string;
  environment: 'development' | 'live';
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
  default_environment: 'development' | 'live';
  live_enabled: boolean;
  provider_default: string;
  generated_at: string;
};

type WalletTopup = {
  id: string;
  account_id: string;
  environment: 'development' | 'live';
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  currency: string;
  payment_provider: string;
  payment_method?: string | null;
  external_reference?: string | null;
  checkout_url?: string | null;
  payment_payload?: Record<string, unknown>;
  description?: string | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  payment_due_at?: string | null;
  paid_at?: string | null;
  expired_at?: string | null;
  created_at: string;
  updated_at: string;
};

type WalletLedgerEntry = {
  id: string;
  account_id: string;
  environment: 'development' | 'live';
  currency: string;
  direction: 'credit' | 'debit';
  amount_cents: number;
  balance_after_cents: number;
  entry_type: string;
  status: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  limit: number;
  offset: number;
  has_more: boolean;
};

type PaymentMethodOption = {
  value: string;
  label: string;
  hint: string;
  image?: string;
};

const MIDTRANS_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'qris', label: 'QRIS', hint: 'Scan pakai mobile banking atau e-wallet apa saja.', image: '/images/payments/qris.svg' },
  { value: 'bank_transfer', label: 'Transfer Bank', hint: 'Nomor VA akan disiapkan sesuai channel yang tersedia.', image: '/images/payments/bank-transfer.svg' },
  { value: 'gopay', label: 'GoPay', hint: 'Buka aplikasi GoPay lalu lanjut bayar dari sana.', image: '/images/payments/gopay.svg' },
  { value: 'bca_va', label: 'BCA Virtual Account', hint: 'Bayar dari BCA mobile, myBCA, internet banking, atau ATM.', image: '/images/payments/bca-va.svg' },
  { value: 'mandiri_va', label: 'Mandiri Virtual Account', hint: 'Cocok untuk Livin Mandiri dan ATM Mandiri.', image: '/images/payments/bank-transfer.svg' },
  { value: 'bni_va', label: 'BNI Virtual Account', hint: 'Bayar dari Wondr/BNI Mobile, ATM, atau kanal BNI.', image: '/images/payments/bank-transfer.svg' },
  { value: 'bri_va', label: 'BRI Virtual Account', hint: 'Praktis lewat BRImo, ATM, atau agen BRI.', image: '/images/payments/bank-transfer.svg' },
  { value: 'cimb_va', label: 'CIMB Virtual Account', hint: 'Bisa dibayar dari OCTO Mobile dan ATM CIMB.', image: '/images/payments/bank-transfer.svg' },
  { value: 'permata_va', label: 'Permata Virtual Account', hint: 'Enak kalau mau bayar dari banyak jaringan ATM bank.', image: '/images/payments/bank-transfer.svg' },
  { value: 'shopeepay', label: 'ShopeePay', hint: 'Bayar langsung dari aplikasi ShopeePay.', image: '/images/payments/qris.svg' },
  { value: 'credit_card', label: 'Kartu Debit/Kredit', hint: 'Pakai kartu Visa, Mastercard, JCB, atau Amex bila aktif.', image: '/images/payments/bank-transfer.svg' },
];

const TOPUP_PRESETS_IDR = [20_000, 50_000, 100_000, 200_000, 500_000] as const;

function moneyFromCents(cents: number, currency: string): string {
  const value = Number(cents || 0);
  const amount = value / 100;
  const curr = (currency || 'IDR').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

function dateTimeLabel(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function topupStatusClass(status: WalletTopup['status']): string {
  if (status === 'paid') return 'bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] text-[color:var(--app-accent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)]';
  if (status === 'pending') return 'bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] text-[color:var(--app-warning)] border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)]';
  if (status === 'failed') return 'bg-[color:color-mix(in_srgb,_var(--app-danger)_15%,_transparent)] text-[color:var(--app-danger)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)]';
  if (status === 'cancelled' || status === 'expired') return 'bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] text-[color:var(--app-text-soft)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
  return 'bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] text-[color:var(--app-text-soft)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
}

function topupStatusIcon(status: WalletTopup['status']) {
  if (status === 'paid') return CircleCheck;
  if (status === 'pending') return CircleDashed;
  if (status === 'failed') return CircleX;
  if (status === 'cancelled') return CircleAlert;
  if (status === 'expired') return CircleAlert;
  return CircleDashed;
}

function topupStatusLabel(status: WalletTopup['status']): string {
  if (status === 'paid') return 'Berhasil';
  if (status === 'pending') return 'Menunggu bayar';
  if (status === 'failed') return 'Gagal';
  if (status === 'cancelled') return 'Dibatalkan';
  if (status === 'expired') return 'Kedaluwarsa';
  return status;
}

function paymentMethodDisplayLabel(value?: string | null): string {
  const source = String(value || '').toLowerCase();
  if (!source) return 'Metode belum dipilih';
  if (source === 'gopay') return 'GoPay';
  if (source === 'qris') return 'QRIS';
  if (source === 'shopeepay') return 'ShopeePay';
  if (source === 'bca_va') return 'BCA Virtual Account';
  if (source === 'mandiri_va') return 'Mandiri Virtual Account';
  if (source === 'bni_va') return 'BNI Virtual Account';
  if (source === 'bri_va') return 'BRI Virtual Account';
  if (source === 'cimb_va') return 'CIMB Virtual Account';
  if (source === 'permata_va') return 'Permata Virtual Account';
  if (source === 'bank_transfer') return 'Transfer bank';
  if (source === 'credit_card') return 'Kartu debit / kredit';
  return source
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, token => token.toUpperCase());
}

function paymentMethodGroupLabel(value?: string | null): string {
  const source = String(value || '').toLowerCase();
  if (!source) return 'Metode pembayaran';
  if (source.includes('gopay') || source.includes('shopee') || source.includes('qris')) {
    return 'E-wallet';
  }
  if (source.includes('credit') || source.includes('card')) {
    return 'Kartu';
  }
  return 'Transfer bank';
}

function paymentMethodIcon(method?: string | null, paymentType?: string) {
  const source = String(method || paymentType || '').toLowerCase();
  if (!source) return Banknote;
  if (source.includes('va') || source.includes('bank')) return Landmark;
  if (source.includes('qris') || source.includes('qr')) return QrCode;
  if (source.includes('gopay') || source.includes('shopee') || source.includes('ewallet')) {
    return Smartphone;
  }
  if (source.includes('credit') || source.includes('card')) return CreditCard;
  return Banknote;
}

function paymentMethodNextStep(value?: string | null): string {
  const source = String(value || '').toLowerCase();
  if (!source) return 'Instruksi bayar muncul setelah tagihan dibuat.';
  if (source === 'gopay') return 'Setelah tagihan dibuat, langsung lanjutkan pembayaran di GoPay.';
  if (source === 'qris') return 'Setelah tagihan dibuat, scan QR dari mobile banking atau e-wallet apa saja.';
  if (source === 'shopeepay') return 'Setelah tagihan dibuat, lanjutkan pembayaran dari ShopeePay.';
  if (source.includes('va') || source.includes('bank')) return 'Setelah tagihan dibuat, nomor virtual account langsung muncul untuk disalin.';
  if (source.includes('credit') || source.includes('card')) return 'Setelah tagihan dibuat, lanjutkan ke halaman pembayaran kartu yang aman.';
  return 'Ikuti instruksi pembayaran yang muncul setelah tagihan dibuat.';
}

function resolveAutoTopupDescription(
  transactionId: string,
  environment: 'development' | 'live',
): string {
  if (transactionId) {
    return `Isi saldo untuk transaksi ${transactionId}`;
  }
  return environment === 'live'
    ? 'Isi saldo utama'
    : 'Isi saldo mode coba dulu';
}

function parseTopupPaymentDueAt(topup: WalletTopup): Date | null {
  const direct = typeof topup.payment_due_at === 'string' ? topup.payment_due_at.trim() : '';
  const payload = topup.payment_payload && typeof topup.payment_payload === 'object' ? topup.payment_payload : {};
  const walletFlow =
    payload && typeof (payload as Record<string, unknown>).wallet_flow === 'object'
      ? ((payload as Record<string, unknown>).wallet_flow as Record<string, unknown>)
      : null;
  const fromPayload = walletFlow && typeof walletFlow.payment_due_at === 'string'
    ? walletFlow.payment_due_at.trim()
    : '';
  const raw = direct || fromPayload;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function remainingCountdownLabel(target: Date, nowMs: number): string {
  const diff = target.getTime() - nowMs;
  if (diff <= 0) return 'Waktu habis';
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}j ${minutes}m ${seconds}d`;
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function findActionUrl(actions: unknown, nameCandidates: string[]): string {
  if (!Array.isArray(actions)) return '';
  for (const entry of actions) {
    const row = asObject(entry);
    const name = asString(row.name).toLowerCase();
    if (!name) continue;
    if (!nameCandidates.some((candidate) => name.includes(candidate))) continue;
    const url = asString(row.url);
    if (url) return url;
  }
  return '';
}

function extractPaymentInstructionView(topup: WalletTopup | null): PaymentInstructionView | null {
  if (!topup) return null;
  const payload = asObject(topup.payment_payload);
  const mode = asString(payload.mode).toLowerCase();
  const midtrans = asObject(payload.midtrans);
  const charge =
    mode === 'direct_charge'
      ? asObject(payload.charge)
      : mode === 'snap_redirect'
        ? asObject(payload.snap)
        : payload;
  const actions = charge.actions;
  const paymentType = asString(charge.payment_type || midtrans.payment_type || topup.payment_method).toLowerCase();
  const vaNumbersRaw = Array.isArray(charge.va_numbers) ? charge.va_numbers : [];
  const vaNumbers = vaNumbersRaw
    .map((entry) => {
      const row = asObject(entry);
      return {
        bank: asString(row.bank).toUpperCase(),
        number: asString(row.va_number || row.number),
      };
    })
    .filter((entry) => entry.number);

  return {
    mode: mode || 'unknown',
    paymentType,
    transactionId: asString(charge.transaction_id || midtrans.transaction_id),
    transactionStatus: asString(charge.transaction_status || midtrans.transaction_status || charge.status_message),
    expiryTime: asString(charge.expiry_time || charge.expiration_time || charge.settlement_time || midtrans.settlement_time),
    checkoutHint: asString(payload.checkout_hint || topup.checkout_url),
    qrUrl:
      asString(charge.qr_url) ||
      findActionUrl(actions, ['generate-qr-code', 'generate_qr_code', 'qr']),
    qrString: asString(charge.qr_string),
    deeplinkUrl:
      asString(charge.deeplink_redirect) ||
      asString(charge.deeplink_url) ||
      findActionUrl(actions, ['deeplink-redirect', 'deeplink']),
    vaNumbers,
    permataVa: asString(charge.permata_va_number),
    billKey: asString(charge.bill_key),
    billerCode: asString(charge.biller_code),
  };
}

function hasPaymentInstructionData(
  topup: WalletTopup,
  instruction: PaymentInstructionView | null,
): boolean {
  if (!instruction) return false;
  return Boolean(
    instruction.vaNumbers.length ||
      instruction.permataVa ||
      instruction.billKey ||
      instruction.qrUrl ||
      instruction.qrString ||
      instruction.deeplinkUrl ||
      instruction.checkoutHint ||
      topup.checkout_url,
  );
}

export default function PaymentsPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const searchParams = useSearchParams();
  const [balances, setBalances] = useState<WalletBalancesResponse | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<'development' | 'live'>('development');

  const [topups, setTopups] = useState<WalletTopup[]>([]);
  const [topupsLoading, setTopupsLoading] = useState(false);
  const [topupsError, setTopupsError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const [amountMajor, setAmountMajor] = useState('100000');
  const [currency, setCurrency] = useState('IDR');
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [description, setDescription] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [latestTopup, setLatestTopup] = useState<WalletTopup | null>(null);
  const [detailTopup, setDetailTopup] = useState<WalletTopup | null>(null);

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const prefillAppliedRef = useRef(false);

  const copyInstructionValue = useCallback(async (label: string, value: string) => {
    const content = value.trim();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setSubmitSuccess(`${label} berhasil disalin.`);
      setSubmitError(null);
    } catch {
      setSubmitError(`Gagal menyalin ${label}.`);
    }
  }, []);

  const selectedAccount = useMemo(
    () => balances?.accounts.find((account) => account.environment === selectedEnvironment) || null,
    [balances?.accounts, selectedEnvironment],
  );

  const envOptions = useMemo(() => {
    const options: Array<'development' | 'live'> = ['development'];
    if (balances?.live_enabled) options.push('live');
    return options;
  }, [balances?.live_enabled]);

  const selectedMethodMeta = useMemo(
    () => MIDTRANS_METHOD_OPTIONS.find((method) => method.value === paymentMethod) || MIDTRANS_METHOD_OPTIONS[0],
    [paymentMethod],
  );
  const amountMajorNumber = Number(amountMajor);
  const normalizedAmountMajor =
    Number.isFinite(amountMajorNumber) && amountMajorNumber > 0 ? amountMajorNumber : 0;
  const selectedCurrency = currency.trim().toUpperCase() || 'IDR';
  const estimatedTopupCents = Math.round(normalizedAmountMajor * 100);
  const projectedAvailableBalanceCents =
    (selectedAccount?.available_balance_cents || 0) + estimatedTopupCents;
  const featuredMethods = useMemo(() => {
    const preferred = ['qris', 'bank_transfer', 'gopay', 'bca_va', 'mandiri_va', 'bri_va', 'bni_va'];
    const preferredSet = new Set(preferred);
    const ordered = [
      ...preferred
        .map((value) => MIDTRANS_METHOD_OPTIONS.find((item) => item.value === value))
        .filter(Boolean),
      ...MIDTRANS_METHOD_OPTIONS.filter((item) => !preferredSet.has(item.value)),
    ];
    return ordered as PaymentMethodOption[];
  }, []);
  const quickMethods = useMemo(() => featuredMethods.slice(0, 3), [featuredMethods]);
  const secondaryMethods = useMemo(() => featuredMethods.slice(3), [featuredMethods]);
  const mobileMethods = useMemo(
    () =>
      ['qris', 'bank_transfer', 'gopay']
        .map((value) => MIDTRANS_METHOD_OPTIONS.find((item) => item.value === value))
        .filter(Boolean) as PaymentMethodOption[],
    [],
  );
  const selectedMethodNextStep = useMemo(() => paymentMethodNextStep(paymentMethod), [paymentMethod]);
  const prefillAmountCentsRaw = (searchParams.get('amount_cents') || '').trim();
  const prefillCurrencyRaw = (searchParams.get('currency') || '').trim().toUpperCase();
  const prefillTransactionId = (searchParams.get('transaction_id') || '').trim();
  const prefillSource = (searchParams.get('source') || '').trim().toLowerCase();
  const redirectStatusRaw = (searchParams.get('topup_status') || '').trim().toLowerCase();
  const redirectTopupId = (searchParams.get('topup_id') || '').trim();
  const resolvedDescription = useMemo(
    () =>
      description.trim() ||
      resolveAutoTopupDescription(prefillTransactionId, selectedEnvironment),
    [description, prefillTransactionId, selectedEnvironment],
  );
  const redirectBanner = useMemo(() => {
    if (!redirectStatusRaw) return null;
    if (redirectStatusRaw === 'finish') {
      return {
        className: 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] text-[color:var(--app-accent)]',
        message: `Pembayaran berhasil diproses${redirectTopupId ? ` (ID ${redirectTopupId}).` : '.'} Saldo akan diperbarui otomatis setelah callback diterima.`,
      };
    }
    if (redirectStatusRaw === 'unfinish' || redirectStatusRaw === 'pending') {
      return {
        className: 'border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] text-[color:var(--app-warning)]',
        message: `Pembayaran belum selesai${redirectTopupId ? ` (ID ${redirectTopupId}).` : '.'} Kamu bisa lanjutkan dari tombol "Buka pembayaran" di riwayat isi saldo.`,
      };
    }
    if (redirectStatusRaw === 'error' || redirectStatusRaw === 'failed') {
      return {
        className: 'border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] text-[color:var(--app-danger)]',
        message: `Pembayaran mengembalikan status error${redirectTopupId ? ` (ID ${redirectTopupId}).` : '.'} Cek detail transaksi lalu coba isi saldo lagi.`,
      };
    }
    return {
      className: 'border-[color:color-mix(in_srgb,_var(--app-border-strong)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface)_10%,_transparent)] text-[color:var(--app-text-soft)]',
      message: `Status pembayaran diterima: ${redirectStatusRaw}${redirectTopupId ? ` (ID ${redirectTopupId})` : ''}.`,
    };
  }, [redirectStatusRaw, redirectTopupId]);
  const actionableTopup = useMemo(
    () => topups.find((item) => item.status === 'pending') || latestTopup || topups[0] || null,
    [latestTopup, topups],
  );
  const actionableInstruction = useMemo(
    () => extractPaymentInstructionView(actionableTopup),
    [actionableTopup],
  );
  const actionableDueAt = useMemo(
    () => (actionableTopup ? parseTopupPaymentDueAt(actionableTopup) : null),
    [actionableTopup],
  );
  const actionableReference = useMemo(() => {
    if (!actionableInstruction) return null;
    if (actionableInstruction.vaNumbers.length) {
      const firstVa = actionableInstruction.vaNumbers[0];
      return {
        label: firstVa.bank ? `${firstVa.bank.toUpperCase()} VA` : 'Virtual account',
        value: firstVa.number,
      };
    }
    if (actionableInstruction.permataVa) {
      return { label: 'Permata VA', value: actionableInstruction.permataVa };
    }
    if (actionableInstruction.billKey) {
      return { label: 'Bill Key', value: actionableInstruction.billKey };
    }
    return null;
  }, [actionableInstruction]);
  const recentTopups = useMemo(() => topups.slice(0, 3), [topups]);
  const detailInstruction = useMemo(
    () => extractPaymentInstructionView(detailTopup),
    [detailTopup],
  );
  const detailAccount = useMemo(() => {
    if (!detailTopup || !balances?.accounts?.length) return null;
    return balances.accounts.find((account) => account.id === detailTopup.account_id) || null;
  }, [balances?.accounts, detailTopup]);
  const expectedAfterPaidCents = useMemo(() => {
    if (!detailTopup || !detailAccount) return null;
    if (detailTopup.status === 'paid') return detailAccount.available_balance_cents;
    return detailAccount.available_balance_cents + detailTopup.net_amount_cents;
  }, [detailAccount, detailTopup]);

  const transactionPrefillBanner = useMemo(() => {
    if (!prefillTransactionId) return null;
    const sourceLabel = prefillSource === 'chat' ? 'chat' : prefillSource === 'transactions' ? 'transactions' : 'transaction';
    return {
      className: 'border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] text-[color:var(--app-info)]',
      message: `${sourceLabel}. Nominal isi saldo sudah diisi untuk transaksi ${prefillTransactionId}. Lanjutkan dengan "Lanjut ke pembayaran", lalu klik "Buka pembayaran" untuk bayar.`,
    };
  }, [prefillSource, prefillTransactionId]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;

    let hasPrefill = false;
    const amountCents = Number(prefillAmountCentsRaw);
    if (Number.isFinite(amountCents) && amountCents > 0) {
      const amountMajor = Math.max(1, Math.round(amountCents / 100));
      setAmountMajor(String(amountMajor));
      hasPrefill = true;
    }

    if (prefillCurrencyRaw && /^[A-Z]{3}$/.test(prefillCurrencyRaw)) {
      setCurrency(prefillCurrencyRaw);
      hasPrefill = true;
    }

    if (prefillTransactionId) {
      setDescription(
        prev => prev || `Isi saldo untuk transaksi ${prefillTransactionId}`,
      );
      hasPrefill = true;
    }

    if (hasPrefill) {
      prefillAppliedRef.current = true;
    }
  }, [prefillAmountCentsRaw, prefillCurrencyRaw, prefillTransactionId]);

  const loadBalances = useCallback(async (options?: { silent?: boolean; preserveSelection?: boolean }) => {
    if (!user?.id) return;
    if (!options?.silent) {
      setLoadingBalances(true);
      setBalanceError(null);
    }
    try {
      const res = await authFetch('/api/wallet/balance', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as
        | WalletBalancesResponse
        | { error?: string };
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Gagal memuat saldo.');
      }

      const normalized = payload as WalletBalancesResponse;
      setBalances(normalized);
      if (!options?.preserveSelection) {
        const availableEnvs: Array<'development' | 'live'> = normalized.live_enabled
          ? ['development', 'live']
          : ['development'];
        if (availableEnvs.includes(normalized.default_environment)) {
          setSelectedEnvironment(normalized.default_environment);
        } else {
          setSelectedEnvironment('development');
        }
      }
    } catch (error) {
      if (!options?.silent) {
        setBalanceError(error instanceof Error ? error.message : 'Gagal memuat saldo.');
        setBalances(null);
      }
    } finally {
      if (!options?.silent) {
        setLoadingBalances(false);
      }
    }
  }, [authFetch, user?.id]);

  const loadTopups = useCallback(
    async (environment: 'development' | 'live', options?: { silent?: boolean }) => {
      if (!user?.id) return;
      if (!options?.silent) {
        setTopupsLoading(true);
        setTopupsError(null);
      }
      try {
        const params = new URLSearchParams({
          environment,
          limit: '25',
          offset: '0',
        });
        const res = await authFetch(`/api/wallet/topups?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => ({}))) as
          | PaginatedResponse<WalletTopup>
          | { error?: string };
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || 'Gagal memuat riwayat isi saldo.');
        }
        setTopups(Array.isArray((payload as PaginatedResponse<WalletTopup>).items) ? (payload as PaginatedResponse<WalletTopup>).items : []);
      } catch (error) {
        if (!options?.silent) {
          setTopupsError(error instanceof Error ? error.message : 'Gagal memuat riwayat isi saldo.');
          setTopups([]);
        }
      } finally {
        if (!options?.silent) {
          setTopupsLoading(false);
        }
      }
    },
    [authFetch, user?.id],
  );

  const loadLedger = useCallback(
    async (environment: 'development' | 'live', options?: { silent?: boolean }) => {
      if (!user?.id) return;
      if (!options?.silent) {
        setLedgerLoading(true);
        setLedgerError(null);
      }
      try {
        const params = new URLSearchParams({
          environment,
          limit: '30',
          offset: '0',
        });
        const res = await authFetch(`/api/wallet/ledger?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => ({}))) as
          | PaginatedResponse<WalletLedgerEntry>
          | { error?: string };
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || 'Gagal memuat mutasi saldo.');
        }
        setLedger(Array.isArray((payload as PaginatedResponse<WalletLedgerEntry>).items) ? (payload as PaginatedResponse<WalletLedgerEntry>).items : []);
      } catch (error) {
        if (!options?.silent) {
          setLedgerError(error instanceof Error ? error.message : 'Gagal memuat mutasi saldo.');
          setLedger([]);
        }
      } finally {
        if (!options?.silent) {
          setLedgerLoading(false);
        }
      }
    },
    [authFetch, user?.id],
  );

  const refreshLists = useCallback(
    async (environment: 'development' | 'live', options?: { silent?: boolean }) => {
      await Promise.all([loadTopups(environment, options), loadLedger(environment, options)]);
    },
    [loadLedger, loadTopups],
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadBalances();
  }, [loadBalances, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void refreshLists(selectedEnvironment);
  }, [refreshLists, selectedEnvironment, user?.id]);

  useEffect(() => {
    if (!MIDTRANS_METHOD_OPTIONS.some((option) => option.value === paymentMethod)) {
      setPaymentMethod('qris');
    }
  }, [paymentMethod]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!detailTopup) return;
    const refreshed = topups.find((item) => item.id === detailTopup.id);
    if (refreshed) {
      setDetailTopup(refreshed);
      return;
    }
    setDetailTopup(null);
  }, [detailTopup, topups]);

  useEffect(() => {
    const onNotification = (event: Event) => {
      const custom = event as CustomEvent<{ category?: string; event_type?: string }>;
      const category = String(custom.detail?.category || '').toLowerCase();
      const eventType = String(custom.detail?.event_type || '').toLowerCase();
      if (
        category !== 'wallet' &&
        !(category === 'transaction' && eventType.includes('completed'))
      ) {
        return;
      }
      void loadBalances({ silent: true, preserveSelection: true });
      void refreshLists(selectedEnvironment, { silent: true });
    };
    window.addEventListener('marketplace:notification', onNotification as EventListener);
    return () =>
      window.removeEventListener(
        'marketplace:notification',
        onNotification as EventListener,
      );
  }, [loadBalances, refreshLists, selectedEnvironment]);

  useEffect(() => {
    const hasPending = topups.some((topup) => topup.status === 'pending');
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      void loadBalances({ silent: true, preserveSelection: true });
      void refreshLists(selectedEnvironment, { silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadBalances, refreshLists, selectedEnvironment, topups]);

  const submitTopup = useCallback(async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const majorRaw = Number(String(amountMajor || '').replace(/,/g, '').trim());
    if (!Number.isFinite(majorRaw) || majorRaw <= 0) {
      setSubmitError('Nominal isi saldo belum benar.');
      return;
    }
    const amountCents = Math.round(majorRaw * 100);
    if (amountCents <= 0) {
      setSubmitError('Nominal isi saldo harus lebih dari 0.');
      return;
    }

    setSubmittingTopup(true);
    try {
      const normalizedMethod =
        paymentMethod.trim().toLowerCase() || undefined;

      const body = {
        amount_cents: amountCents,
        currency: currency.trim().toUpperCase(),
        environment: selectedEnvironment,
        payment_method: normalizedMethod,
        description: resolvedDescription,
        metadata: prefillTransactionId
          ? {
              transaction_id: prefillTransactionId,
              source: prefillSource || 'payments_page',
            }
          : undefined,
      };

      const res = await authFetch('/api/wallet/topups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey('wallet-topup'),
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        topup?: WalletTopup;
      };

      if (!res.ok) {
        throw new Error(payload.error || 'Gagal membuat transaksi isi saldo.');
      }

      const topup = payload.topup;
      const nextText =
        topup?.status === 'paid'
          ? 'Isi saldo berhasil masuk ke dompet.'
          : topup?.checkout_url
            ? 'Transaksi isi saldo dibuat. Instruksi bayar muncul di bawah dan status akan diperbarui otomatis.'
            : 'Transaksi isi saldo dibuat dan sedang menunggu pembayaran.';

      setSubmitSuccess(nextText);
      setLatestTopup(topup || null);
      setDescription('');
      await Promise.all([
        loadBalances({ silent: true, preserveSelection: true }),
        refreshLists(selectedEnvironment, { silent: true }),
      ]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Gagal membuat transaksi isi saldo.');
    } finally {
      setSubmittingTopup(false);
    }
  }, [
    amountMajor,
    authFetch,
    currency,
    loadBalances,
    paymentMethod,
    prefillSource,
    prefillTransactionId,
    refreshLists,
    resolvedDescription,
    selectedEnvironment,
  ]);

  const settleDevTopup = useCallback(
    async (topupId: string) => {
      if (!topupId || settlingId) return;
      setSettlingId(topupId);
      setSubmitError(null);
      try {
        const res = await authFetch(`/api/wallet/topups/${encodeURIComponent(topupId)}/settle-dev`, {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': createIdempotencyKey('wallet-settle'),
          },
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(payload.error || 'Gagal menyelesaikan transaksi dev.');
        }
        setSubmitSuccess('Transaksi dev berhasil diselesaikan.');
        await Promise.all([
          loadBalances({ silent: true, preserveSelection: true }),
          refreshLists(selectedEnvironment, { silent: true }),
        ]);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Gagal menyelesaikan transaksi dev.');
      } finally {
        setSettlingId(null);
      }
    },
    [authFetch, loadBalances, refreshLists, selectedEnvironment, settlingId],
  );

  const cancelTopup = useCallback(
    async (topupId: string) => {
      if (!topupId || cancellingId) return;
      setCancellingId(topupId);
      setSubmitError(null);
      try {
        const res = await authFetch(`/api/wallet/topups/${encodeURIComponent(topupId)}/cancel`, {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': createIdempotencyKey('wallet-topup-cancel'),
          },
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(payload.error || 'Gagal membatalkan transaksi isi saldo.');
        }
        setSubmitSuccess('Transaksi isi saldo berhasil dibatalkan.');
        await Promise.all([
          loadBalances({ silent: true, preserveSelection: true }),
          refreshLists(selectedEnvironment, { silent: true }),
        ]);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Gagal membatalkan transaksi isi saldo.');
      } finally {
        setCancellingId(null);
      }
    },
    [authFetch, cancellingId, loadBalances, refreshLists, selectedEnvironment],
  );

  const syncTopupStatus = useCallback(
    async (topupId: string) => {
      if (!topupId || syncingId) return;
      setSyncingId(topupId);
      setSubmitError(null);
      try {
        const res = await authFetch(`/api/wallet/topups/${encodeURIComponent(topupId)}/sync`, {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': createIdempotencyKey('wallet-topup-sync'),
          },
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          synced?: boolean;
          reason?: string;
          topup?: WalletTopup;
        };
        if (!res.ok) {
          throw new Error(payload.error || 'Gagal menyinkronkan status pembayaran.');
        }
        if (payload.topup && typeof payload.topup === 'object') {
          setLatestTopup(payload.topup);
        }
        setSubmitSuccess(
          payload.synced
            ? 'Status pembayaran berhasil disinkronkan dari Midtrans.'
            : `Status pembayaran belum berubah (${payload.reason || 'masih menunggu bayar'}).`,
        );
        await Promise.all([
          loadBalances({ silent: true, preserveSelection: true }),
          refreshLists(selectedEnvironment, { silent: true }),
        ]);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Gagal menyinkronkan status pembayaran.');
      } finally {
        setSyncingId(null);
      }
    },
    [authFetch, loadBalances, refreshLists, selectedEnvironment, syncingId],
  );

  if (authLoading) {
    return <PaymentsPageSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-6 sm:px-6">
        <div className="ui-feed-section rounded-none border border-x-0 border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-center shadow-sm sm:rounded-2xl sm:border-x">
          <p className="text-sm text-[color:var(--app-text)]">Login diperlukan untuk mengakses dompet dan isi saldo.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="ui-page-stack mx-auto w-full max-w-[var(--app-max-width)] px-0 py-3 sm:p-6">
      {redirectBanner || transactionPrefillBanner ? (
        <div className="ui-feed-section border-0 bg-transparent p-0">
          {redirectBanner ? (
            <p className={`ui-feed-row rounded-2xl border px-3 py-2 text-xs ${redirectBanner.className}`}>{redirectBanner.message}</p>
          ) : null}
          {transactionPrefillBanner ? (
            <p className={`ui-feed-row mt-2 rounded-2xl border px-3 py-2 text-xs ${transactionPrefillBanner.className}`}>
              {transactionPrefillBanner.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="ui-feed-section hidden border-0 bg-transparent p-0 sm:block">
        <div className="rounded-[1.5rem] bg-[linear-gradient(155deg,#0f172a_0%,#0f3d68_52%,#0d9488_100%)] p-4 text-white shadow-[0_22px_52px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/90">Isi saldo cepat</p>
              <h1 className="mt-2 text-[1.6rem] font-black tracking-[-0.05em] sm:text-[2.25rem]">
                Pilih nominal, pilih metode, bayar.
              </h1>
              <p className="mt-2 text-sm text-cyan-50/88">
                Flow-nya saya ringkas jadi tiga langkah saja. Yang penting kelihatan dulu, sisanya baru dibuka kalau memang perlu.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[31rem]">
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">1. Dompet</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {selectedEnvironment === 'live' ? 'Saldo utama' : 'Mode coba dulu'}
                </p>
                <p className="mt-1 text-[11px] text-cyan-50/80">Pilih tujuan saldo sebelum bikin tagihan.</p>
              </div>
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">2. Nominal</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {normalizedAmountMajor > 0 ? moneyFromCents(estimatedTopupCents, selectedCurrency) : 'Isi nominal'}
                </p>
                <p className="mt-1 text-[11px] text-cyan-50/80">Bisa pilih preset atau ketik sendiri.</p>
              </div>
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">3. Bayar</p>
                <p className="mt-1 text-sm font-bold text-white">{paymentMethodDisplayLabel(paymentMethod)}</p>
                <p className="mt-1 text-[11px] text-cyan-50/80">{paymentMethodNextStep(paymentMethod)}</p>
              </div>
            </div>
          </div>

          {loadingBalances ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                  <Skeleton className="h-3 w-24 bg-white/20" />
                  <Skeleton className="mt-2 h-7 w-28 bg-white/20" />
                </div>
              ))}
            </div>
          ) : balanceError ? (
            <p className="mt-3 rounded-[1rem] border border-white/18 bg-white/10 px-4 py-3 text-sm text-rose-100">{balanceError}</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">Saldo sekarang</p>
                <p className="mt-1.5 text-lg font-black text-white sm:text-xl">
                  {moneyFromCents(selectedAccount?.available_balance_cents || 0, selectedAccount?.currency || 'IDR')}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">Akan masuk ke</p>
                <p className="mt-1.5 text-sm font-bold text-white">
                  {selectedEnvironment === 'live' ? 'Saldo utama' : 'Saldo simulasi'}
                </p>
                <p className="mt-1 text-[11px] text-cyan-50/80">
                  Ditahan {moneyFromCents(selectedAccount?.held_balance_cents || 0, selectedAccount?.currency || 'IDR')}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/12 bg-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/80">Perkiraan setelah isi</p>
                <p className="mt-1.5 text-lg font-black text-white sm:text-xl">
                  {moneyFromCents(projectedAvailableBalanceCents, selectedAccount?.currency || selectedCurrency)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden">
        <div className="rounded-[1.35rem] bg-[linear-gradient(155deg,#0f172a_0%,#0f3d68_52%,#0d9488_100%)] p-3.5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/90">Payments</p>
              <h1 className="mt-1 text-[1.35rem] font-black tracking-[-0.05em]">Bayar cepat</h1>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadBalances();
                void refreshLists(selectedEnvironment);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-cyan-50"
              aria-label="Muat ulang saldo"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-cyan-50">
              {selectedEnvironment === 'live' ? 'Saldo utama' : 'Mode coba dulu'}
            </span>
            <span className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-cyan-50">
              {loadingBalances
                ? 'Memuat saldo...'
                : moneyFromCents(selectedAccount?.available_balance_cents || 0, selectedAccount?.currency || 'IDR')}
            </span>
            <span className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-cyan-50">
              {paymentMethodDisplayLabel(paymentMethod)}
            </span>
          </div>
        </div>
      </div>

      <div className="ui-page-section space-y-2 sm:hidden">
        {actionableTopup ? (
          <div className="rounded-[1.05rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {actionableTopup.status === 'pending' ? 'Bayar sekarang' : 'Pembayaran terakhir'}
                </p>
                <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">
                  {moneyFromCents(actionableTopup.amount_cents, actionableTopup.currency)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${topupStatusClass(actionableTopup.status)}`}>
                {(() => {
                  const StatusIcon = topupStatusIcon(actionableTopup.status);
                  return <StatusIcon className="h-3 w-3" />;
                })()}
                {topupStatusLabel(actionableTopup.status)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[color:var(--app-text-soft)]">
              <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                {paymentMethodDisplayLabel(actionableTopup.payment_method)}
              </span>
              {actionableDueAt && actionableTopup.status === 'pending' ? (
                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                  {remainingCountdownLabel(actionableDueAt, nowMs)}
                </span>
              ) : null}
            </div>
            {actionableReference && !actionableTopup.checkout_url ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-[0.9rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">{actionableReference.label}</p>
                  <p className="truncate font-mono text-[11px] font-semibold text-[color:var(--app-text)]">{actionableReference.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyInstructionValue(actionableReference.label, actionableReference.value)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2 py-1 text-[9px] font-semibold text-[color:var(--app-info)]"
                >
                  <Copy className="h-3 w-3" />
                  Salin
                </button>
              </div>
            ) : null}
            <div className="mt-2 flex gap-1.5">
              {actionableTopup.checkout_url ? (
                <a
                  href={actionableTopup.checkout_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[0.95rem] bg-[color:var(--app-accent)] px-3 py-2.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)]"
                >
                  Buka pembayaran
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {actionableTopup.status === 'pending' && actionableTopup.payment_provider === 'midtrans' ? (
                <button
                  type="button"
                  onClick={() => void syncTopupStatus(actionableTopup.id)}
                  disabled={syncingId === actionableTopup.id}
                  className="inline-flex items-center justify-center gap-1 rounded-[0.95rem] bg-[color:var(--app-surface-muted)] px-3 py-2.5 text-[11px] font-semibold text-[color:var(--app-text)] disabled:opacity-50"
                >
                  {syncingId === actionableTopup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  Cek
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDetailTopup(actionableTopup)}
                  className="inline-flex items-center justify-center gap-1 rounded-[0.95rem] bg-[color:var(--app-surface-muted)] px-3 py-2.5 text-[11px] font-semibold text-[color:var(--app-text)]"
                >
                  Detail
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-[1.05rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-[color:var(--app-text)]">Isi saldo</h2>
            </div>
            <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
              {loadingBalances
                ? 'Memuat...'
                : moneyFromCents(selectedAccount?.available_balance_cents || 0, selectedAccount?.currency || 'IDR')}
            </span>
          </div>

          {envOptions.length > 1 ? (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {envOptions.map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setSelectedEnvironment(env)}
                  className={`rounded-[0.9rem] px-2.5 py-2 text-[10px] font-semibold ${
                    selectedEnvironment === env
                      ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                      : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                  }`}
                >
                  {env === 'development' ? 'Coba dulu' : 'Saldo utama'}
                </button>
              ))}
            </div>
          ) : null}

          {balances && selectedEnvironment === 'live' && !balances.live_enabled ? (
            <p className="mt-2 rounded-[0.9rem] border border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] px-2.5 py-2 text-[11px] text-[color:var(--app-warning)]">
              Saldo utama belum aktif.
            </p>
          ) : null}

          <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Nominal</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-3 py-2.5">
            <span className="text-sm font-black text-[color:var(--app-accent)]">Rp</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={amountMajor}
              onChange={(event) => setAmountMajor(event.target.value)}
              className="w-full bg-transparent text-[1.15rem] font-black tracking-[-0.03em] text-[color:var(--app-text)] outline-none"
              placeholder="50000"
            />
          </div>

          {selectedCurrency === 'IDR' ? (
            <div className="mt-2 -mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-1">
              {TOPUP_PRESETS_IDR.map((preset) => {
                const active = normalizedAmountMajor === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountMajor(String(preset))}
                    className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${
                      active
                        ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] text-[color:var(--app-accent)]'
                        : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] text-[color:var(--app-text)]'
                    }`}
                  >
                    Rp {preset.toLocaleString('id-ID')}
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Metode</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {mobileMethods.map((method) => {
              const active = paymentMethod === method.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`rounded-[0.95rem] border px-2 py-2 text-center text-[10px] font-semibold leading-tight ${
                    active
                      ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] text-[color:var(--app-text)]'
                  }`}
                >
                  {paymentMethodDisplayLabel(method.value)}
                </button>
              );
            })}
          </div>

          {submitError ? (
            <p className="mt-2 rounded-[0.9rem] border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-2.5 py-2 text-[11px] text-[color:var(--app-danger)]">
              {submitError}
            </p>
          ) : null}
          {submitSuccess ? (
            <p className="mt-2 rounded-[0.9rem] border border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] px-2.5 py-2 text-[11px] text-[color:var(--app-accent)]">
              {submitSuccess}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void submitTopup()}
            disabled={submittingTopup || (selectedEnvironment === 'live' && !balances?.live_enabled)}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[color:var(--app-accent)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-50"
          >
            {submittingTopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {submittingTopup ? 'Menyiapkan...' : 'Bayar sekarang'}
          </button>
        </div>

        <DetailAccordion
          title="Riwayat"
          description="Kalau perlu cek pembayaran lama."
          className="hidden"
        >
          {topupsLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          ) : topupsError ? (
            <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
              {topupsError}
            </p>
          ) : recentTopups.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[color:var(--app-border-strong)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
              Belum ada riwayat.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentTopups.map((topup) => (
                <div key={topup.id} className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[color:var(--app-accent)]">
                      {moneyFromCents(topup.amount_cents, topup.currency)}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${topupStatusClass(topup.status)}`}>
                      {topupStatusLabel(topup.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                    {paymentMethodDisplayLabel(topup.payment_method)} • {dateTimeLabel(topup.created_at)}
                  </p>
                  {(topup.checkout_url || topup.status === 'pending') ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailTopup(topup)}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-[10px] font-semibold text-[color:var(--app-text)]"
                      >
                        Detail
                      </button>
                      {topup.checkout_url ? (
                        <a
                          href={topup.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-[10px] font-semibold text-[color:var(--app-info)]"
                        >
                          Buka
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </DetailAccordion>
      </div>

      <div className="ui-page-section hidden grid-cols-1 gap-2.5 sm:grid sm:gap-3 lg:grid-cols-5">
        <div className="ui-feed-section lg:col-span-3 rounded-[1.45rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3.5 shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                Flow isi saldo
              </p>
              <h2 className="mt-1.5 text-base font-black tracking-[-0.03em] text-[color:var(--app-text)] sm:text-lg">
                Tiga langkah, selesai.
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                Fokus ke yang wajib dulu. Riwayat dan pengaturan tambahan saya simpan di panel bawah.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadBalances();
                void refreshLists(selectedEnvironment);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--app-surface-muted)_70%,white_30%)]"
              aria-label="Muat ulang saldo"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-[1.2rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-sm font-black text-[color:var(--app-text-inverse)]">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)]">Pilih dompet tujuan</p>
                      <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                        {selectedEnvironment === 'live'
                          ? 'Saldo ini dipakai untuk transaksi asli.'
                          : 'Cocok untuk coba flow tanpa pusing.'}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      <Wallet className="mr-1.5 h-3.5 w-3.5" />
                      {selectedEnvironment === 'live' ? 'Saldo utama' : 'Mode coba dulu'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {envOptions.map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setSelectedEnvironment(env)}
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                          selectedEnvironment === env
                            ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_14px_28px_color-mix(in_srgb,var(--app-accent)_24%,transparent)]'
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--app-surface-muted)_70%,white_30%)]'
                        }`}
                      >
                        {env === 'development' ? 'Coba dulu' : 'Saldo utama'}
                      </button>
                    ))}
                  </div>
                  {selectedEnvironment === 'live' && !balances?.live_enabled ? (
                    <p className="mt-3 rounded-[0.95rem] border border-[color:color-mix(in_srgb,_var(--app-warning-border)_30%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-warning)]">
                      Saldo utama belum aktif. Gunakan mode coba dulu dulu.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[color:var(--app-text-soft)]">
                      Saldo {loadingBalances ? 'memuat...' : moneyFromCents(selectedAccount?.available_balance_cents || 0, selectedAccount?.currency || 'IDR')}
                    </span>
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[color:var(--app-text-soft)]">
                      Total isi {loadingBalances ? 'memuat...' : moneyFromCents(selectedAccount?.total_topup_cents || 0, selectedAccount?.currency || 'IDR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-sm font-black text-[color:var(--app-text-inverse)]">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[color:var(--app-text)]">Tentukan nominal</p>
                  <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                    Pilih nominal populer atau ketik sesuai kebutuhanmu.
                  </p>
                  <div className="mt-3 flex items-center gap-2.5 rounded-[1.1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 py-3">
                    <span className="text-lg font-black text-[color:var(--app-accent)]">Rp</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={amountMajor}
                      onChange={(event) => setAmountMajor(event.target.value)}
                      className="w-full bg-transparent text-[1.5rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] outline-none placeholder:text-[color:color-mix(in_srgb,var(--app-text-soft)_70%,transparent)] sm:text-[1.9rem]"
                      placeholder="100000"
                    />
                    <span className="inline-flex rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {selectedCurrency}
                    </span>
                  </div>
                  {selectedCurrency === 'IDR' ? (
                    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      {TOPUP_PRESETS_IDR.map((preset) => {
                        const active = normalizedAmountMajor === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAmountMajor(String(preset))}
                            className={`rounded-[0.95rem] border px-2.5 py-2 text-left transition ${
                              active
                                ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] text-[color:var(--app-accent)] shadow-[0_12px_24px_color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                                : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]'
                            }`}
                          >
                            <p className="text-[11px] font-black sm:text-sm">Rp {preset.toLocaleString('id-ID')}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-sm font-black text-[color:var(--app-text-inverse)]">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)]">Pilih metode bayar</p>
                      <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                        Saya tampilkan yang paling sering dipakai dulu.
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                      {paymentMethodGroupLabel(paymentMethod)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {quickMethods.map((method) => {
                      const MethodChoiceIcon = paymentMethodIcon(method.value, method.value);
                      const active = paymentMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value)}
                          className={`rounded-[1rem] border p-2.5 text-left transition ${
                            active
                              ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] shadow-[0_12px_24px_color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                              : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface-muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0">
                              <Image
                                src={method.image || '/images/payments/bank-transfer.svg'}
                                alt={method.label}
                                width={44}
                                height={44}
                                className="h-10 w-10 rounded-[0.9rem] object-contain"
                              />
                              <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] text-[color:var(--app-info)]">
                                <MethodChoiceIcon className="h-3 w-3" />
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-[color:var(--app-text)] sm:text-sm">
                                {paymentMethodDisplayLabel(method.value)}
                              </p>
                              <p className="mt-0.5 hidden line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:block">
                                {method.hint}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {secondaryMethods.length ? (
                    <DetailAccordion
                      title="Metode lain"
                      description="Buka kalau metode favoritmu belum ada di atas."
                      className="mt-3 rounded-[1rem] p-2.5"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {secondaryMethods.map((method) => {
                          const active = paymentMethod === method.value;
                          return (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => setPaymentMethod(method.value)}
                              className={`rounded-[0.95rem] border px-3 py-2 text-left transition ${
                                active
                                  ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)]'
                                  : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface-muted)]'
                              }`}
                            >
                              <p className="text-[12px] font-semibold text-[color:var(--app-text)]">
                                {paymentMethodDisplayLabel(method.value)}
                              </p>
                              <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">{method.hint}</p>
                            </button>
                          );
                        })}
                      </div>
                    </DetailAccordion>
                  ) : null}

                  <div className="mt-3 rounded-[1rem] border border-[color:color-mix(in_srgb,_var(--app-info-border)_24%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-3 py-2.5 text-sm text-[color:var(--app-info)]">
                    <p className="font-semibold">{paymentMethodDisplayLabel(paymentMethod)}</p>
                    <p className="mt-1 text-[12px]">{selectedMethodMeta.hint}</p>
                    <p className="mt-1 text-[12px]">{selectedMethodNextStep}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[color:color-mix(in_srgb,_var(--app-accent-border)_34%,_transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-accent-soft)_20%,white_80%),color-mix(in_srgb,var(--app-surface-strong)_90%,var(--app-accent-soft)_10%))] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    Ringkasan sebelum bayar
                  </p>
                  <h3 className="mt-1.5 text-base font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                    Tinggal buat tagihan lalu lanjut bayar.
                  </h3>
                </div>
                <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--app-accent-border)_40%,transparent)] bg-[color:var(--app-surface)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-accent)]">
                  {paymentMethodDisplayLabel(paymentMethod)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Isi saldo</p>
                  <p className="mt-1.5 text-base font-black text-[color:var(--app-text)]">
                    {normalizedAmountMajor > 0 ? moneyFromCents(estimatedTopupCents, selectedCurrency) : 'Isi nominal dulu'}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Masuk ke</p>
                  <p className="mt-1.5 text-sm font-bold text-[color:var(--app-text)]">
                    {selectedEnvironment === 'live' ? 'Saldo utama' : 'Saldo simulasi'}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Setelah berhasil</p>
                  <p className="mt-1.5 text-sm font-bold text-[color:var(--app-accent)]">
                    {moneyFromCents(projectedAvailableBalanceCents, selectedAccount?.currency || selectedCurrency)}
                  </p>
                </div>
              </div>

              {submitError ? (
                <p className="mt-3 rounded-[1rem] border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-3 py-2.5 text-xs text-[color:var(--app-danger)]">
                  {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p className="mt-3 rounded-[1rem] border border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] px-3 py-2.5 text-xs text-[color:var(--app-accent)]">
                  {submitSuccess}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void submitTopup()}
                disabled={submittingTopup || (selectedEnvironment === 'live' && !balances?.live_enabled)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_18px_34px_color-mix(in_srgb,var(--app-accent)_26%,transparent)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-50"
              >
                {submittingTopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                {submittingTopup ? 'Menyiapkan pembayaran...' : 'Buat tagihan & lanjut bayar'}
              </button>
            </div>

            <div className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-3 py-3 text-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                Dibuat otomatis
              </p>
              <p className="mt-2 text-[color:var(--app-text)]">
                Catatan pembayaran saya isi otomatis dan mata uang tetap {selectedCurrency}.
              </p>
              <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">
                {resolvedDescription}
              </p>
              {selectedEnvironment === 'development' ? (
                <p className="mt-2 text-[12px] text-[color:var(--app-text-soft)]">
                  Mode coba dulu tetap mengikuti alur pembayaran, jadi aman dipakai untuk cek flow.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 lg:col-span-2">
          <div className="rounded-[1.35rem] border border-[color:var(--app-border-strong)] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--app-surface-strong)_94%,white_6%),color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong)_78%))] p-3.5 shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
            {actionableTopup ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                      {actionableTopup.status === 'pending' ? 'Lanjutkan pembayaran' : 'Top up terakhir'}
                    </p>
                    <h2 className="mt-1.5 text-base font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                      {actionableTopup.status === 'pending'
                        ? 'Pembayaran aktif selalu saya taruh di depan.'
                        : 'Status terakhir tetap kelihatan jelas.'}
                    </h2>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${topupStatusClass(actionableTopup.status)}`}>
                    {(() => {
                      const StatusIcon = topupStatusIcon(actionableTopup.status);
                      return <StatusIcon className="h-3.5 w-3.5" />;
                    })()}
                    {topupStatusLabel(actionableTopup.status)}
                  </span>
                </div>

                <div className="mt-3 rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">Nominal</p>
                  <p className="mt-1.5 text-lg font-black text-[color:var(--app-text)]">
                    {moneyFromCents(actionableTopup.amount_cents, actionableTopup.currency)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--app-text-soft)]">
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                      {paymentMethodDisplayLabel(actionableTopup.payment_method)}
                    </span>
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                      {actionableTopup.environment === 'live' ? 'Masuk ke saldo utama' : 'Masuk ke saldo simulasi'}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-[color:var(--app-text-soft)]">
                    {actionableTopup.status === 'pending'
                      ? paymentMethodNextStep(actionableTopup.payment_method || actionableInstruction?.paymentType)
                      : actionableTopup.status === 'paid'
                        ? `Terbayar ${dateTimeLabel(actionableTopup.paid_at || actionableTopup.updated_at)}`
                        : `Status update ${dateTimeLabel(actionableTopup.updated_at)}`}
                  </p>
                  {actionableDueAt ? (
                    <p
                      className={`mt-2 text-[12px] ${
                        actionableTopup.status === 'pending' && actionableDueAt.getTime() <= nowMs
                          ? 'text-[color:var(--app-danger)]'
                          : 'text-[color:var(--app-warning)]'
                      }`}
                    >
                      Batas bayar {dateTimeLabel(actionableDueAt.toISOString())}
                      {actionableTopup.status === 'pending' ? ` | ${remainingCountdownLabel(actionableDueAt, nowMs)}` : ''}
                    </p>
                  ) : null}
                </div>

                {actionableReference ? (
                  <div className="mt-3 rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                      {actionableReference.label}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-sm font-semibold text-[color:var(--app-text)]">
                        {actionableReference.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyInstructionValue(actionableReference.label, actionableReference.value)}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                      >
                        <Copy className="h-3 w-3" />
                        Salin
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">1</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Buka halaman pembayaran atau detail.</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">2</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Selesaikan bayar sesuai metode yang dipilih.</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">3</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Saldo akan diperbarui otomatis setelah sukses.</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailTopup(actionableTopup)}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                  >
                    Lihat detail bayar
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  {actionableTopup.checkout_url ? (
                    <a
                      href={actionableTopup.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                    >
                      Buka pembayaran
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {actionableTopup.status === 'pending' && actionableTopup.payment_provider === 'midtrans' ? (
                    <button
                      type="button"
                      onClick={() => void syncTopupStatus(actionableTopup.id)}
                      disabled={syncingId === actionableTopup.id || cancellingId === actionableTopup.id || settlingId === actionableTopup.id}
                      className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] disabled:opacity-50"
                    >
                      {syncingId === actionableTopup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                      {syncingId === actionableTopup.id ? 'Menyinkronkan...' : 'Cek status'}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  Belum ada pembayaran aktif
                </p>
                <h2 className="mt-1.5 text-base font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                  Begitu bikin tagihan, statusnya muncul di sini.
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">1</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Pilih nominal dan metode di panel kiri.</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">2</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Tekan tombol bayar untuk membuat tagihan.</p>
                  </div>
                  <div className="rounded-[0.95rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">3</p>
                    <p className="mt-1 text-[12px] text-[color:var(--app-text)]">Selesaikan pembayaran, lalu saldo masuk otomatis.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DetailAccordion
            title="Riwayat isi saldo"
            description="Buka kalau perlu cek transaksi lama atau lanjutkan pembayaran yang lain."
            className="rounded-[1.35rem] p-3.5 shadow-[0_14px_38px_rgba(15,23,42,0.08)]"
          >
            {topupsLoading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="ui-feed-row rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : topupsError ? (
              <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
                {topupsError}
              </p>
            ) : topups.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[color:var(--app-border-strong)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                Belum ada riwayat isi saldo di mode ini.
              </p>
            ) : (
              <div className="mt-2.5 space-y-1.5 max-h-[23rem] overflow-auto pr-1">
                {topups.map((topup) => {
                  const dueAt = parseTopupPaymentDueAt(topup);
                  const isPending = topup.status === 'pending';
                  const isOverdue = Boolean(dueAt && dueAt.getTime() <= nowMs);
                  const instruction = extractPaymentInstructionView(topup);
                  const hasInstruction = hasPaymentInstructionData(topup, instruction);
                  const StatusIcon = topupStatusIcon(topup.status);
                  const MethodIcon = paymentMethodIcon(
                    topup.payment_method,
                    instruction?.paymentType,
                  );
                  return (
                    <div key={topup.id} className="ui-feed-row rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1.5 text-[13px] font-black text-[color:var(--app-accent)] sm:text-sm">
                          <MethodIcon className="h-4 w-4 text-[color:var(--app-info)]" />
                          {moneyFromCents(topup.amount_cents, topup.currency)}
                        </p>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${topupStatusClass(topup.status)}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {topupStatusLabel(topup.status)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--app-text-soft)]">
                        {topup.payment_method ? (
                          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">
                            metode: {paymentMethodDisplayLabel(topup.payment_method)}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">{dateTimeLabel(topup.created_at)}</span>
                        {topup.external_reference ? (
                          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5">{topup.external_reference}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                        {topup.status === 'paid'
                          ? `Terbayar ${dateTimeLabel(topup.paid_at || topup.updated_at)}`
                          : topup.status === 'pending'
                            ? 'Menunggu konfirmasi pembayaran'
                            : `Status update ${dateTimeLabel(topup.updated_at)}`}
                      </p>
                      {dueAt && (
                        <p
                          className={`mt-1 text-[11px] ${
                            isPending && isOverdue ? 'text-[color:var(--app-danger)]' : 'text-[color:var(--app-warning)]'
                          }`}
                        >
                          Batas bayar {dateTimeLabel(dueAt.toISOString())}
                          {isPending ? ` | ${remainingCountdownLabel(dueAt, nowMs)}` : ''}
                        </p>
                      )}

                      {(topup.checkout_url || topup.status === 'pending' || hasInstruction) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailTopup(topup)}
                            className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                          >
                            {hasInstruction ? 'Lihat detail' : 'Lihat status'}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>

                          {topup.checkout_url ? (
                            <a
                              href={topup.checkout_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                            >
                              Buka pembayaran
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          ) : null}

                          {topup.environment === 'development' &&
                          topup.status === 'pending' &&
                          topup.payment_provider !== 'midtrans' ? (
                            <button
                              type="button"
                              onClick={() => void settleDevTopup(topup.id)}
                              disabled={settlingId === topup.id || cancellingId === topup.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)] disabled:opacity-50"
                            >
                              {settlingId === topup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Selesaikan dev
                            </button>
                          ) : null}

                          {topup.status === 'pending' && topup.payment_provider === 'midtrans' ? (
                            <button
                              type="button"
                              onClick={() => void syncTopupStatus(topup.id)}
                              disabled={syncingId === topup.id || cancellingId === topup.id || settlingId === topup.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] disabled:opacity-50"
                            >
                              {syncingId === topup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                              {syncingId === topup.id ? 'Menyinkronkan...' : 'Sinkronkan status'}
                            </button>
                          ) : null}

                          {topup.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => void cancelTopup(topup.id)}
                              disabled={cancellingId === topup.id || settlingId === topup.id || syncingId === topup.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-danger)] hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] disabled:opacity-50"
                            >
                              {cancellingId === topup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                              {cancellingId === topup.id ? 'Membatalkan...' : 'Batalkan'}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DetailAccordion>

          <DetailAccordion
            title="Mutasi saldo"
            description="Tetap ada, tapi disembunyikan dulu biar halaman fokus."
            className="rounded-[1.35rem] p-3.5 shadow-[0_14px_38px_rgba(15,23,42,0.08)]"
          >
            {ledgerLoading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : ledgerError ? (
              <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
                {ledgerError}
              </p>
            ) : ledger.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[color:var(--app-border-strong)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                Belum ada mutasi saldo di mode ini.
              </p>
            ) : (
              <div className="mt-2.5 space-y-1.5 max-h-[20rem] overflow-auto pr-1">
                {ledger.map((entry) => (
                  <div key={entry.id} className="rounded-[1rem] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-sm font-black ${entry.direction === 'credit' ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-danger)]'}`}>
                        {entry.direction === 'credit' ? '+' : '-'}
                        {moneyFromCents(entry.amount_cents, entry.currency)}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                        <Clock3 className="h-3.5 w-3.5" />
                        {dateTimeLabel(entry.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      {entry.entry_type} - saldo setelah transaksi {moneyFromCents(entry.balance_after_cents, entry.currency)}
                    </p>
                    {entry.description ? (
                      <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">{entry.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </DetailAccordion>
        </div>
      </div>

      <Modal
        open={Boolean(detailTopup)}
        title="Detail pembayaran"
        onClose={() => setDetailTopup(null)}
        className="max-w-2xl border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
      >
        {detailTopup ? (
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--app-text-soft)]">Ringkasan</p>
              <p className="mt-1 text-sm font-bold text-[color:var(--app-accent)]">
                {moneyFromCents(detailTopup.amount_cents, detailTopup.currency)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${topupStatusClass(detailTopup.status)}`}>
                  {(() => {
                    const StatusIcon = topupStatusIcon(detailTopup.status);
                    return <StatusIcon className="h-3.5 w-3.5" />;
                  })()}
                  {topupStatusLabel(detailTopup.status)}
                </span>
                {detailTopup.payment_method ? (
                  <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[color:var(--app-text-soft)]">
                    metode: {paymentMethodDisplayLabel(detailTopup.payment_method)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 break-all text-[color:var(--app-text-soft)]">
                Referensi: {detailTopup.external_reference || '-'}
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--app-text-soft)]">Dompet tujuan</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-info)]">
                {detailTopup.environment === 'live' ? 'Saldo utama' : 'Saldo simulasi'} ({detailTopup.currency})
              </p>
              <p className="mt-1 break-all text-[color:var(--app-text-soft)]">ID akun: {detailTopup.account_id}</p>
              {detailAccount ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-2">
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--app-text-soft)]">Saldo Sekarang</p>
                    <p className="mt-1 text-sm font-bold text-[color:var(--app-accent)]">
                      {moneyFromCents(detailAccount.available_balance_cents, detailAccount.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-2">
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--app-text-soft)]">
                      {detailTopup.status === 'paid' ? 'Saldo setelah berhasil' : 'Estimasi setelah berhasil'}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[color:var(--app-info)]">
                      {moneyFromCents(expectedAfterPaidCents || 0, detailAccount.currency)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--app-text-soft)]">Instruksi pembayaran</p>
              {detailInstruction ? (
                <div className="mt-2 space-y-2 text-[color:var(--app-text-soft)]">
                  {detailInstruction.transactionId ? (
                    <p className="break-all">ID transaksi: {detailInstruction.transactionId}</p>
                  ) : null}
                  {detailInstruction.transactionStatus ? (
                    <p>Status pembayaran: {detailInstruction.transactionStatus}</p>
                  ) : null}
                  {detailInstruction.expiryTime ? (
                    <p>Batas dari gateway: {detailInstruction.expiryTime}</p>
                  ) : null}

                  {detailInstruction.vaNumbers.length ? (
                    <div className="space-y-1.5">
                      {detailInstruction.vaNumbers.map((va) => (
                        <div key={`${va.bank}-${va.number}`} className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-1.5 py-0.5 font-semibold text-[color:var(--app-info)]">
                            {va.bank || 'VA'}
                          </span>
                          <span className="break-all font-mono font-semibold">{va.number}</span>
                          <button
                            type="button"
                            onClick={() => void copyInstructionValue(`nomor ${va.bank || 'VA'}`, va.number)}
                            className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                          >
                            <Copy className="h-3 w-3" />
                            Salin
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {detailInstruction.permataVa ? (
                    <p className="break-all">
                      Permata VA: <span className="font-mono font-semibold">{detailInstruction.permataVa}</span>
                    </p>
                  ) : null}
                  {detailInstruction.billKey ? (
                    <p className="break-all">
                      Bill Key: <span className="font-mono font-semibold">{detailInstruction.billKey}</span>
                      {detailInstruction.billerCode ? ` | Kode biller: ${detailInstruction.billerCode}` : ''}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-[color:var(--app-text-soft)]">Instruksi belum tersedia saat ini.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {detailInstruction?.qrUrl ? (
                <a
                  href={detailInstruction.qrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                >
                  Buka QR
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {detailInstruction?.deeplinkUrl ? (
                <a
                  href={detailInstruction.deeplinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                >
                  Buka aplikasi
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {detailTopup.checkout_url ? (
                <a
                  href={detailTopup.checkout_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                >
                  Buka pembayaran
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {detailTopup.status === 'pending' && detailTopup.payment_provider === 'midtrans' ? (
                <button
                  type="button"
                  onClick={() => void syncTopupStatus(detailTopup.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Sinkronkan status
                </button>
              ) : null}
              {detailTopup.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => void cancelTopup(detailTopup.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-danger)] hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)]"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Batalkan
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
