'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShoppingBag } from 'lucide-react';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  type StorefrontCanonicalOrderBundle,
} from '@/lib/super-app/storefront-order-client';

type StorefrontProductOrderActionProps = {
  storeId: string;
  productId: string;
  productName: string;
  onlineOrderEnabled: boolean;
  productAvailable: boolean;
  isId: boolean;
};

type OrderUiState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }
  | { phase: 'success'; bundle: StorefrontCanonicalOrderBundle };

function formatCanonicalAmount(
  amount: string | number,
  currency: string,
  isId: boolean,
): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return String(amount);

  try {
    return new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${currency || 'IDR'} ${numeric.toLocaleString(isId ? 'id-ID' : 'en-US')}`;
  }
}

function messageForError(error: unknown, isId: boolean): string {
  if (!(error instanceof StorefrontOrderClientError)) {
    return isId
      ? 'Pesanan belum dapat dibuat. Coba lagi.'
      : 'The order could not be created. Please try again.';
  }

  if (error.status === 401 || error.code === 'authentication_required') {
    return isId
      ? 'Silakan masuk ke akun Lajukan terlebih dahulu untuk memesan.'
      : 'Please sign in to your Lajukan account before ordering.';
  }
  if (error.code === 'product_unavailable') {
    return isId
      ? 'Produk ini sedang tidak tersedia untuk dipesan.'
      : 'This product is currently unavailable for ordering.';
  }
  if (error.code === 'insufficient_stock') {
    return isId
      ? 'Stok produk tidak mencukupi. Muat ulang katalog untuk melihat stok terbaru.'
      : 'There is not enough stock. Reload the catalog for the latest availability.';
  }
  if (error.status === 429) {
    return isId
      ? 'Terlalu banyak percobaan. Coba lagi sebentar lagi.'
      : 'Too many attempts. Please try again shortly.';
  }
  if (error.status >= 500) {
    return isId
      ? 'Layanan pemesanan sedang tidak tersedia. Pesanan tidak dibuat.'
      : 'Ordering is temporarily unavailable. No order was created.';
  }

  return isId
    ? 'Pesanan ditolak. Periksa ketersediaan produk lalu coba lagi.'
    : 'The order was rejected. Check product availability and try again.';
}

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new StorefrontOrderClientError(500, 'idempotency_unavailable');
}

export function StorefrontProductOrderAction({
  storeId,
  productId,
  productName,
  onlineOrderEnabled,
  productAvailable,
  isId,
}: StorefrontProductOrderActionProps) {
  const [state, setState] = useState<OrderUiState>({ phase: 'idle' });
  const submitterRef = useRef<ReturnType<typeof createStorefrontOrderSubmitter> | null>(
    null,
  );
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  if (!submitterRef.current) {
    submitterRef.current = createStorefrontOrderSubmitter();
  }

  const canOrder = onlineOrderEnabled && productAvailable;
  const locked = state.phase === 'submitting' || state.phase === 'success';

  async function handleOrder() {
    if (!canOrder || locked || submittingRef.current) return;
    submittingRef.current = true;
    setState({ phase: 'submitting' });

    try {
      const idempotencyKey =
        idempotencyKeyRef.current ||
        (idempotencyKeyRef.current = createIdempotencyKey());
      const bundle = await submitterRef.current!.submit({
        storeId,
        productId,
        quantity: 1,
        idempotencyKey,
        fulfillmentMode: 'pickup',
      });
      setState({ phase: 'success', bundle });
    } catch (error) {
      setState({ phase: 'error', message: messageForError(error, isId) });
    } finally {
      submittingRef.current = false;
    }
  }

  const disabledReason = !onlineOrderEnabled
    ? isId
      ? 'Pemesanan online belum dibuka oleh toko.'
      : 'Online ordering is not enabled by this business.'
    : !productAvailable
      ? isId
        ? 'Produk ini belum tersedia untuk dipesan.'
        : 'This product is not currently available to order.'
      : null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <button
        type="button"
        onClick={handleOrder}
        disabled={!canOrder || locked}
        aria-label={
          isId ? `Pesan ${productName}` : `Order ${productName}`
        }
        data-testid="storefront-order-button"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
      >
        {state.phase === 'submitting' ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : state.phase === 'success' ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        )}
        {state.phase === 'submitting'
          ? isId
            ? 'Membuat pesanan…'
            : 'Creating order…'
          : state.phase === 'success'
            ? isId
              ? 'Pesanan dibuat'
              : 'Order created'
            : isId
              ? 'Pesan 1 produk'
              : 'Order 1 item'}
      </button>

      {disabledReason ? (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {disabledReason}
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {state.message}
        </p>
      ) : null}

      {state.phase === 'success' ? (
        <div
          role="status"
          data-testid="storefront-order-success"
          className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-100"
        >
          <p className="font-extrabold">
            {isId ? 'Referensi pesanan' : 'Order reference'}:{' '}
            <span className="font-mono">{state.bundle.order.order_number}</span>
          </p>
          <p className="mt-0.5">
            {isId ? 'Total canonical' : 'Canonical total'}:{' '}
            <strong>
              {formatCanonicalAmount(
                state.bundle.order.total_amount,
                state.bundle.order.currency,
                isId,
              )}
            </strong>
          </p>
          <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-100/75">
            {isId
              ? 'Pesanan tercatat di Marketplace. Pembayaran tidak dibuat otomatis dari halaman ini.'
              : 'The order is recorded in Marketplace. This page does not create a payment automatically.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
