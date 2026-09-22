'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import {
  resolveIdempotencyAttempt,
  type ClientIdempotencyAttempt,
} from '@/lib/client-idempotency';
import {
  sellerOrderActionLabel,
  sellerOrderBuyerLabel,
  sellerOrderItemSummary,
  sellerOrderMatchesFilter,
  sellerOrderStatusLabel,
  type SellerOrderAggregate,
  type SellerOrderFilter,
  type SellerOrderStatus,
} from '@/lib/business-control/seller-orders';

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const filters: Array<{ key: SellerOrderFilter; label: string }> = [
  { key: 'semua', label: 'Semua' },
  { key: 'perlu-aksi', label: 'Perlu aksi' },
  { key: 'PENDING_PAYMENT', label: 'Menunggu bayar' },
  { key: 'PAID', label: 'Baru' },
  { key: 'PROCESSING', label: 'Diproses' },
  { key: 'COMPLETED', label: 'Selesai' },
];

function orderTone(
  status: SellerOrderStatus,
): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'info';
  if (
    status === 'PENDING_PAYMENT' ||
    status === 'PROCESSING' ||
    status === 'SHIPPED' ||
    status === 'IN_SERVICE' ||
    status === 'DELIVERED'
  ) return 'warning';
  if (status === 'COMPLETED') return 'success';
  if (
    status === 'CANCELLED' ||
    status === 'REJECTED' ||
    status === 'EXPIRED' ||
    status === 'REFUNDED'
  ) return 'danger';
  return 'neutral';
}

function paymentLabel(status: string) {
  if (status === 'PAID') return 'Lunas';
  if (status === 'PENDING') return 'Pembayaran diproses';
  if (status === 'UNPAID') return 'Belum bayar';
  if (status === 'REFUNDED') return 'Refund';
  if (status === 'PARTIALLY_REFUNDED') return 'Refund sebagian';
  if (status === 'FAILED') return 'Pembayaran gagal';
  if (status === 'EXPIRED') return 'Pembayaran kedaluwarsa';
  return status.replaceAll('_', ' ').toLocaleLowerCase('id-ID');
}

type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'qris_manual';

type Props = {
  businessId: string;
  orders: SellerOrderAggregate[];
  canManageOrders: boolean;
};

