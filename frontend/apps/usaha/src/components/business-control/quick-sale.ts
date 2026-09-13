export type QuickSaleLineDraft = {
  productId: string;
  quantity: number | string;
  unitPriceAmount: number | string;
  discountAmount: number | string;
};

export type QuickSaleDraft = {
  occurredOn: string;
  channelKey: string;
  accountKey: 'cash' | 'bank' | 'ewallet' | 'receivable';
  lines: QuickSaleLineDraft[];
};

export type CheckoutPaymentMethod = QuickSaleDraft['accountKey'];

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
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

function finiteNumber(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function buildQuickSaleRequest(draft: QuickSaleDraft) {
  if (!draft.occurredOn || !draft.lines.length) throw new Error('invalid_sale_lines');

  const lines = draft.lines.map(line => {
    const quantity = finiteNumber(line.quantity);
    const unitPriceAmount = finiteNumber(line.unitPriceAmount);
    const discountAmount = finiteNumber(line.discountAmount);
    if (quantity <= 0 || unitPriceAmount < 0 || discountAmount < 0) {
      throw new Error('invalid_sale_amount');
    }
    const gross = Math.round(quantity * unitPriceAmount);
    if (discountAmount > gross) throw new Error('sale_discount_exceeds_line_total');
    return {
      product_id: line.productId,
      quantity,
      unit_price_amount: Math.round(unitPriceAmount),
      discount_amount: Math.round(discountAmount),
    };
  });

  return {
    occurred_on: draft.occurredOn,
    channel_key: draft.channelKey.trim() || null,
    account_key: draft.accountKey,
    lines,
  };
}

export function quickSaleTotal(lines: QuickSaleLineDraft[]) {
  return lines.reduce((total, line) => {
    const quantity = finiteNumber(line.quantity);
    const unitPriceAmount = finiteNumber(line.unitPriceAmount);
    const discountAmount = finiteNumber(line.discountAmount);
    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPriceAmount) ||
      !Number.isFinite(discountAmount)
    ) {
      return total;
    }
    return (
      total +
      Math.max(
        0,
        Math.round(quantity * unitPriceAmount) - Math.round(discountAmount),
      )
    );
  }, 0);
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

export function priceLabelToAmount(label: string) {
  const digits = label.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
