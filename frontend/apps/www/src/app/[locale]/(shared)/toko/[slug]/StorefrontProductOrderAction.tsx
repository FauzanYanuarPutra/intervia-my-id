'use client';

import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShoppingBag } from 'lucide-react';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  type StorefrontCanonicalOrderBundle,
  type StorefrontOrderLineInput,
} from '@/lib/super-app/storefront-order-client';
import { estimatedConfiguredPriceCents, parseStorefrontModifierGroups } from '@/lib/super-app/storefront-product-modifiers';
import { loadStorefrontProductCustomization } from '@/lib/super-app/storefront-product-customization-client';
import { StorefrontProductConfigurator } from './StorefrontProductConfigurator';
import { STOREFRONT_CART_EVENT, type StorefrontCartAddDetail } from './StorefrontOrderCart';

type StorefrontProductOrderActionProps = {
  storeId: string;
  productId: string;
  productName: string;
  productPriceCents?: number;
  productMetadata?: Record<string, unknown>;
  cartEnabled?: boolean;
  onlineOrderEnabled: boolean;
  productAvailable: boolean;
  isId: boolean;
  variant?: 'default' | 'compact';
};

type OrderUiState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }
  | { phase: 'success'; bundle: StorefrontCanonicalOrderBundle };

function formatCanonicalAmount(amount: string | number, currency: string, isId: boolean) {
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
    return isId ? 'Pesanan belum dapat dibuat. Coba lagi.' : 'The order could not be created. Please try again.';
  }
  if (error.status === 401 || error.code === 'authentication_required') {
    return isId ? 'Silakan masuk ke akun Lajukan terlebih dahulu untuk memesan.' : 'Please sign in to your Lajukan account before ordering.';
  }
  if (error.code === 'product_unavailable') {
    return isId ? 'Produk ini sedang tidak tersedia untuk dipesan.' : 'This product is currently unavailable for ordering.';
  }
  if (error.code === 'insufficient_stock') {
    return isId ? 'Stok tidak cukup untuk total semua racikan yang dipilih.' : 'There is not enough stock for all selected configurations.';
  }
  if (error.code.includes('modifier')) {
    return isId ? 'Pilihan produk berubah atau sudah tidak tersedia. Pilih ulang sebelum memesan.' : 'The product options changed or are no longer available. Please choose again.';
  }
  if (error.status === 429) {
    return isId ? 'Terlalu banyak percobaan. Coba lagi sebentar lagi.' : 'Too many attempts. Please try again shortly.';
  }
  if (error.status >= 500) {
    return isId ? 'Layanan pemesanan sedang tidak tersedia. Pesanan tidak dibuat.' : 'Ordering is temporarily unavailable. No order was created.';
  }
  return isId ? 'Pesanan ditolak. Periksa pilihan dan ketersediaan lalu coba lagi.' : 'The order was rejected. Check the options and availability and try again.';
}

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new StorefrontOrderClientError(500, 'idempotency_unavailable');
}