export function OrderInboxWorkspace({
  businessId,
  orders,
  canManageOrders,
}: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<SellerOrderFilter>('semua');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(orders[0]?.order.id ?? '');
  const [reason, setReason] = useState('');
  const [busyAction, setBusyAction] = useState<SellerOrderStatus | null>(null);
  const [message, setMessage] = useState('');
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] =
    useState<ManualPaymentMethod>('cash');
  const [manualPaymentReference, setManualPaymentReference] = useState('');
  const [manualPaymentNote, setManualPaymentNote] = useState('');
  const attemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
    return orders.filter(order => {
      if (!sellerOrderMatchesFilter(order, filter)) return false;
      if (!normalizedQuery) return true;
      const itemSummary = sellerOrderItemSummary(order);
      return [
        order.order.order_number,
        sellerOrderBuyerLabel(order),
        itemSummary,
        order.order.source_surface ?? '',
        order.order.source_type ?? '',
      ].some(value =>
        value.toLocaleLowerCase('id-ID').includes(normalizedQuery),
      );
    });
  }, [filter, orders, query]);

  const selected =
    filteredOrders.find(order => order.order.id === selectedId) ??
    filteredOrders[0] ??
    null;

  async function transition(
    nextStatus: SellerOrderStatus,
    metadata?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!selected || busyAction) return false;
    const requiresReason =
      nextStatus === 'REJECTED' || nextStatus === 'CANCELLED';
    if (requiresReason && reason.trim().length < 3) {
      setMessage('Isi alasan minimal 3 karakter untuk menolak atau membatalkan.');
      return false;
    }

    const payload = {
      expected_version: selected.order.version,
      next_status: nextStatus,
      reason: reason.trim() || null,
      metadata: metadata ?? null,
    };
    const attempt = resolveIdempotencyAttempt(attemptRef.current, {
      order_id: selected.order.id,
      ...payload,
    });
    attemptRef.current = attempt;
    setBusyAction(nextStatus);
    setMessage('');

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(
          selected.order.id,
        )}/transition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        if (
          response.status === 409 &&
          result.error === 'business_order_version_conflict'
        ) {
          attemptRef.current = null;
          setMessage('Pesanan sudah berubah di perangkat lain. Data dimuat ulang.');
          startRefresh(() => router.refresh());
          return false;
        }
        if (
          response.status === 409 &&
          result.error === 'business_order_invalid_transition'
        ) {
          attemptRef.current = null;
          setMessage('Status pesanan sudah tidak cocok untuk aksi ini. Data dimuat ulang.');
          startRefresh(() => router.refresh());
          return false;
        }
        throw new Error(
          businessApiErrorMessage(
            result,
            'Perubahan status belum berhasil.',
            response.status,
          ),
        );
      }

      attemptRef.current = null;
      setReason('');
      setMessage('Status pesanan tersimpan.');
      startRefresh(() => router.refresh());
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Perubahan status belum berhasil. Coba lagi.',
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  function resetManualPayment() {
    setShowManualPayment(false);
    setManualPaymentMethod('cash');
    setManualPaymentReference('');
    setManualPaymentNote('');
  }

  async function confirmManualPayment() {
    if (!selected || selected.order.base_status !== 'PENDING_PAYMENT' || busyAction) return;

    const reference = manualPaymentReference.trim();
    const note = manualPaymentNote.trim();

    if (manualPaymentMethod !== 'cash' && reference.length < 3) {
      setMessage(
        manualPaymentMethod === 'bank_transfer'
          ? 'Isi nomor referensi / nama pengirim untuk pembayaran transfer.'
          : 'Isi referensi pembayaran QRIS manual.',
      );
      return;
    }

    const success = await transition('PAID', {
      payment_confirmation: {
        mode: 'manual',
        method: manualPaymentMethod,
        reference,
        note,
      },
    });

    if (success) resetManualPayment();
  }

  function refresh() {
    attemptRef.current = null;
    setMessage('');
    startRefresh(() => router.refresh());
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-portal-line bg-white p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f5f1] text-portal-soft">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-black text-portal-ink">Belum ada pesanan kanal</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-portal-soft">
          Pesanan checkout online akan muncul dari sumber transaksi canonical, bukan catatan metadata toko.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 space-y-3">
        <div className="portal-panel p-3 sm:p-4">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input
                className="portal-input min-h-11 w-full pl-10"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Cari nomor atau isi pesanan…"
                aria-label="Cari pesanan"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="portal-button-secondary min-h-11 px-3 disabled:opacity-50"
              aria-label="Muat ulang pesanan"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map(item => {
              const count = orders.filter(order =>
                sellerOrderMatchesFilter(order, item.key),
              ).length;
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${
                    active
                      ? 'border-portal-ink bg-portal-ink text-white'
                      : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'
                  }`}
                >
                  {item.label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-portal-line bg-white">
          {filteredOrders.length ? (
            filteredOrders.map(order => {
              const active = selected?.order.id === order.order.id;
              const summary = sellerOrderItemSummary(order);
              return (
                <button
                  key={order.order.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(order.order.id);
                    setReason('');
                    setMessage('');
                    resetManualPayment();
                    attemptRef.current = null;
                  }}
                  className={`grid w-full gap-2 border-b border-portal-line px-4 py-3 text-left last:border-b-0 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.5fr)_120px_auto] sm:items-center ${
                    active ? 'bg-[#f5f7f3]' : 'bg-white hover:bg-[#fafbf9]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-portal-ink">
                      {order.order.order_number}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-portal-soft">
                      {sellerOrderBuyerLabel(order)}
                    </p>
                  </div>
                  <p className="min-w-0 truncate text-sm text-portal-ink">{summary}</p>
                  <strong className="text-sm text-portal-ink">
                    {money.format(Number(order.order.total_amount))}
                  </strong>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <StatusBadge tone={orderTone(order.order.base_status)}>
                      {sellerOrderStatusLabel[order.order.base_status]}
                    </StatusBadge>
                    <ChevronRight className="h-4 w-4 text-portal-soft" />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-portal-ink">Pesanan tidak ditemukan</p>
              <p className="mt-1 text-xs text-portal-soft">
                Ubah pencarian atau pilih filter lain.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-3 lg:self-start">
        {selected ? (
          <div className="portal-panel overflow-hidden">
            <div className="border-b border-portal-line px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-portal-soft">
                    Detail pesanan
                  </p>
                  <h2 className="mt-1 truncate text-lg font-black text-portal-ink">
                    {selected.order.order_number}
                  </h2>
                  <p className="mt-0.5 text-xs text-portal-soft">
                    {sellerOrderBuyerLabel(selected)} · versi {selected.order.version}
                  </p>
                </div>
                <StatusBadge tone={orderTone(selected.order.base_status)}>
                  {sellerOrderStatusLabel[selected.order.base_status]}
                </StatusBadge>
              </div>
              {selected.last_transition_reason &&
              (selected.order.base_status === 'CANCELLED' ||
                selected.order.base_status === 'REJECTED') ? (
                <div className="mt-3 rounded-xl bg-red-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-red-700">
                    Alasan perubahan
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-red-900">
                    {selected.last_transition_reason}
                  </p>
                  {selected.last_transition_at ? (
                    <p className="mt-1 text-[10px] text-red-700">
                      {new Date(selected.last_transition_at).toLocaleString('id-ID')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-portal-soft">
                  Isi pesanan
                </p>
                <div className="mt-2 space-y-2">
                  {selected.items.map(item => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-portal-ink">
                        {item.item_name} × {Number(item.quantity).toLocaleString('id-ID')}
                      </span>
                      <strong className="shrink-0 text-portal-ink">
                        {money.format(Number(item.line_total))}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f5f7f3] p-3">
                  <p className="text-[10px] font-bold uppercase text-portal-soft">Pembayaran</p>
                  <p className="mt-1 text-sm font-black text-portal-ink">
                    {paymentLabel(selected.order.payment_status)}
                  </p>
                  {selected.order.payment_status === 'PAID' &&
                  selected.order.category_specific_metadata &&
                  typeof selected.order.category_specific_metadata === 'object' ? (
                    (() => {
                      const confirmation = selected.order.category_specific_metadata.payment_confirmation;
                      if (!confirmation || typeof confirmation !== 'object') return null;
                      const value = confirmation as Record<string, unknown>;
                      const method =
                        value.method === 'cash'
                          ? 'Tunai'
                          : value.method === 'bank_transfer'
                            ? 'Transfer bank'
                            : value.method === 'qris_manual'
                              ? 'QRIS manual'
                              : null;
                      return method ? (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                          {method} · manual
                        </p>
                      ) : null;
                    })()
                  ) : null}
                </div>
                <div className="rounded-xl bg-[#f5f7f3] p-3 text-right">
                  <p className="text-[10px] font-bold uppercase text-portal-soft">Total</p>
                  <p className="mt-1 text-sm font-black text-portal-ink">
                    {money.format(Number(selected.order.total_amount))}
                  </p>
                </div>
              </div>

              {selected.allowed_next_statuses.includes('PAID') &&
              selected.order.base_status === 'PENDING_PAYMENT' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">
                        Pembayaran manual
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-950">
                        Terima pembayaran di luar gateway
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        Tunai, transfer bank, atau QRIS yang dikonfirmasi langsung oleh penjual.
                      </p>
                    </div>
                    {showManualPayment ? (
                      <button
                        type="button"
                        onClick={resetManualPayment}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                        aria-label="Tutup pembayaran manual"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  {!showManualPayment ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canManageOrders) return;
                        setMessage('');
                        setShowManualPayment(true);
                      }}
                      disabled={!canManageOrders || busyAction !== null}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#008f72] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Konfirmasi pembayaran manual
                    </button>
                  ) : (
                    <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-portal-soft">
                        Metode pembayaran
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['cash', Banknote, 'Tunai'],
                          ['bank_transfer', Building2, 'Transfer'],
                          ['qris_manual', QrCode, 'QRIS'],
                        ] as const).map(([method, Icon, label]) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setManualPaymentMethod(method)}
                            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-center transition ${
                              manualPaymentMethod === method
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-black">{label}</span>
                          </button>
                        ))}
                      </div>

                      <label className="block text-xs font-semibold text-portal-ink">
                        Referensi pembayaran
                        <input
                          value={manualPaymentReference}
                          onChange={event => setManualPaymentReference(event.target.value)}
                          maxLength={120}
                          className="portal-input mt-1 w-full"
                          placeholder={
                            manualPaymentMethod === 'cash'
                              ? 'Opsional, mis. nota/manual'
                              : 'Nomor referensi atau nama pengirim'
                          }
                        />
                      </label>

                      <label className="block text-xs font-semibold text-portal-ink">
                        Catatan
                        <textarea
                          value={manualPaymentNote}
                          onChange={event => setManualPaymentNote(event.target.value)}
                          maxLength={500}
                          className="portal-input mt-1 min-h-20 w-full resize-y"
                          placeholder="Contoh: uang diterima penuh oleh kasir"
                        />
                      </label>

                      <div className="rounded-xl bg-[#f5f7f3] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-portal-soft">Jumlah dikonfirmasi</span>
                          <strong className="text-base font-black text-portal-ink">
                            {money.format(Number(selected.order.total_amount))}
                          </strong>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-portal-soft">
                          Pembayaran dicatat sebagai pembayaran manual, tanpa gateway.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={confirmManualPayment}
                        disabled={!canManageOrders || busyAction !== null}
                        className="portal-button-primary min-h-11 w-full justify-center disabled:opacity-50"
                      >
                        {busyAction === 'PAID' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Tandai sudah dibayar
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {selected.allowed_next_statuses.filter(status => status !== 'PAID').length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                        Langkah berikutnya
                      </p>
                      <div className="mt-3 grid gap-2">
                        {selected.allowed_next_statuses
                          .filter(status => status !== 'PAID')
                          .map(nextStatus => {
                            const destructive =
                              nextStatus === 'REJECTED' || nextStatus === 'CANCELLED';
                            return (
                              <button
                                key={nextStatus}
                                type="button"
                                onClick={() => transition(nextStatus)}
                                disabled={!canManageOrders || busyAction !== null}
                                className={
                                  destructive
                                    ? 'portal-button-secondary justify-center border-red-200 text-red-700 disabled:opacity-50'
                                    : 'portal-button-primary justify-center disabled:opacity-50'
                                }
                              >
                                {busyAction === nextStatus ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                {sellerOrderActionLabel(nextStatus)}
                              </button>
                            );
                          })}
                      </div>
                      {selected.allowed_next_statuses.some(
                        status => status === 'REJECTED' || status === 'CANCELLED',
                      ) ? (
                        <label className="mt-3 block text-xs font-semibold text-amber-900">
                          Alasan penolakan / pembatalan
                          <textarea
                            value={reason}
                            onChange={event => setReason(event.target.value)}
                            maxLength={500}
                            className="mt-1 min-h-20 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-portal-ink outline-none"
                            placeholder="Contoh: stok tidak tersedia"
                          />
                        </label>
                      ) : null}
                      {!canManageOrders ? (
                        <p className="mt-2 text-xs leading-5 text-amber-800">
                          Peranmu hanya dapat memantau status pesanan.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {message ? (
                <p role="status" className="text-xs font-semibold text-portal-soft">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">
            Pilih pesanan untuk melihat detail.
          </div>
        )}
      </aside>
    </div>
  );
}
