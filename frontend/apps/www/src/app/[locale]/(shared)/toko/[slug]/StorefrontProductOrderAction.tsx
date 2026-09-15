'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  StorefrontOrderClientError,
  createStorefrontOrderSubmitter,
  type StorefrontCanonicalOrderBundle,
  type StorefrontOrderLineInput,
} from '@/lib/super-app/storefront-order-client';
import {
  defaultStorefrontSelections,
  estimatedConfiguredPriceCents,
  parseStorefrontModifierGroups,
  storefrontConfigurationSignature,
  validateStorefrontSelections,
  type StorefrontModifierSelection,
} from '@/lib/super-app/storefront-product-modifiers';

type StorefrontProductOrderActionProps = {
  storeId: string;
  productId: string;
  productName: string;
  productPriceCents?: number;
  productMetadata?: Record<string, unknown>;
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

type ConfiguredLine = StorefrontOrderLineInput & {
  signature: string;
  optionSummary: string;
  estimatedUnitPriceCents: number;
};

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

function formatIdrCents(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value / 100)));
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
    return isId ? 'Pilihan produk berubah atau sudah tidak tersedia. Tutup lalu pilih ulang.' : 'The product options changed or are no longer available. Please choose again.';
  }
  if (error.status === 429) {
    return isId ? 'Terlalu banyak percobaan. Coba lagi sebentar lagi.' : 'Too many attempts. Please try again shortly.';
  }
  if (error.status >= 500) {
    return isId ? 'Layanan pemesanan sedang tidak tersedia. Pesanan tidak dibuat.' : 'Ordering is temporarily unavailable. No order was created.';
  }
  return isId ? 'Pesanan ditolak. Periksa pilihan dan ketersediaan lalu coba lagi.' : 'The order was rejected. Check the options and availability and try again.';
}

