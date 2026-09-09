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

export function priceLabelToAmount(label: string) {
  const digits = label.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
