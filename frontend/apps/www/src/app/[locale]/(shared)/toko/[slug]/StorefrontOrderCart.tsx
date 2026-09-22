'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  type StorefrontCanonicalOrderBundle,
  type StorefrontOrderLineInput,
} from '@/lib/super-app/storefront-order-client';
import {
  storefrontConfigurationSignature,
  type StorefrontModifierSelection,
} from '@/lib/super-app/storefront-product-modifiers';

export const STOREFRONT_CART_EVENT = 'lajukan:storefront-cart-add';

export type StorefrontCartAddDetail = {
  storeId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  estimatedUnitPriceCents?: number;
  selectedOptions?: StorefrontModifierSelection[];
  note?: string;
};

type CartLine = StorefrontOrderLineInput & {
  key: string;
  productName: string;
  unitPriceCents: number;
  estimatedUnitPriceCents: number;
  selectedOptions?: StorefrontModifierSelection[];
};

function normalizeNote(value?: string) {
  return (value || '').trim().replace(/\s+/g, ' ');
}

function lineIdentity(line: Pick<CartLine, 'productId' | 'selectedOptions' | 'note'>) {
  return [
    line.productId,
    storefrontConfigurationSignature(line.selectedOptions || []),
    normalizeNote(line.note),
  ].join('::');
}

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value / 100)));
}

function optionCount(options?: StorefrontModifierSelection[]) {
  return options?.reduce((sum, item) => sum + item.option_ids.length, 0) || 0;
}

function errorMessage(error: unknown, isId: boolean) {
  if (!(error instanceof StorefrontOrderClientError)) {
    return isId ? 'Pesanan belum dapat dibuat. Coba lagi.' : 'The order could not be created.';
  }
  if (error.status === 401 || error.code === 'authentication_required') {
    return isId ? 'Silakan masuk ke akun Lajukan untuk melanjutkan pesanan.' : 'Please sign in to continue.';
  }
  if (error.code === 'insufficient_stock') {
    return isId ? 'Stok berubah. Periksa jumlah pesanan lalu coba lagi.' : 'Stock changed. Review the quantities and try again.';
  }
  if (error.status === 429) return isId ? 'Terlalu banyak percobaan. Coba lagi.' : 'Too many attempts. Try again shortly.';
  if (error.status >= 500) return isId ? 'Layanan pemesanan sedang bermasalah.' : 'Ordering is temporarily unavailable.';
  return isId ? 'Pesanan ditolak. Periksa menu dan pilihan lalu coba lagi.' : 'The order was rejected. Review the menu and try again.';
}

