'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Landmark,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import type { ProductModifierGroup, ProductModifierSelection } from 'lajukan-ui';
import { QuickSaleProductConfigurator } from './QuickSaleProductConfigurator';
import {
  buildQuickSaleRequest,
  buildReceiptShareText,
  buildReceiptView,
  calculateCashChange,
  canCompleteCheckout,
  filterQuickSaleProducts,
  mergeQuickSaleLine,
  priceLabelToAmount,
  quickSaleItemCount,
  quickSaleTotal,
  quickTenderAmounts,
  type CheckoutPaymentMethod,
  type QuickSaleLineDraft,
  type ReceiptView,
} from './quick-sale';
import {
  buildCashTenderPresets,
  buildPosFilters,
  productInitials,
  productMatchesFilter,
} from './quick-sale-pos-ui';

export type ProductOption = {
  id: string;
  name: string;
  priceLabel: string;
  imageUrl?: string | null;
  category?: string | null;
  isFavorite?: boolean;
  modifierGroups?: ProductModifierGroup[];
};

type DraftLine = QuickSaleLineDraft & {
  key: string;
  productName: string;
  configurationSummary?: string;
};

type ConfiguredProductInput = {
  quantity: number;
  selectedOptions: ProductModifierSelection[];
  note: string;
  previewUnitPriceAmount: number;
  configurationSummary: string;
};

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

type WorkspaceMode = 'cart' | 'configure' | 'checkout';
type MobileStage = 'catalog' | 'workspace';

const paymentOptions: PaymentOption[] = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'ewallet', label: 'QRIS', icon: QrCode },
  { value: 'bank', label: 'Transfer', icon: Landmark },
  { value: 'receivable', label: 'Belum bayar', icon: WalletCards },
];

const channelOptions = [
  { value: 'offline', label: 'Di tempat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'gofood', label: 'GoFood' },
  { value: 'grabfood', label: 'GrabFood' },
  { value: 'other', label: 'Lainnya' },
];

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function makeLine(product: ProductOption, configured?: ConfiguredProductInput, key = crypto.randomUUID()): DraftLine {
  const basePriceAmount = priceLabelToAmount(product.priceLabel);
  return {
    key,
    productId: product.id,
    productName: product.name,
    quantity: configured?.quantity ?? 1,
    basePriceAmount,
    unitPricePreviewAmount: configured?.previewUnitPriceAmount ?? basePriceAmount,
    discountAmount: 0,
    selectedOptions: configured?.selectedOptions ?? [],
    note: configured?.note || undefined,
    configurationSummary: configured?.configurationSummary || undefined,
  };
}

function receiptNumberFromSaleId(saleId: string, date: string) {
  const compactDate = date.replaceAll('-', '').slice(2);
  const suffix = saleId.replaceAll('-', '').slice(-6).toUpperCase() || 'SALE';
  return `LJ-${compactDate}-${suffix}`;
}

function ProductArtwork({ product }: { product: ProductOption }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !failed;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f1f3ef]">
      {showImage ? (
        <img src={product.imageUrl ?? undefined} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#f7f8f5] to-[#ecefe9]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black tracking-wide text-portal-ink shadow-sm">
            {product.name.trim() ? productInitials(product.name) : <Package className="h-5 w-5" />}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, quantity, onAdd }: { product: ProductOption; quantity: number; onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd} aria-label={`Tambah ${product.name}`} className="group relative min-w-0 rounded-2xl border border-portal-line bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-portal-ink/20 hover:shadow-md active:translate-y-0 active:scale-[0.985]">
      <ProductArtwork product={product} />
      {quantity > 0 ? <span className="absolute right-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-portal-ink px-2 text-xs font-black text-white shadow-md">{quantity}</span> : null}
      <div className="px-1 pb-1 pt-2.5">
        <p className="min-h-10 overflow-hidden text-sm font-bold leading-5 text-portal-ink">{product.name}</p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p className="truncate text-sm font-black text-portal-ink">{product.priceLabel}</p>
          {product.category ? <span className="max-w-[45%] truncate text-[10px] font-semibold text-portal-soft">{product.category}</span> : null}
        </div>
      </div>
    </button>
  );
}