export function StorefrontProductOrderAction({
  storeId,
  productId,
  productName,
  productPriceCents = 0,
  productMetadata,
  onlineOrderEnabled,
  productAvailable,
  cartEnabled = false,
  isId,
  variant = 'default',
}: StorefrontProductOrderActionProps) {
  const [state, setState] = useState<OrderUiState>({ phase: 'idle' });
  const [submitter] = useState(() => createStorefrontOrderSubmitter());
  const [configOpen, setConfigOpen] = useState(false);
  const [loadingCustomization, setLoadingCustomization] = useState(false);
  const [resolvedProduct, setResolvedProduct] = useState<{
    priceCents: number;
    metadata: Record<string, unknown>;
  } | null>(
    productMetadata
      ? { priceCents: productPriceCents ?? 0, metadata: productMetadata }
      : null,
  );
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(
    () => parseStorefrontModifierGroups(resolvedProduct?.metadata),
    [resolvedProduct],
  );
  const compact = variant === 'compact';
  const canOrder = onlineOrderEnabled && productAvailable;
  const locked = state.phase === 'submitting' || (state.phase === 'success' && !cartEnabled) || loadingCustomization;

  function addLinesToCart(lines: StorefrontOrderLineInput[], estimatedUnitPriceCents = productPriceCents) {
    if (!lines.length) return;
    for (const line of lines) {
      const detail: StorefrontCartAddDetail = {
        storeId,
        productId: line.productId,
        productName,
        quantity: line.quantity,
        unitPriceCents: productPriceCents,
        estimatedUnitPriceCents: estimatedConfiguredPriceCents(
          resolvedProduct?.priceCents ?? productPriceCents,
          groups,
          line.selectedOptions || [],
        ),
        selectedOptions: line.selectedOptions,
        note: line.note,
      };
      window.dispatchEvent(new CustomEvent(STOREFRONT_CART_EVENT, { detail }));
    }
    setState({ phase: 'idle' });
    setConfigOpen(false);
  }

  async function submitLines(lines: StorefrontOrderLineInput[]) {
    if (!canOrder || submittingRef.current || !lines.length) return;
    if (cartEnabled) {
      addLinesToCart(lines);
      return;
    }
    submittingRef.current = true;
    setState({ phase: 'submitting' });
    try {
      const idempotencyKey = idempotencyKeyRef.current || (idempotencyKeyRef.current = createIdempotencyKey());
      const bundle = await submitter.submit({
        storeId,
        items: lines,
        idempotencyKey,
        fulfillmentMode: 'pickup',
      });
      setState({ phase: 'success', bundle });
      setConfigOpen(false);
      idempotencyKeyRef.current = null;
    } catch (error) {
      setState({ phase: 'error', message: messageForError(error, isId) });
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleOrder() {
    if (!canOrder || locked || submittingRef.current) return;
    setState({ phase: 'idle' });

    let product = resolvedProduct;
    if (!product) {
      setLoadingCustomization(true);
      try {
        const loaded = await loadStorefrontProductCustomization(storeId, productId);
        product = loaded
          ? { priceCents: loaded.price_cents, metadata: loaded.metadata }
          : { priceCents: productPriceCents ?? 0, metadata: productMetadata ?? {} };
        setResolvedProduct(product);
      } catch {
        product = { priceCents: productPriceCents ?? 0, metadata: productMetadata ?? {} };
        setResolvedProduct(product);
      } finally {
        setLoadingCustomization(false);
      }
    }

    const availableGroups = parseStorefrontModifierGroups(product.metadata);
    if (availableGroups.length) {
      setConfigOpen(true);
      return;
    }
    await submitLines([{ productId, quantity: 1 }]);
  }

  const disabledReason = !onlineOrderEnabled
    ? isId ? 'Pemesanan online belum dibuka oleh toko.' : 'Online ordering is not enabled by this business.'
    : !productAvailable
      ? isId ? 'Produk ini belum tersedia untuk dipesan.' : 'This product is not currently available to order.'
      : null;
  const idleLabel = cartEnabled ? (isId ? 'Tambah' : 'Add') : compact ? (isId ? 'Pesan' : 'Order') : groups.length ? (isId ? 'Pilih & pesan' : 'Choose & order') : (isId ? 'Pesan 1 produk' : 'Order 1 item');

  return (
    <div data-variant={variant} className={compact ? 'mt-2' : 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800'}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOrder}
        disabled={!canOrder || locked}
        aria-label={isId ? (cartEnabled ? `Tambah ${productName}` : `Pesan ${productName}`) : (cartEnabled ? `Add ${productName}` : `Order ${productName}`)}
        data-testid="storefront-order-button"
        className={compact
          ? 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 shadow-sm shadow-emerald-950/5 transition hover:-translate-y-px hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-md hover:shadow-emerald-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:shadow-none dark:hover:border-emerald-800 dark:hover:bg-emerald-950/55 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500'
          : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300'}
      >
        {state.phase === 'submitting' || loadingCustomization ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : state.phase === 'success' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
        {loadingCustomization ? (isId ? 'Membuka…' : 'Opening…') : state.phase === 'submitting' ? (isId ? 'Membuat pesanan…' : 'Creating order…') : state.phase === 'success' ? (isId ? 'Pesanan dibuat' : 'Order created') : idleLabel}
      </button>

      {disabledReason ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{disabledReason}</p> : null}
      {state.phase === 'error' && !configOpen ? <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{state.message}</p> : null}
      {state.phase === 'success' && !cartEnabled ? (
        <div role="status" data-testid="storefront-order-success" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-100">
          <p className="font-extrabold">{isId ? 'Referensi pesanan' : 'Order reference'}: <span className="font-mono">{state.bundle.order.order_number}</span></p>
          <p className="mt-0.5">{isId ? 'Total' : 'Total'}: <strong>{formatCanonicalAmount(state.bundle.order.total_amount, state.bundle.order.currency, isId)}</strong></p>
          <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-100/75">{isId ? 'Harga akhir dihitung server dari produk dan pilihan yang valid.' : 'The final price is calculated by the server from valid product options.'}</p>
        </div>
      ) : null}

      {resolvedProduct && groups.length ? (
        <StorefrontProductConfigurator
          key={`${productId}:${configOpen ? 'open' : 'closed'}`}
          open={configOpen}
          onOpenChange={setConfigOpen}
          productId={productId}
          productName={productName}
          basePriceCents={resolvedProduct.priceCents}
          groups={groups}
          isId={isId}
          submitting={state.phase === 'submitting'}
          errorMessage={state.phase === 'error' ? state.message : null}
          triggerRef={triggerRef}
          onSubmit={submitLines}
        />
      ) : null}
    </div>
  );
}
