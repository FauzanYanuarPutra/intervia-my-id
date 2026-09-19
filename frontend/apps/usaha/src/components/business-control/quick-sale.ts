import {
  productConfigurationSignature,
  type ProductModifierSelection,
} from 'lajukan-ui';

export type QuickSaleLineDraft = {
  productId: string;
  quantity: number | string;
  basePriceAmount?: number | string;
  unitPricePreviewAmount?: number | string;
  /** @deprecated Preview compatibility only. Never serialized as price authority. */
  unitPriceAmount?: number | string;
  discountAmount: number | string;
  selectedOptions?: ProductModifierSelection[];
  note?: string;
  configurationSignature?: string;
};

export type QuickSaleDraft = {
  occurredOn: string;
  locationId?: string | null;
  channelKey: string;
  accountKey: 'cash' | 'bank' | 'ewallet' | 'receivable';
  lines: QuickSaleLineDraft[];
};

export type CheckoutPaymentMethod = QuickSaleDraft['accountKey'];

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  configurationSummary?: string;
  note?: string;
};

export type ReceiptView = {
  receiptNumber: string;
  occurredAt: string;
  cashierName: string;
  paymentLabel: string;
  total: number;
  tenderedAmount: number | null;
  changeAmount: number;
  itemCount: number;
  lines: ReceiptLine[];
};

type ProductLike = {
  name: string;
};

function finiteNumber(value: number | string | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value ?? Number.NaN);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function previewUnitPrice(line: QuickSaleLineDraft) {
  return finiteNumber(line.unitPricePreviewAmount ?? line.unitPriceAmount ?? line.basePriceAmount);
}

function compactRupiah(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(safeAmount)}`;
}

export function normalizeLineNote(note?: string) {
  return (note ?? '').trim().replace(/\s+/g, ' ');
}

export function quickSaleLineIdentity(
  line: Pick<QuickSaleLineDraft, 'productId' | 'selectedOptions' | 'note' | 'configurationSignature'>,
) {
  const signature =
    line.configurationSignature ?? productConfigurationSignature(line.selectedOptions ?? []);
  return [line.productId, signature, normalizeLineNote(line.note)].join('::');
}

export function mergeQuickSaleLine(lines: QuickSaleLineDraft[], incoming: QuickSaleLineDraft) {
  const identity = quickSaleLineIdentity(incoming);
  const index = lines.findIndex(line => quickSaleLineIdentity(line) === identity);
  if (index < 0) return [...lines, incoming];
  return lines.map((line, currentIndex) =>
    currentIndex === index
      ? {
          ...line,
          quantity: finiteNumber(line.quantity) + finiteNumber(incoming.quantity),
        }
      : line,
  );
}

export function buildQuickSaleRequest(draft: QuickSaleDraft) {
  if (!draft.occurredOn || !draft.lines.length) throw new Error('invalid_sale_lines');

  const lines = draft.lines.map(line => {
    const quantity = finiteNumber(line.quantity);
    const unitPricePreviewAmount = previewUnitPrice(line);
    const discountAmount = finiteNumber(line.discountAmount);
    if (quantity <= 0 || unitPricePreviewAmount < 0 || discountAmount < 0) {
      throw new Error('invalid_sale_amount');
    }
    const previewGross = Math.round(quantity * unitPricePreviewAmount);
    if (discountAmount > previewGross) throw new Error('sale_discount_exceeds_line_total');
    return {
      product_id: line.productId,
      quantity,
      discount_amount: Math.round(discountAmount),
      selected_options: line.selectedOptions ?? [],
      note: normalizeLineNote(line.note) || null,
    };
  });

  return {
    occurred_on: draft.occurredOn,
    channel_key: draft.channelKey.trim() || null,
    ...(draft.locationId ? { location_id: draft.locationId } : {}),
    account_key: draft.accountKey,
    lines,
  };
}

export function quickSaleTotal(lines: QuickSaleLineDraft[]) {
  return lines.reduce((total, line) => {
    const quantity = finiteNumber(line.quantity);
    const unitPriceAmount = previewUnitPrice(line);
    const discountAmount = finiteNumber(line.discountAmount);
    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPriceAmount) ||
      !Number.isFinite(discountAmount)
    ) {
      return total;
    }
    return total + Math.max(0, Math.round(quantity * unitPriceAmount) - Math.round(discountAmount));
  }, 0);
}

export function quickSaleItemCount(lines: QuickSaleLineDraft[]) {
  return lines.reduce((total, line) => {
    const quantity = finiteNumber(line.quantity);
    return total + (Number.isFinite(quantity) ? Math.max(0, quantity) : 0);
  }, 0);
}

export function quickTenderAmounts(total: number) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  if (safeTotal <= 0) return [];
  const rounded10k = Math.ceil(safeTotal / 10_000) * 10_000;
  return Array.from(new Set([safeTotal, rounded10k, 50_000, 100_000])).filter(
    value => value >= safeTotal,
  );
}

export function filterQuickSaleProducts<T extends ProductLike>(products: T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase('id-ID');
  if (!normalized) return products;
  return products.filter(product => product.name.toLocaleLowerCase('id-ID').includes(normalized));
}

export function calculateCashChange(total: number, tenderedAmount: number) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  const safeTendered = Number.isFinite(tenderedAmount)
    ? Math.max(0, Math.round(tenderedAmount))
    : 0;
  return Math.max(0, safeTendered - safeTotal);
}

export function canCompleteCheckout(input: {
  total: number;
  paymentMethod: CheckoutPaymentMethod | string;
  tenderedAmount?: number;
  lineCount: number;
}) {
  if (!Number.isFinite(input.total) || input.total <= 0 || input.lineCount <= 0) return false;
  if (input.paymentMethod !== 'cash') return true;
  return Number.isFinite(input.tenderedAmount) && (input.tenderedAmount ?? 0) >= input.total;
}

export function buildReceiptView(input: {
  receiptNumber: string;
  occurredAt: string;
  cashierName: string;
  paymentLabel: string;
  total: number;
  tenderedAmount?: number;
  lines: ReceiptLine[];
}): ReceiptView {
  const tenderedAmount = Number.isFinite(input.tenderedAmount)
    ? Math.max(0, Math.round(input.tenderedAmount ?? 0))
    : null;
  return {
    receiptNumber: input.receiptNumber,
    occurredAt: input.occurredAt,
    cashierName: input.cashierName,
    paymentLabel: input.paymentLabel,
    total: Math.max(0, Math.round(input.total)),
    tenderedAmount,
    changeAmount: tenderedAmount === null ? 0 : calculateCashChange(input.total, tenderedAmount),
    itemCount: input.lines.reduce((total, line) => total + Math.max(0, Number(line.quantity) || 0), 0),
    lines: input.lines,
  };
}

export function buildReceiptShareText(receipt: ReceiptView) {
  const itemLines = receipt.lines.flatMap(line => {
    const rows = [`${line.name} ×${line.quantity}  ${compactRupiah(line.quantity * line.unitPrice)}`];
    if (line.configurationSummary) rows.push(`  ${line.configurationSummary}`);
    if (line.note) rows.push(`  Catatan: ${line.note}`);
    return rows;
  });
  const lines = [receipt.receiptNumber, ...itemLines, `Total ${compactRupiah(receipt.total)}`, receipt.paymentLabel];
  if (receipt.tenderedAmount !== null) {
    lines.push(`Diterima ${compactRupiah(receipt.tenderedAmount)}`);
    lines.push(`Kembalian ${compactRupiah(receipt.changeAmount)}`);
  }
  return lines.join('\n');
}

export function priceLabelToAmount(label: string) {
  const digits = label.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