function QuantityControl({ line, onQuantity }: { line: DraftLine; onQuantity: (key: string, quantity: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-portal-line bg-white p-0.5">
      <button type="button" aria-label={`Kurangi ${line.productName}`} className="grid h-10 w-10 place-items-center rounded-lg transition hover:bg-[#f2f4f1] active:scale-95" onClick={() => onQuantity(line.key, Number(line.quantity) - 1)}><Minus className="h-3.5 w-3.5" /></button>
      <span className="min-w-9 text-center text-sm font-black tabular-nums">{line.quantity}</span>
      <button type="button" aria-label={`Tambah ${line.productName}`} className="grid h-10 w-10 place-items-center rounded-lg transition hover:bg-[#f2f4f1] active:scale-95" onClick={() => onQuantity(line.key, Number(line.quantity) + 1)}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function CartLines({ lines, onQuantity, onEdit }: { lines: DraftLine[]; onQuantity: (key: string, quantity: number) => void; onEdit: (line: DraftLine) => void }) {
  if (!lines.length) {
    return (
      <div className="grid min-h-40 place-items-center px-6 text-center">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f5f1] text-portal-soft"><ReceiptText className="h-5 w-5" /></div>
          <p className="mt-3 text-sm font-bold text-portal-ink">Belum ada pesanan</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Tap produk untuk mulai transaksi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-portal-line">
      {lines.map(line => {
        const subtotal = Number(line.quantity) * Number(line.unitPricePreviewAmount ?? line.unitPriceAmount ?? line.basePriceAmount ?? 0);
        const editable = Boolean(line.configurationSummary || line.selectedOptions?.length);
        return (
          <div key={line.key} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-portal-ink">{line.productName}</p>
                {line.configurationSummary ? <p className="mt-0.5 text-xs font-semibold text-portal-forest">{line.configurationSummary}</p> : null}
                {line.note ? <p className="mt-0.5 text-[11px] text-portal-soft">Catatan: {line.note}</p> : null}
                <p className="mt-0.5 text-xs text-portal-soft">{money.format(Number(line.unitPricePreviewAmount ?? line.unitPriceAmount ?? line.basePriceAmount ?? 0))} × {line.quantity}</p>
                {editable ? <button type="button" className="mt-1.5 text-[11px] font-bold text-portal-forest hover:underline" onClick={() => onEdit(line)}>Edit racikan</button> : null}
              </div>
              <p className="shrink-0 text-sm font-black tabular-nums text-portal-ink">{money.format(subtotal)}</p>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <QuantityControl line={line} onQuantity={onQuantity} />
              <button type="button" aria-label={`Hapus ${line.productName}`} className="grid h-11 w-11 place-items-center rounded-xl text-portal-soft transition hover:bg-red-50 hover:text-red-700" onClick={() => onQuantity(line.key, 0)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuickSaleWorkspace({ businessId, products, defaultDate }: Props) {
  const router = useRouter();
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [channelKey, setChannelKey] = useState('offline');
  const [accountKey, setAccountKey] = useState<CheckoutPaymentMethod>('cash');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('all');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('cart');
  const [mobileStage, setMobileStage] = useState<MobileStage>('catalog');
  const [configuringProduct, setConfiguringProduct] = useState<ProductOption | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const attemptKey = useRef<string | null>(null);

  const total = useMemo(() => quickSaleTotal(lines), [lines]);
  const itemCount = useMemo(() => quickSaleItemCount(lines), [lines]);
  const filters = useMemo(() => buildPosFilters(products), [products]);
  const filteredProducts = useMemo(() => filterQuickSaleProducts(products, search).filter(product => productMatchesFilter(product, filterKey)), [products, search, filterKey]);
  const cashPresets = useMemo(() => buildCashTenderPresets(total, quickTenderAmounts(total)), [total]);
  const cashChange = calculateCashChange(total, tenderedAmount);
  const canPay = canCompleteCheckout({ total, paymentMethod: accountKey, tenderedAmount, lineCount: lines.length });
  const editingLine = editingLineKey ? lines.find(line => line.key === editingLineKey) ?? null : null;

  function changed() {
    attemptKey.current = null;
    setFeedback(null);
  }

  function showWorkspace(mode: WorkspaceMode) {
    setWorkspaceMode(mode);
    setMobileStage('workspace');
  }

  function addProduct(product: ProductOption) {
    if (product.modifierGroups?.length) {
      setEditingLineKey(null);
      setConfiguringProduct(product);
      showWorkspace('configure');
      return;
    }
    changed();
    setReceipt(null);
    setLines(current => mergeQuickSaleLine(current, makeLine(product)) as DraftLine[]);
  }

  function editLine(line: DraftLine) {
    const product = products.find(item => item.id === line.productId);
    if (!product?.modifierGroups?.length) return;
    setEditingLineKey(line.key);
    setConfiguringProduct(product);
    showWorkspace('configure');
  }

  function closeConfigurator() {
    setConfiguringProduct(null);
    setEditingLineKey(null);
    setWorkspaceMode('cart');
  }

  function addConfiguredProduct(input: ConfiguredProductInput) {
    const product = configuringProduct;
    if (!product) return;
    changed();
    setReceipt(null);
    setLines(current => {
      if (!editingLineKey) return mergeQuickSaleLine(current, makeLine(product, input)) as DraftLine[];
      const withoutEditedLine = current.filter(line => line.key !== editingLineKey);
      return mergeQuickSaleLine(withoutEditedLine, makeLine(product, input, editingLineKey)) as DraftLine[];
    });
    setEditingLineKey(null);
    setConfiguringProduct(null);
    setWorkspaceMode('cart');
    setMobileStage('workspace');
  }

  function setQuantity(key: string, quantity: number) {
    changed();
    if (quantity <= 0) {
      setLines(current => current.filter(line => line.key !== key));
      return;
    }
    setLines(current => current.map(line => line.key === key ? { ...line, quantity } : line));
  }

  function resetOrder() {
    attemptKey.current = null;
    setLines([]);
    setWorkspaceMode('cart');
    setMobileStage('catalog');
    setConfiguringProduct(null);
    setEditingLineKey(null);
    setTenderedAmount(0);
    setReceipt(null);
    setFeedback(null);
    setAccountKey('cash');
    setChannelKey('offline');
    setSearch('');
    setFilterKey('all');
  }

  function choosePayment(method: CheckoutPaymentMethod) {
    changed();
    setAccountKey(method);
    setTenderedAmount(method === 'cash' ? total : 0);
  }

  function openCheckout() {
    if (!lines.length || total <= 0) return;
    setAccountKey('cash');
    setTenderedAmount(total);
    showWorkspace('checkout');
  }

  function backFromWorkspace() {
    if (workspaceMode !== 'cart') {
      setWorkspaceMode('cart');
      setConfiguringProduct(null);
      setEditingLineKey(null);
      return;
    }
    setMobileStage('catalog');
  }

  async function submit() {
    if (!canPay || saving) return;
    try {
      const payload = buildQuickSaleRequest({ occurredOn, channelKey, accountKey, lines });
      const idempotencyKey = attemptKey.current ?? crypto.randomUUID();
      attemptKey.current = idempotencyKey;
      setSaving(true);
      setFeedback(null);

      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { sale?: { sale?: { id?: string; created_at?: string; final_amount?: number }; lines?: Array<{ unit_price_amount?: number }> } };
      };
      if (!response.ok) throw new Error(body.error || 'sale_save_failed');

      const saleId = body.data?.sale?.sale?.id ?? idempotencyKey;
      const createdAt = body.data?.sale?.sale?.created_at ?? new Date().toISOString();
      const paymentLabel = paymentOptions.find(option => option.value === accountKey)?.label ?? 'Pembayaran';
      const settledTotal = body.data?.sale?.sale?.final_amount ?? total;
      setReceipt(buildReceiptView({
        receiptNumber: receiptNumberFromSaleId(saleId, occurredOn),
        occurredAt: createdAt,
        cashierName: 'Kasir',
        paymentLabel,
        total: settledTotal,
        tenderedAmount: accountKey === 'cash' ? tenderedAmount : undefined,
        lines: lines.map((line, index) => ({
          name: line.productName,
          quantity: Number(line.quantity),
          unitPrice: body.data?.sale?.lines?.[index]?.unit_price_amount ?? Number(line.unitPricePreviewAmount ?? line.unitPriceAmount ?? line.basePriceAmount ?? 0),
          configurationSummary: line.configurationSummary,
          note: line.note,
        })),
      }));
      attemptKey.current = null;
      setWorkspaceMode('cart');
      setMobileStage('catalog');
      setFeedback(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'sale_save_failed';
      const message = code === 'sale_discount_exceeds_line_total'
        ? 'Diskon tidak boleh melebihi subtotal produk.'
        : code === 'sale_inventory_insufficient'
          ? 'Stok produk tidak cukup untuk jumlah ini.'
          : 'Transaksi belum tersimpan. Coba lagi.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  function renderCartWorkspace() {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button type="button" aria-label="Kembali ke katalog" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-portal-line text-portal-soft lg:hidden" onClick={backFromWorkspace}><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0"><p className="font-black text-portal-ink">Pesanan saat ini</p><p className="mt-0.5 text-xs text-portal-soft">{itemCount} item</p></div>
          </div>
          {lines.length ? <button type="button" className="rounded-lg px-2 py-1 text-xs font-bold text-portal-soft transition hover:bg-red-50 hover:text-red-700" onClick={() => { changed(); setLines([]); }}>Kosongkan</button> : null}
        </div>
        <div className="min-h-32 flex-1 overflow-y-auto p-4"><CartLines lines={lines} onQuantity={setQuantity} onEdit={editLine} /></div>
        <div className="space-y-3 border-t border-portal-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-portal-soft">Total bayar</p><p className="mt-0.5 text-2xl font-black tabular-nums text-portal-ink">{money.format(total)}</p></div><span className="pb-1 text-xs font-semibold text-portal-soft">{itemCount} item</span></div>
          <button type="button" className="portal-button-primary w-full justify-center py-3.5 text-base" disabled={!lines.length || total <= 0} onClick={openCheckout}>Bayar · {money.format(total)}</button>
        </div>
      </div>
    );
  }

  function renderCheckoutWorkspace() {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start gap-3 border-b border-portal-line px-4 py-3.5">
          <button type="button" aria-label="Kembali ke pesanan" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-portal-line text-portal-soft" disabled={saving} onClick={backFromWorkspace}><ArrowLeft className="h-4 w-4" /></button>
          <div><p className="text-xs font-bold uppercase tracking-wide text-portal-soft">Total bayar</p><p className="mt-1 text-3xl font-black tabular-nums text-portal-ink">{money.format(total)}</p></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map(option => {
              const Icon = option.icon;
              const active = accountKey === option.value;
              return <button key={option.value} type="button" onClick={() => choosePayment(option.value)} className={`flex min-h-12 items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-sm font-bold transition active:scale-[0.98] ${active ? 'border-portal-ink bg-portal-ink text-white shadow-sm' : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'}`}><Icon className="h-4 w-4 shrink-0" /> {option.label}</button>;
            })}
          </div>

          {accountKey === 'cash' ? (
            <div className="mt-4 rounded-2xl bg-[#f5f7f3] p-3.5">
              <div className="flex items-center justify-between gap-3"><label htmlFor="cash-tendered" className="text-sm font-bold text-portal-ink">Uang diterima</label>{tenderedAmount >= total ? <span className="text-xs font-bold text-emerald-700">Cukup</span> : null}</div>
              <div className="relative mt-2"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-portal-soft">Rp</span><input id="cash-tendered" className="portal-input h-12 w-full bg-white pl-9 text-lg font-black tabular-nums" type="number" inputMode="numeric" min={0} step="1000" value={tenderedAmount || ''} onFocus={event => event.currentTarget.select()} onChange={event => setTenderedAmount(Number(event.target.value) || 0)} /></div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">{cashPresets.slice(0, 6).map(amount => { const exact = amount === total; const active = tenderedAmount === amount; return <button key={amount} type="button" className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-black transition active:scale-95 ${active ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'}`} onClick={() => setTenderedAmount(amount)}>{exact ? 'Uang pas' : money.format(amount).replace(',00', '')}</button>; })}</div>
              <div className="mt-3 flex items-center justify-between border-t border-portal-line pt-3"><span className="text-sm font-semibold text-portal-soft">Kembalian</span><span className="text-2xl font-black tabular-nums text-portal-ink">{money.format(cashChange)}</span></div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-[#f5f7f3] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-portal-ink">{paymentOptions.find(option => option.value === accountKey)?.label}</p><p className="mt-0.5 text-xs leading-5 text-portal-soft">Pastikan pembayaran sudah diterima sebelum menyelesaikan transaksi.</p></div><CheckCircle2 className="h-5 w-5 shrink-0 text-portal-soft" /></div></div>
          )}

          <details className="mt-4" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail transaksi</summary>
            <div className="mt-3 space-y-3 rounded-2xl border border-portal-line p-3">
              <div><p className="text-xs font-semibold text-portal-soft">Kanal</p><div className="mt-2 flex flex-wrap gap-2">{channelOptions.map(option => <button key={option.value} type="button" onClick={() => { changed(); setChannelKey(option.value); }} className={`rounded-full border px-3 py-2 text-xs font-bold ${channelKey === option.value ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink'}`}>{option.label}</button>)}</div></div>
              <label className="grid gap-1 text-xs font-semibold text-portal-soft">Tanggal<input className="portal-input" type="date" value={occurredOn} onChange={event => { changed(); setOccurredOn(event.target.value); }} /></label>
            </div>
          </details>
          {accountKey === 'cash' && tenderedAmount < total ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Uang diterima masih kurang {money.format(total - tenderedAmount)}.</p> : null}
          {feedback?.tone === 'error' ? <p role="alert" aria-live="assertive" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{feedback.text}</p> : null}
        </div>
        <div className="shrink-0 border-t border-portal-line bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"><button type="button" className="portal-button-primary w-full justify-center py-3.5 text-base" disabled={saving || !canPay} onClick={submit}>{saving ? 'Menyimpan…' : accountKey === 'cash' ? `Terima · ${money.format(total)}` : `Selesaikan ${paymentOptions.find(option => option.value === accountKey)?.label ?? ''}`}</button></div>
      </div>
    );
  }

  function renderWorkspace() {
    if (workspaceMode === 'configure' && configuringProduct) {
      return (
        <QuickSaleProductConfigurator
          key={`${configuringProduct.id}:${editingLineKey ?? 'new'}`}
          open
          onOpenChange={open => { if (!open) closeConfigurator(); }}
          productName={configuringProduct.name}
          basePriceAmount={priceLabelToAmount(configuringProduct.priceLabel)}
          groups={configuringProduct.modifierGroups ?? []}
          initialSelection={editingLine ? { quantity: Number(editingLine.quantity), selectedOptions: editingLine.selectedOptions ?? [], note: editingLine.note } : undefined}
          onConfirm={addConfiguredProduct}
        />
      );
    }
    if (workspaceMode === 'checkout') return renderCheckoutWorkspace();
    return renderCartWorkspace();
  }

  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-portal-line bg-white p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f5f1] text-portal-soft"><Package className="h-5 w-5" /></div>
        <p className="mt-3 text-sm font-bold text-portal-ink">Belum ada produk untuk dijual</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-portal-soft">Tambahkan produk atau jasa beserta harga. Foto produk bersifat opsional, tetapi membantu kasir mengenali menu lebih cepat.</p>
      </div>
    );
  }

  if (receipt) {
    const hasCashChange = receipt.tenderedAmount !== null;
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <div className="rounded-3xl border border-portal-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1"><p className="text-lg font-black text-portal-ink">Transaksi berhasil</p><p className="mt-0.5 text-xs text-portal-soft">{receipt.receiptNumber}</p></div>
          </div>
          {hasCashChange ? (
            <div className="mt-5 rounded-2xl bg-[#f5f7f3] p-4 text-center"><p className="text-xs font-bold uppercase tracking-wide text-portal-soft">Kembalian</p><p className="mt-1 text-3xl font-black tabular-nums text-portal-ink">{money.format(receipt.changeAmount)}</p></div>
          ) : (
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5f7f3] p-4"><span className="text-sm font-semibold text-portal-soft">Total</span><span className="text-2xl font-black tabular-nums text-portal-ink">{money.format(receipt.total)}</span></div>
          )}
          <button type="button" className="portal-button-primary mt-4 w-full justify-center py-3.5 text-base" onClick={resetOrder}><Plus className="h-4 w-4" /> Transaksi baru</button>
          <details className="mt-4 rounded-2xl border border-portal-line">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-portal-ink">Lihat detail struk</summary>
            <div className="border-t border-portal-line px-4 pb-4">
              <div className="divide-y divide-portal-line">{receipt.lines.map((line, index) => <div key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold text-portal-ink">{line.name}</p>{line.configurationSummary ? <p className="text-xs font-semibold text-portal-forest">{line.configurationSummary}</p> : null}{line.note ? <p className="text-[11px] text-portal-soft">Catatan: {line.note}</p> : null}<p className="text-xs text-portal-soft">{line.quantity} × {money.format(line.unitPrice)}</p></div><p className="font-bold tabular-nums text-portal-ink">{money.format(line.quantity * line.unitPrice)}</p></div>)}</div>
              <div className="space-y-2 border-t border-portal-line pt-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-portal-soft">Pembayaran</span><span className="font-semibold text-portal-ink">{receipt.paymentLabel}</span></div>
                {receipt.tenderedAmount !== null ? <><div className="flex items-center justify-between"><span className="text-portal-soft">Diterima</span><span>{money.format(receipt.tenderedAmount)}</span></div><div className="flex items-center justify-between"><span className="text-portal-soft">Kembalian</span><span className="font-bold">{money.format(receipt.changeAmount)}</span></div></> : null}
                <div className="flex items-end justify-between border-t border-portal-line pt-3"><span className="font-bold text-portal-ink">Total</span><span className="text-xl font-black tabular-nums text-portal-ink">{money.format(receipt.total)}</span></div>
              </div>
            </div>
          </details>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="portal-button-secondary justify-center" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</button>
          <button type="button" className="portal-button-secondary justify-center" onClick={async () => {
            const text = buildReceiptShareText(receipt);
            if (navigator.share) await navigator.share({ text }).catch(() => undefined);
            else await navigator.clipboard?.writeText(text).catch(() => undefined);
          }}>Bagikan struk</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-[560px] gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <section className={`${mobileStage === 'catalog' ? 'block' : 'hidden'} min-w-0 lg:block`}>
        <div className="sticky top-0 z-[var(--portal-layer-sticky)] -mx-1 space-y-2 bg-white/95 px-1 pb-2 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
            <input className="portal-input h-11 w-full rounded-xl pl-10 pr-10 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari produk…" aria-label="Cari produk" autoComplete="off" />
            {search ? <button type="button" aria-label="Hapus pencarian" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-portal-soft hover:bg-[#f2f4f1] hover:text-portal-ink" onClick={() => setSearch('')}><X className="h-4 w-4" /></button> : null}
          </div>
          {filters.length > 1 ? <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{filters.map(filter => { const active = filter.key === filterKey; return <button key={filter.key} type="button" onClick={() => setFilterKey(filter.key)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition active:scale-95 ${active ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink hover:bg-[#f7f8f5]'}`}>{filter.label}</button>; })}</div> : null}
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredProducts.map(product => <ProductCard key={product.id} product={product} quantity={lines.filter(line => line.productId === product.id).reduce((totalQuantity, line) => totalQuantity + Number(line.quantity), 0)} onAdd={() => addProduct(product)} />)}
        </div>
        {!filteredProducts.length ? <div className="mt-3 rounded-2xl border border-dashed border-portal-line p-6 text-center"><p className="text-sm font-bold text-portal-ink">Produk tidak ditemukan</p><p className="mt-1 text-xs text-portal-soft">Coba kata lain atau pilih kategori Semua.</p><button type="button" className="portal-button-secondary mt-3" onClick={() => { setSearch(''); setFilterKey('all'); }}>Reset pencarian</button></div> : null}
      </section>

      <aside className="hidden min-h-0 flex-col overflow-hidden rounded-3xl border border-portal-line bg-white shadow-sm lg:sticky lg:top-3 lg:flex lg:max-h-[calc(100vh-7rem)]">{renderWorkspace()}</aside>

      {mobileStage === 'workspace' ? <section className="fixed inset-0 z-[var(--portal-layer-modal)] flex min-h-0 flex-col bg-white pb-[calc(var(--portal-mobile-nav-height)+env(safe-area-inset-bottom))] lg:hidden">{renderWorkspace()}</section> : null}

      {mobileStage === 'catalog' && lines.length ? <div className="fixed inset-x-3 bottom-[calc(var(--portal-mobile-nav-height)+env(safe-area-inset-bottom)+.75rem)] z-[var(--portal-layer-action)] rounded-2xl border border-portal-line bg-white p-2 shadow-2xl lg:hidden"><div className="flex items-center gap-2"><button type="button" className="min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-left active:bg-[#f7f8f5]" onClick={() => { setWorkspaceMode('cart'); setMobileStage('workspace'); }}><p className="truncate text-xs font-semibold text-portal-soft">{itemCount} item · Lihat pesanan</p><p className="truncate text-lg font-black tabular-nums text-portal-ink">{money.format(total)}</p></button><button type="button" className="portal-button-primary shrink-0 justify-center px-6 py-3.5" onClick={openCheckout}>Bayar</button></div></div> : null}

      {feedback && feedback.tone === 'success' ? <p role="status" className="lg:col-span-2 text-sm font-semibold text-emerald-700">{feedback.text}</p> : null}
    </div>
  );
}