function createIdempotencyKey(): string {
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
  isId,
  variant = 'default',
}: StorefrontProductOrderActionProps) {
  const [state, setState] = useState<OrderUiState>({ phase: 'idle' });
  const [submitter] = useState(() => createStorefrontOrderSubmitter());
  const groups = useMemo(() => parseStorefrontModifierGroups(productMetadata), [productMetadata]);
  const [configOpen, setConfigOpen] = useState(false);
  const [selections, setSelections] = useState<StorefrontModifierSelection[]>(() => defaultStorefrontSelections(groups));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [selectionErrors, setSelectionErrors] = useState<Record<string, string>>({});
  const [configuredLines, setConfiguredLines] = useState<ConfiguredLine[]>([]);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const compact = variant === 'compact';
  const canOrder = onlineOrderEnabled && productAvailable;
  const locked = state.phase === 'submitting' || state.phase === 'success';
  const hasChoices = groups.length > 0;
  const estimatedUnitPrice = estimatedConfiguredPriceCents(productPriceCents, groups, selections);
  const queuedCount = configuredLines.reduce((total, line) => total + line.quantity, 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (configOpen && !dialog.open) dialog.showModal();
    if (!configOpen && dialog.open) dialog.close();
  }, [configOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (state.phase !== 'submitting') setConfigOpen(false);
    };
    const handleClose = () => triggerRef.current?.focus({ preventScroll: true });
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, [state.phase]);

  function resetAttempt() {
    idempotencyKeyRef.current = null;
    if (state.phase !== 'submitting') setState({ phase: 'idle' });
  }

  function updateSelection(groupId: string, optionId: string, checked: boolean, single: boolean) {
    resetAttempt();
    setSelectionErrors(current => ({ ...current, [groupId]: '' }));
    setSelections(current => current.map(selection => {
      if (selection.group_id !== groupId) return selection;
      if (single) return { ...selection, option_ids: checked ? [optionId] : [] };
      const next = new Set(selection.option_ids);
      if (checked) next.add(optionId); else next.delete(optionId);
      return { ...selection, option_ids: [...next] };
    }));
  }

  function buildDraftLine(): ConfiguredLine | null {
    const errors = validateStorefrontSelections(groups, selections);
    if (Object.keys(errors).length) {
      setSelectionErrors(errors);
      return null;
    }
    const signature = storefrontConfigurationSignature(selections);
    const selectedMap = new Map(selections.map(item => [item.group_id, new Set(item.option_ids)]));
    const optionSummary = groups
      .flatMap(group => group.options.filter(option => selectedMap.get(group.id)?.has(option.id)).map(option => `${group.name}: ${option.label}`))
      .join(' · ');
    return {
      productId,
      quantity,
      selectedOptions: selections,
      note: note.trim() || undefined,
      signature,
      optionSummary,
      estimatedUnitPriceCents: estimatedUnitPrice,
    };
  }

  function addLine(current: ConfiguredLine[], draft: ConfiguredLine): ConfiguredLine[] {
    const same = current.find(line => line.signature === draft.signature && (line.note ?? '') === (draft.note ?? ''));
    if (!same) return [...current, draft];
    return current.map(line => line === same ? { ...line, quantity: line.quantity + draft.quantity } : line);
  }

  function queueRacikan() {
    const draft = buildDraftLine();
    if (!draft) return;
    setConfiguredLines(current => addLine(current, draft));
    setSelections(defaultStorefrontSelections(groups));
    setQuantity(1);
    setNote('');
    setSelectionErrors({});
    resetAttempt();
  }

  async function submitLines(lines: StorefrontOrderLineInput[]) {
    if (!canOrder || locked || submittingRef.current || !lines.length) return;
    submittingRef.current = true;
    setState({ phase: 'submitting' });
    try {
      const idempotencyKey = idempotencyKeyRef.current || (idempotencyKeyRef.current = createIdempotencyKey());
      const bundle = await submitter.submit({ storeId, items: lines, idempotencyKey, fulfillmentMode: 'pickup' });
      setState({ phase: 'success', bundle });
      setConfigOpen(false);
      setConfiguredLines([]);
    } catch (error) {
      setState({ phase: 'error', message: messageForError(error, isId) });
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleOrder() {
    if (!canOrder || locked || submittingRef.current) return;
    if (hasChoices) {
      setState({ phase: 'idle' });
      setConfigOpen(true);
      return;
    }
    await submitLines([{ productId, quantity: 1 }]);
  }

  async function submitConfigured() {
    const draft = buildDraftLine();
    if (!draft) return;
    const lines = addLine(configuredLines, draft).map(({ signature: _signature, optionSummary: _summary, estimatedUnitPriceCents: _estimated, ...line }) => line);
    await submitLines(lines);
  }

  const disabledReason = !onlineOrderEnabled
    ? isId ? 'Pemesanan online belum dibuka oleh toko.' : 'Online ordering is not enabled by this business.'
    : !productAvailable
      ? isId ? 'Produk ini belum tersedia untuk dipesan.' : 'This product is not currently available to order.'
      : null;

  const idleLabel = compact ? (isId ? 'Pesan' : 'Order') : hasChoices ? (isId ? 'Pilih & pesan' : 'Choose & order') : (isId ? 'Pesan 1 produk' : 'Order 1 item');

  return (
    <div data-variant={variant} className={compact ? 'mt-2' : 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800'}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOrder}
        disabled={!canOrder || locked}
        aria-label={isId ? `Pesan ${productName}` : `Order ${productName}`}
        data-testid="storefront-order-button"
        className={compact
          ? 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-xs font-extrabold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-300'
          : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300'}
      >
        {state.phase === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : state.phase === 'success' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
        {state.phase === 'submitting' ? (isId ? 'Membuat pesanan…' : 'Creating order…') : state.phase === 'success' ? (isId ? 'Pesanan dibuat' : 'Order created') : idleLabel}
      </button>

      {disabledReason ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{disabledReason}</p> : null}
      {state.phase === 'error' && !configOpen ? <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{state.message}</p> : null}
      {state.phase === 'success' ? (
        <div role="status" data-testid="storefront-order-success" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-100">
          <p className="font-extrabold">{isId ? 'Referensi pesanan' : 'Order reference'}: <span className="font-mono">{state.bundle.order.order_number}</span></p>
          <p className="mt-0.5">{isId ? 'Total canonical' : 'Canonical total'}: <strong>{formatCanonicalAmount(state.bundle.order.total_amount, state.bundle.order.currency, isId)}</strong></p>
          <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-100/75">{isId ? 'Harga akhir dihitung server dari produk dan pilihan yang valid.' : 'The final price is calculated by the server from valid product options.'}</p>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={isId ? `Atur ${productName}` : `Customize ${productName}`}
        onMouseDown={event => {
          if (event.target === event.currentTarget && state.phase !== 'submitting') setConfigOpen(false);
        }}
        className="m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-slate-950 backdrop:bg-slate-950/45 backdrop:backdrop-blur-[1.5px] dark:text-slate-50 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:w-[min(560px,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-3xl sm:bg-white sm:shadow-2xl dark:sm:bg-slate-900"
      >
        <div onMouseDown={event => event.stopPropagation()} className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-slate-900 sm:static sm:max-h-[90dvh] sm:rounded-3xl sm:pb-0 sm:shadow-none">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-base font-black">{productName}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatIdrCents(productPriceCents)} · {isId ? 'Atur sesuai selera' : 'Customize your item'}</p>
            </div>
            <button type="button" disabled={state.phase === 'submitting'} aria-label={isId ? 'Tutup pilihan' : 'Close options'} onClick={() => setConfigOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-5 w-5" /></button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {configuredLines.length ? (
              <section className="mb-4 rounded-2xl bg-emerald-50/80 p-3 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-emerald-950 dark:text-emerald-100">{isId ? 'Sudah ditambahkan' : 'Added configurations'}</p><span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{queuedCount} item</span></div>
                <div className="mt-2 space-y-2">
                  {configuredLines.map((line, index) => (
                    <div key={`${line.signature}-${line.note ?? ''}`} className="flex items-start gap-2 rounded-xl bg-white/90 p-2.5 dark:bg-slate-900/80">
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold">{line.quantity}× {line.optionSummary || productName}</p>{line.note ? <p className="mt-0.5 truncate text-[11px] text-slate-500">Catatan: {line.note}</p> : null}</div>
                      <button type="button" aria-label="Hapus racikan" onClick={() => { setConfiguredLines(current => current.filter((_, currentIndex) => currentIndex !== index)); resetAttempt(); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="space-y-5">
              {groups.map(group => {
                const selection = selections.find(item => item.group_id === group.id)?.option_ids ?? [];
                return (
                  <fieldset key={group.id} className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <legend className="text-sm font-black">{group.name}</legend>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{group.required ? (isId ? 'Wajib' : 'Required') : group.selection_mode === 'multiple' ? `${isId ? 'Maks.' : 'Max'} ${group.max_selections}` : (isId ? 'Opsional' : 'Optional')}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {group.options.map(option => {
                        const checked = selection.includes(option.id);
                        const disabled = group.selection_mode === 'multiple' && !checked && selection.length >= group.max_selections;
                        return (
                          <label key={option.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <input type={group.selection_mode === 'single' ? 'radio' : 'checkbox'} name={group.selection_mode === 'single' ? `modifier-${productId}-${group.id}` : undefined} checked={checked} disabled={disabled} onChange={event => updateSelection(group.id, option.id, event.target.checked, group.selection_mode === 'single')} className="h-5 w-5 shrink-0 accent-emerald-700" />
                            <span className="min-w-0 flex-1 text-sm font-semibold">{option.label}</span>
                            {option.price_delta_cents ? <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">+{formatIdrCents(option.price_delta_cents)}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                    {selectionErrors[group.id] ? <p className="mt-1.5 text-xs font-semibold text-rose-600">{selectionErrors[group.id]}</p> : null}
                  </fieldset>
                );
              })}

              <section>
                <p className="text-sm font-black">{isId ? 'Jumlah' : 'Quantity'}</p>
                <div className="mt-2 inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                  <button type="button" aria-label="Kurangi jumlah" onClick={() => { setQuantity(value => Math.max(1, value - 1)); resetAttempt(); }} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-12 text-center text-sm font-black tabular-nums">{quantity}</span>
                  <button type="button" aria-label="Tambah jumlah" onClick={() => { setQuantity(value => Math.min(200, value + 1)); resetAttempt(); }} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="h-4 w-4" /></button>
                </div>
              </section>

              <label className="grid gap-1.5 text-sm font-black">{isId ? 'Catatan' : 'Note'} <span className="font-normal text-slate-500">({isId ? 'opsional' : 'optional'})</span>
                <textarea value={note} maxLength={200} onChange={event => { setNote(event.target.value); resetAttempt(); }} rows={2} placeholder={isId ? 'Contoh: es sedikit' : 'Example: less ice'} className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-700 dark:bg-slate-900" />
              </label>
            </div>

            {state.phase === 'error' ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{state.message}</p> : null}
          </div>

          <footer className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:pb-4">
            <div className="mb-2 flex items-end justify-between gap-3"><span className="text-xs font-semibold text-slate-500">{isId ? 'Perkiraan racikan ini' : 'This configuration'}</span><strong className="text-lg tabular-nums">{formatIdrCents(estimatedUnitPrice * quantity)}</strong></div>
            <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-2">
              <button type="button" disabled={state.phase === 'submitting'} onClick={queueRacikan} className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">{isId ? 'Tambah racikan' : 'Add configuration'}</button>
              <button type="button" disabled={state.phase === 'submitting'} onClick={submitConfigured} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">{state.phase === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}{isId ? `Pesan ${queuedCount + quantity} item` : `Order ${queuedCount + quantity} items`}</button>
            </div>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
