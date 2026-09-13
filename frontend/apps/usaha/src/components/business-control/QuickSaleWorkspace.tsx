'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  Landmark,
  Minus,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import {
  buildQuickSaleRequest,
  buildReceiptView,
  calculateCashChange,
  canCompleteCheckout,
  priceLabelToAmount,
  quickSaleTotal,
  type CheckoutPaymentMethod,
  type QuickSaleLineDraft,
  type ReceiptView,
} from './quick-sale';

type ProductOption = { id: string; name: string; priceLabel: string };
type DraftLine = QuickSaleLineDraft & { key: string; productName: string };

type Props = {
  businessId: string;
  products: ProductOption[];
  defaultDate: string;
};

type PaymentOption = {
  value: CheckoutPaymentMethod;
  label: string;
  icon: typeof Banknote;
};

const paymentOptions: PaymentOption[] = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'ewallet', label: 'QRIS', icon: QrCode },
  { value: 'bank', label: 'Transfer', icon: Landmark },
  { value: 'receivable', label: 'Belum bayar', icon: WalletCards },
];

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function makeLine(product: ProductOption): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    quantity: 1,
    unitPriceAmount: priceLabelToAmount(product.priceLabel),
    discountAmount: 0,
  };
}

function quickTenderAmounts(total: number) {
  if (total <= 0) return [];
  const rounded10k = Math.ceil(total / 10_000) * 10_000;
  return Array.from(new Set([total, rounded10k, 50_000, 100_000])).filter(
    value => value >= total,
  );
}

function receiptNumberFromSaleId(saleId: string, date: string) {
  const compactDate = date.replaceAll('-', '').slice(2);
  const suffix = saleId.replaceAll('-', '').slice(-6).toUpperCase() || 'SALE';
  return `LJ-${compactDate}-${suffix}`;
}

