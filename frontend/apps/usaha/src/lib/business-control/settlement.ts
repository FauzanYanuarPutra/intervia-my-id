export type SettlementInput = {
  grossSales: number;
  platformFee: number;
  merchantPromo: number;
  refunds: number;
  otherDeductions: number;
  actualTransfer: number;
};

export type SettlementStatus = 'matched' | 'short' | 'excess';

function nonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field}_must_be_non_negative`);
  }
  return value;
}

export function reconcileSettlement(input: SettlementInput) {
  const grossSales = nonNegative(input.grossSales, 'gross_sales');
  const platformFee = nonNegative(input.platformFee, 'platform_fee');
  const merchantPromo = nonNegative(input.merchantPromo, 'merchant_promo');
  const refunds = nonNegative(input.refunds, 'refunds');
  const otherDeductions = nonNegative(input.otherDeductions, 'other_deductions');
  const actualTransfer = nonNegative(input.actualTransfer, 'actual_transfer');

  const totalDeductions = platformFee + merchantPromo + refunds + otherDeductions;
  if (totalDeductions > grossSales) {
    throw new Error('deductions_exceed_gross_sales');
  }

  const expectedTransfer = grossSales - totalDeductions;
  const difference = actualTransfer - expectedTransfer;
  const status: SettlementStatus = difference === 0 ? 'matched' : difference < 0 ? 'short' : 'excess';

  return {
    grossSales,
    platformFee,
    merchantPromo,
    refunds,
    otherDeductions,
    totalDeductions,
    expectedTransfer,
    actualTransfer,
    difference,
    status,
  };
}
