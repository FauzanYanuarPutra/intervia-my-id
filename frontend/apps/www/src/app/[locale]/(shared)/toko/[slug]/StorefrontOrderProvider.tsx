'use client';

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  type StorefrontCanonicalOrderBundle,
} from '@/lib/super-app/storefront-order-client';
import type { StorefrontModifierSelection } from '@/lib/super-app/storefront-product-modifiers';
import { StorefrontDialog } from './StorefrontDialog';

export type StorefrontCartLine = {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  previewUnitPriceCents: number;
  selections: StorefrontModifierSelection[];
  selectionLabels: string[];
  note: string;
};

type CartContextValue = {
  addLine: (line: Omit<StorefrontCartLine, 'quantity'> & { quantity?: number }) => void;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function idempotencyKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  throw new StorefrontOrderClientError(500, 'idempotency_unavailable');
}

function checkoutError(error: unknown, isId: boolean) {
  if (!(error instanceof StorefrontOrderClientError)) {
    return isId ? 'Pesanan belum dapat dibuat. Coba lagi.' : 'The order could not be created. Please try again.';
  }
  if (error.status === 401 || error.code === 'authentication_required') {
    return isId ? 'Masuk ke akun Lajukan terlebih dahulu untuk menyelesaikan pesanan.' : 'Please sign in to your Lajukan account to complete the order.';
  }
  if (error.code === 'insufficient_stock') {
    return isId ? 'Stok tidak cukup untuk seluruh racikan di keranjang. Kurangi jumlah lalu coba lagi.' : 'There is not enough stock for all configured items in the cart.';
  }
  if (error.code.startsWith('modifier_')) {
    return isId ? 'Pilihan produk baru saja berubah. Tutup keranjang, pilih ulang racikan, lalu coba lagi.' : 'Product choices changed. Please configure the item again.';
  }
  if (error.code === 'product_unavailable') {
    return isId ? 'Salah satu produk sedang tidak tersedia.' : 'One of the products is currently unavailable.';
  }
  if (error.status === 429) return isId ? 'Terlalu banyak percobaan. Coba lagi sebentar.' : 'Too many attempts. Please try again shortly.';
  return isId ? 'Pesanan belum berhasil dibuat. Tidak ada pembayaran yang diproses.' : 'The order could not be created. No payment was processed.';
}

function formatIdr(cents: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(Math.max(0, Math.round(cents / 100)));
}

export function useStorefrontCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('Storefront order action must be inside StorefrontOrderProvider');
  return value;
}

export function StorefrontOrderProvider({
  storeId,
  isId,
  children,
}: {
  storeId: string;
  isId: boolean;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<StorefrontCartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<StorefrontCanonicalOrderBundle | null>(null);
  const [submitter] = useState(() => createStorefrontOrderSubmitter());
  const attemptKey = useRef<string | null>(null);

  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const previewTotalCents = useMemo(
    () => lines.reduce((sum, line) => sum + line.previewUnitPriceCents * line.quantity, 0),
    [lines],
  );

  function changed() {
    attemptKey.current = null;
    setError('');
    setSuccess(null);
  }

  function addLine(line: Omit<StorefrontCartLine, 'quantity'> & { quantity?: number }) {
    changed();
    setLines(current => {
      const existing = current.find(item => item.key === line.key);
      const quantity = Math.max(1, line.quantity ?? 1);
      if (existing) {
        return current.map(item => item.key === line.key ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { ...line, quantity }];
    });
  }

  function setQuantity(key: string, quantity: number) {
    changed();
    if (quantity <= 0) {
      setLines(current => current.filter(line => line.key !== key));
      return;
    }
    setLines(current => current.map(line => line.key === key ? { ...line, quantity } : line));
  }

  async function submit() {
    if (!lines.length || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const key = attemptKey.current ?? idempotencyKey();
      attemptKey.current = key;
      const bundle = await submitter.submit({
        storeId,
        idempotencyKey: key,
        fulfillmentMode: 'pickup',
        items: lines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          note: line.note || null,
          selections: line.selections.map(selection => ({
            groupId: selection.groupId,
            optionIds: selection.optionIds,
          })),
        })),
      });
      attemptKey.current = null;
      setSuccess(bundle);
    } catch (value) {
      setError(checkoutError(value, isId));
    } finally {
      setSubmitting(false);
    }
  }

  const context = useMemo<CartContextValue>(() => ({ addLine, itemCount }), [itemCount]);

  return (
    <CartContext.Provider value={context}>
      {children}

      {lines.length ? (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_20px_60px_-18px_rgba(15,23,42,.35)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{itemCount} {isId ? 'item · Lihat pesanan' : 'items · View order'}</span>
              <span className="block truncate text-base font-extrabold tabular-nums text-slate-950 dark:text-white">{formatIdr(previewTotalCents)}</span>
            </span>
            <span className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white">{isId ? 'Checkout' : 'Checkout'}</span>
          </button>
        </div>
      ) : null}

      <StorefrontDialog
        open={cartOpen}
        onClose={() => { if (!submitting) setCartOpen(false); }}
        title={success ? (isId ? 'Pesanan dibuat' : 'Order created') : (isId ? 'Pesanan kamu' : 'Your order')}
        description={success ? success.order.order_number : (isId ? 'Setiap racikan tersimpan sebagai item yang terpisah.' : 'Each configuration is kept as a separate line.')}
        busy={submitting}
        footer={success ? (
          <button
            type="button"
            className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white hover:bg-emerald-800"
            onClick={() => {
              setLines([]);
              setSuccess(null);
              setCartOpen(false);
            }}
          >
            {isId ? 'Selesai' : 'Done'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!lines.length || submitting}
            onClick={submit}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            {submitting ? (isId ? 'Membuat pesanan…' : 'Creating order…') : `${isId ? 'Pesan' : 'Order'} · ${formatIdr(previewTotalCents)}`}
          </button>
        )}
      >
        {success ? (
          <div role="status" className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="text-sm font-extrabold">{isId ? 'Pesanan berhasil dicatat.' : 'Your order has been recorded.'}</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{isId ? 'Harga final dihitung dari data produk dan pilihan di server. Pembayaran belum dibuat otomatis.' : 'Final pricing was calculated server-side. Payment was not created automatically.'}</p>
              <p className="mt-3 text-xl font-black tabular-nums">{new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', { style: 'currency', currency: success.order.currency || 'IDR', maximumFractionDigits: 0 }).format(Number(success.order.total_amount))}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map(line => (
              <div key={line.key} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-950 dark:text-white">{line.productName}</p>
                    {line.selectionLabels.map(label => <p key={label} className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>)}
                    {line.note ? <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">“{line.note}”</p> : null}
                    <p className="mt-1.5 text-sm font-extrabold tabular-nums text-slate-950 dark:text-white">{formatIdr(line.previewUnitPriceCents * line.quantity)}</p>
                  </div>
                  <button type="button" aria-label={isId ? `Hapus ${line.productName}` : `Remove ${line.productName}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40" onClick={() => setQuantity(line.key, 0)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 inline-flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setQuantity(line.key, line.quantity - 1)} aria-label="Kurangi"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-9 text-center text-sm font-extrabold tabular-nums">{line.quantity}</span>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setQuantity(line.key, line.quantity + 1)} aria-label="Tambah"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            ))}

            {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</p> : null}

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{isId ? 'Perkiraan total' : 'Estimated total'}</span>
              <span className="text-lg font-black tabular-nums text-slate-950 dark:text-white">{formatIdr(previewTotalCents)}</span>
            </div>
          </div>
        )}
      </StorefrontDialog>
    </CartContext.Provider>
  );
}