export function QuickSaleWorkspace({ businessId, products, defaultDate }: Props) {
  const router = useRouter();
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [channelKey, setChannelKey] = useState('offline');
  const [accountKey, setAccountKey] = useState<CheckoutPaymentMethod>('cash');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const attemptKey = useRef<string | null>(null);

  const total = useMemo(() => quickSaleTotal(lines), [lines]);
  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0),
    [lines],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    if (!query) return products;
    return products.filter(product => product.name.toLocaleLowerCase('id-ID').includes(query));
  }, [products, search]);
  const cashChange = calculateCashChange(total, tenderedAmount);
  const canPay = canCompleteCheckout({
    total,
    paymentMethod: accountKey,
    tenderedAmount,
    lineCount: lines.length,
  });

  function changed() {
    attemptKey.current = null;
    setFeedback(null);
  }

  function addProduct(product: ProductOption) {
    changed();
    setReceipt(null);
    setLines(current => {
      const existing = current.find(line => line.productId === product.id);
      if (!existing) return [...current, makeLine(product)];
      return current.map(line =>
        line.key === existing.key
          ? { ...line, quantity: Number(line.quantity) + 1 }
          : line,
      );
    });
  }

  function setQuantity(key: string, quantity: number) {
    changed();
    if (quantity <= 0) {
      setLines(current => current.filter(line => line.key !== key));
      return;
    }
    setLines(current =>
      current.map(line => (line.key === key ? { ...line, quantity } : line)),
    );
  }

  function resetOrder() {
    attemptKey.current = null;
    setLines([]);
    setCheckoutOpen(false);
    setTenderedAmount(0);
    setReceipt(null);
    setFeedback(null);
    setAccountKey('cash');
    setChannelKey('offline');
  }

  function choosePayment(method: CheckoutPaymentMethod) {
    changed();
    setAccountKey(method);
    if (method !== 'cash') setTenderedAmount(0);
  }

  async function submit() {
    if (!canPay) return;
    try {
      const payload = buildQuickSaleRequest({
        occurredOn,
        channelKey,
        accountKey,
        lines,
      });
      const idempotencyKey = attemptKey.current ?? crypto.randomUUID();
      attemptKey.current = idempotencyKey;
      setSaving(true);
      setFeedback(null);
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/sales`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          sale?: {
            sale?: {
              id?: string;
              created_at?: string;
              final_amount?: number;
            };
          };
        };
      };
      if (!response.ok) throw new Error(body.error || 'sale_save_failed');

      const saleId = body.data?.sale?.sale?.id ?? idempotencyKey;
      const createdAt = body.data?.sale?.sale?.created_at ?? new Date().toISOString();
      const paymentLabel =
        paymentOptions.find(option => option.value === accountKey)?.label ?? 'Pembayaran';
      const settledTotal = body.data?.sale?.sale?.final_amount ?? total;

      setReceipt(
        buildReceiptView({
          receiptNumber: receiptNumberFromSaleId(saleId, occurredOn),
          occurredAt: createdAt,
          cashierName: 'Kasir',
          paymentLabel,
          total: settledTotal,
          tenderedAmount: accountKey === 'cash' ? tenderedAmount : undefined,
          lines: lines.map(line => ({
            name: line.productName,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPriceAmount),
          })),
        }),
      );
      attemptKey.current = null;
      setCheckoutOpen(false);
      setFeedback({
        tone: 'success',
        text: 'Transaksi berhasil. Semua pencatatan penjualan sudah tersimpan.',
      });
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'sale_save_failed';
      const message =
        code === 'sale_discount_exceeds_line_total'
          ? 'Diskon tidak boleh melebihi subtotal produk.'
          : code === 'sale_inventory_insufficient'
            ? 'Stok produk tidak cukup untuk jumlah ini.'
            : 'Transaksi belum tersimpan. Coba lagi tanpa perlu mengisi modal atau resep.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-portal-line p-4 text-sm text-portal-soft">
        Belum ada menu. Tambahkan produk atau jasa, beri harga, lalu langsung mulai jualan.
      </div>
    );
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <div className="rounded-2xl border border-portal-line bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-portal-line pb-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-bold">Transaksi berhasil</p>
              </div>
              <p className="mt-1 text-xs text-portal-soft">{receipt.receiptNumber}</p>
            </div>
            <ReceiptText className="h-6 w-6 text-portal-soft" />
          </div>

          <div className="divide-y divide-portal-line">
            {receipt.lines.map((line, index) => (
              <div key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-portal-ink">{line.name}</p>
                  <p className="text-xs text-portal-soft">{line.quantity} × {money.format(line.unitPrice)}</p>
                </div>
                <p className="font-bold text-portal-ink">{money.format(line.quantity * line.unitPrice)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-portal-line pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-portal-soft">{receipt.paymentLabel}</span>
              <span className="font-semibold text-portal-ink">{money.format(receipt.total)}</span>
            </div>
            {receipt.tenderedAmount !== null ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-portal-soft">Diterima</span>
                  <span>{money.format(receipt.tenderedAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-portal-soft">Kembalian</span>
                  <span className="font-bold">{money.format(receipt.changeAmount)}</span>
                </div>
              </>
            ) : null}
            <div className="flex items-end justify-between border-t border-portal-line pt-3">
              <span className="font-bold text-portal-ink">Total</span>
              <span className="text-2xl font-black text-portal-ink">{money.format(receipt.total)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" className="portal-button-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak
          </button>
          <button
            type="button"
            className="portal-button-secondary"
            onClick={async () => {
              const text = `${receipt.receiptNumber}\nTotal ${money.format(receipt.total)}\n${receipt.paymentLabel}`;
              if (navigator.share) await navigator.share({ text }).catch(() => undefined);
              else await navigator.clipboard?.writeText(text).catch(() => undefined);
            }}
          >
            Bagikan struk
          </button>
          <button type="button" className="portal-button-primary col-span-2 sm:col-span-1" onClick={resetOrder}>
            <Plus className="h-4 w-4" /> Pesanan baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[520px] gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
          <input
            className="portal-input w-full pl-9"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Cari menu…"
            aria-label="Cari menu"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(product => {
            const quantity = Number(lines.find(line => line.productId === product.id)?.quantity ?? 0);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="relative min-h-24 rounded-xl border border-portal-line bg-white p-3 text-left transition hover:border-portal-ink/30 hover:bg-[#fafbf9] active:scale-[0.99]"
              >
                {quantity > 0 ? (
                  <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-portal-ink px-1.5 text-xs font-black text-white">
                    {quantity}
                  </span>
                ) : null}
                <p className="pr-6 text-sm font-bold leading-5 text-portal-ink">{product.name}</p>
                <p className="mt-3 text-sm font-black text-portal-ink">{product.priceLabel}</p>
              </button>
            );
          })}
        </div>

        {!filteredProducts.length ? (
          <p className="rounded-xl border border-dashed border-portal-line p-4 text-sm text-portal-soft">
            Menu tidak ditemukan.
          </p>
        ) : null}
      </section>

      <aside className="flex min-h-0 flex-col rounded-2xl border border-portal-line bg-white lg:sticky lg:top-3 lg:max-h-[calc(100vh-9rem)]">
        <div className="flex items-center justify-between border-b border-portal-line px-4 py-3">
          <div>
            <p className="font-bold text-portal-ink">Pesanan</p>
            <p className="text-xs text-portal-soft">{itemCount} item</p>
          </div>
          {lines.length ? (
            <button type="button" className="text-xs font-bold text-portal-soft hover:text-red-700" onClick={() => { changed(); setLines([]); }}>
              Kosongkan
            </button>
          ) : null}
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-3">
          {lines.length ? (
            <div className="space-y-2">
              {lines.map(line => (
                <div key={line.key} className="rounded-xl bg-[#fafbf9] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-portal-ink">{line.productName}</p>
                      <p className="mt-0.5 text-xs text-portal-soft">{money.format(Number(line.unitPriceAmount))}</p>
                    </div>
                    <button type="button" aria-label={`Hapus ${line.productName}`} className="p-1 text-portal-soft hover:text-red-700" onClick={() => setQuantity(line.key, 0)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-lg border border-portal-line bg-white p-1">
                      <button type="button" aria-label={`Kurangi ${line.productName}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#f2f4f1]" onClick={() => setQuantity(line.key, Number(line.quantity) - 1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-black">{line.quantity}</span>
                      <button type="button" aria-label={`Tambah ${line.productName}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#f2f4f1]" onClick={() => setQuantity(line.key, Number(line.quantity) + 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-black text-portal-ink">{money.format(Number(line.quantity) * Number(line.unitPriceAmount))}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-32 place-items-center text-center">
              <div>
                <p className="text-sm font-bold text-portal-ink">Belum ada pesanan</p>
                <p className="mt-1 text-xs text-portal-soft">Tekan menu untuk menambah.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-portal-line p-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-portal-soft">Total</p>
              <p className="text-2xl font-black text-portal-ink">{money.format(total)}</p>
            </div>
            <span className="text-xs text-portal-soft">{itemCount} item</span>
          </div>
          <button type="button" className="portal-button-primary w-full justify-center py-3" disabled={!lines.length || total <= 0} onClick={() => { setCheckoutOpen(true); setTenderedAmount(total); }}>
            Bayar
          </button>
        </div>
      </aside>

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Pembayaran">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-portal-soft">Pembayaran</p>
                <p className="mt-1 text-2xl font-black text-portal-ink">{money.format(total)}</p>
              </div>
              <button type="button" className="portal-button-secondary" onClick={() => setCheckoutOpen(false)}>Tutup</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {paymentOptions.map(option => {
                const Icon = option.icon;
                const active = accountKey === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choosePayment(option.value)}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-bold transition ${active ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'}`}
                  >
                    <Icon className="h-4 w-4" /> {option.label}
                  </button>
                );
              })}
            </div>

            {accountKey === 'cash' ? (
              <div className="mt-4 space-y-3 rounded-xl bg-[#fafbf9] p-3">
                <label className="grid gap-1 text-xs font-bold text-portal-soft">
                  Uang diterima
                  <input
                    className="portal-input bg-white text-base font-bold"
                    type="number"
                    min={total}
                    step="1000"
                    value={tenderedAmount || ''}
                    onChange={event => setTenderedAmount(Number(event.target.value) || 0)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickTenderAmounts(total).map(amount => (
                    <button key={amount} type="button" className="rounded-lg border border-portal-line bg-white px-3 py-2 text-xs font-bold" onClick={() => setTenderedAmount(amount)}>
                      {money.format(amount)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-portal-line pt-3">
                  <span className="text-sm text-portal-soft">Kembalian</span>
                  <span className="text-lg font-black text-portal-ink">{money.format(cashChange)}</span>
                </div>
              </div>
            ) : null}

            <details className="mt-4" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail transaksi</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-portal-soft">
                  Kanal
                  <select className="portal-input" value={channelKey} onChange={event => { changed(); setChannelKey(event.target.value); }}>
                    <option value="offline">Di tempat</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="gofood">GoFood</option>
                    <option value="grabfood">GrabFood</option>
                    <option value="other">Lainnya</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-portal-soft">
                  Tanggal
                  <input className="portal-input" type="date" value={occurredOn} onChange={event => { changed(); setOccurredOn(event.target.value); }} />
                </label>
              </div>
            </details>

            {accountKey === 'cash' && tenderedAmount < total ? (
              <p className="mt-3 text-xs font-semibold text-amber-700">Uang diterima masih kurang {money.format(total - tenderedAmount)}.</p>
            ) : null}

            <button type="button" className="portal-button-primary mt-4 w-full justify-center py-3" disabled={saving || !canPay} onClick={submit}>
              {saving ? 'Menyimpan…' : `Selesaikan · ${money.format(total)}`}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p role="status" className={`lg:col-span-2 text-sm font-semibold ${feedback.tone === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