export function StorefrontOrderCart({
  storeId,
  isId,
  locale,
}: {
  storeId: string;
  isId: boolean;
  locale: string;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<StorefrontCanonicalOrderBundle | null>(null);
  const submitter = useMemo(() => createStorefrontOrderSubmitter(), []);

  useEffect(() => {
    const onAdd = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as Partial<StorefrontCartAddDetail> | undefined;
      if (!detail || detail.storeId !== storeId || !detail.productId || !detail.productName) return;
      const quantity = Math.max(1, Math.min(200, Math.round(Number(detail.quantity) || 1)));
      const incoming: CartLine = {
        key: detail.productId + '::' + storefrontConfigurationSignature(detail.selectedOptions || []) + '::' + normalizeNote(detail.note),
        productId: detail.productId,
        productName: detail.productName,
        quantity,
        unitPriceCents: Math.max(0, Math.round(Number(detail.unitPriceCents) || 0)),
        estimatedUnitPriceCents: Math.max(0, Math.round(Number(detail.estimatedUnitPriceCents ?? detail.unitPriceCents) || 0)),
        selectedOptions: detail.selectedOptions,
        note: normalizeNote(detail.note) || undefined,
      };
      setLines(current => {
        const index = current.findIndex(item => lineIdentity(item) === lineIdentity(incoming));
        if (index < 0) return [...current, incoming];
        return current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, quantity: Math.min(200, item.quantity + quantity) } : item,
        );
      });
      setSuccess(null);
      setError('');
      setOpen(true);
    };
    window.addEventListener(STOREFRONT_CART_EVENT, onAdd);
    return () => window.removeEventListener(STOREFRONT_CART_EVENT, onAdd);
  }, [storeId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting]);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const estimatedTotal = lines.reduce((sum, line) => sum + line.quantity * line.estimatedUnitPriceCents, 0);
  const signInHref = '/' + locale + '/login?next=' + encodeURIComponent(typeof window === 'undefined' ? '/' + locale + '/toko' : window.location.pathname + window.location.search);

  function updateQuantity(key: string, delta: number) {
    setLines(current => current.flatMap(line => {
      if (line.key !== key) return [line];
      const quantity = Math.max(0, Math.min(200, line.quantity + delta));
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
  }

  function removeLine(key: string) {
    setLines(current => current.filter(line => line.key !== key));
  }

  function updateNote(key: string, value: string) {
    setLines(current => current.map(line => line.key === key ? { ...line, note: normalizeNote(value) || undefined } : line));
  }

  async function submitOrder() {
    if (!lines.length || submitting) return;
    const idempotencyKey = globalThis.crypto?.randomUUID?.();
    if (!idempotencyKey) {
      setError(isId ? 'Sesi order tidak siap. Refresh halaman lalu coba lagi.' : 'Order session is not ready. Refresh and try again.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const bundle = await submitter.submit({
        storeId,
        idempotencyKey,
        items: lines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          selectedOptions: line.selectedOptions,
          note: line.note,
        })),
        orderNote: normalizeNote(orderNote) || undefined,
        fulfillmentMode: 'pickup',
      });
      setSuccess(bundle);
      setLines([]);
      setOrderNote('');
      setOpen(true);
    } catch (submitError) {
      setError(errorMessage(submitError, isId));
    } finally {
      setSubmitting(false);
    }
  }

  if (!lines.length && !success) return null;

  return (
    <>
      {lines.length ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex w-full max-w-[960px] items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-3 py-2.5 shadow-[0_14px_40px_-18px_rgba(15,23,42,.45)] backdrop-blur dark:border-emerald-900 dark:bg-slate-900/95">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><ShoppingBag className="h-4 w-4" /></div>
            <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-black text-slate-950 dark:text-slate-50">{itemCount} {isId ? 'item' : 'items'}</p>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">Perkiraan {formatIdr(estimatedTotal)}</p>
            </button>
            <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800">
              {isId ? 'Lihat pesanan' : 'View order'}
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 p-0 backdrop-blur-[1px] sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label={isId ? 'Pesanan toko' : 'Store order'} className="absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(440px,calc(100vw-2rem))] sm:max-h-[88dvh] sm:rounded-3xl" onMouseDown={event => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{isId ? 'Pesanan' : 'Order'}</p>
                <h2 className="mt-0.5 text-lg font-black text-slate-950 dark:text-slate-50">{success ? (isId ? 'Pesanan dibuat' : 'Order created') : itemCount + ' ' + (isId ? 'item' : 'items')}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={submitting} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={isId ? 'Tutup pesanan' : 'Close order'}><X className="h-5 w-5" /></button>
            </header>

            {success ? (
              <div className="space-y-4 p-4 sm:p-5">
                <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-emerald-950 dark:text-emerald-100">{isId ? 'Pesanan berhasil dibuat.' : 'Your order has been created.'}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{isId ? 'Nomor pesanan' : 'Order'}: {success.order.order_number}</p>
                      <p className="mt-1 text-sm font-black text-emerald-950 dark:text-emerald-100">{formatIdr(Number(success.order.total_amount) * 100)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{isId ? 'Kembali ke menu' : 'Back to menu'}</button>
                  <a href={'/' + locale + '/super-app'} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-3 text-sm font-black text-white">{isId ? 'Lihat pesanan' : 'View order'}</a>
                </div>
              </div>
            ) : (
              <>
                <div className="max-h-[52dvh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                  {lines.map(line => (
                    <article key={line.key} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-950 dark:text-slate-50">{line.productName}</p>
                          {optionCount(line.selectedOptions) ? <p className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{optionCount(line.selectedOptions)} pilihan</p> : null}
                          {line.note ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{isId ? 'Catatan' : 'Note'}: {line.note}</p> : null}
                        </div>
                        <button type="button" onClick={() => removeLine(line.key)} disabled={submitting} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={isId ? 'Hapus item' : 'Remove item'}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                          <button type="button" onClick={() => updateQuantity(line.key, -1)} disabled={submitting} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="h-4 w-4" /></button>
                          <span className="min-w-9 text-center text-sm font-black tabular-nums">{line.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(line.key, 1)} disabled={submitting} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="h-4 w-4" /></button>
                        </div>
                        <strong className="text-sm font-black text-slate-950 dark:text-slate-50">{formatIdr(line.quantity * line.estimatedUnitPriceCents)}</strong>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-[11px] font-bold text-slate-500">{isId ? 'Catatan item' : 'Item note'} <span className="font-normal">({isId ? 'opsional' : 'optional'})</span></span>
                        <input value={line.note || ''} onChange={event => updateNote(line.key, event.target.value)} maxLength={200} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900" placeholder={isId ? 'Contoh: tanpa es' : 'Example: no ice'} />
                      </label>
                    </article>
                  ))}
                  <label className="block rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{isId ? 'Catatan untuk toko' : 'Note for store'} <span className="font-normal text-slate-400">({isId ? 'opsional' : 'optional'})</span></span>
                    <textarea value={orderNote} onChange={event => setOrderNote(event.target.value)} maxLength={500} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900" placeholder={isId ? 'Contoh: semua minuman dibungkus terpisah' : 'Example: pack drinks separately'} />
                  </label>
                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                      <p>{error}</p>
                      {(error.includes('masuk') || error.includes('sign in')) ? <a href={signInHref} className="mt-2 inline-flex font-black underline">{isId ? 'Masuk ke Lajukan' : 'Sign in'}</a> : null}
                    </div>
                  ) : null}
                </div>
                <footer className="border-t border-slate-100 bg-white px-4 pb-[max(.8rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:pb-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">{itemCount} {isId ? 'item' : 'items'}</p>
                      <p className="text-lg font-black text-slate-950 dark:text-slate-50">{formatIdr(estimatedTotal)}</p>
                    </div>
                    <button type="button" onClick={submitOrder} disabled={submitting || !lines.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}{submitting ? (isId ? 'Membuat pesanan…' : 'Creating order…') : (isId ? 'Buat pesanan' : 'Place order')}</button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
