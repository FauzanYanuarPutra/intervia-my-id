export type BusinessDayInput = {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  otherIncome?: number;
  ownerCapital?: number;
  ownerDrawing?: number;
};

export type AllocationPlanInput = {
  distributableAmount: number;
  ownerTakePercent: number;
  payrollPercent: number;
  reinvestPercent: number;
  operatingPercent: number;
  reservePercent: number;
};

export type RecurringForecastInput = {
  amount: number;
  cadenceUnit: 'day' | 'week' | 'month';
  cadenceInterval: number;
  days?: number;
};

export type PriceHealthStatus = 'unknown' | 'loss' | 'thin' | 'safe' | 'good';
export type MetricConfidence = 'low' | 'medium' | 'high';

export type PriceHealthInput = {
  sellingPrice: number;
  unitCost: number | null;
  feeRateBps?: number;
  merchantPromoAmount?: number;
  targetMarginBps?: number;
  costEstimated?: boolean;
};

export type ObservedYieldInput = {
  inputQuantity: number;
  outputUnits: number;
};

function amount(value: number | undefined, field: string) {
  const resolved = value ?? 0;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error(`${field}_must_be_non_negative`);
  }
  return resolved;
}

function percentage(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field}_must_be_between_0_and_100`);
  }
  return value;
}

function basisPoints(value: number | undefined, field: string) {
  const resolved = value ?? 0;
  if (!Number.isFinite(resolved) || resolved < 0 || resolved >= 10_000) {
    throw new Error(`${field}_must_be_between_0_and_9999`);
  }
  return resolved;
}

export function summarizeBusinessDay(input: BusinessDayInput) {
  const revenue = amount(input.revenue, 'revenue');
  const cogs = amount(input.cogs, 'cogs');
  const operatingExpenses = amount(input.operatingExpenses, 'operating_expenses');
  const otherIncome = amount(input.otherIncome, 'other_income');
  const ownerCapital = amount(input.ownerCapital, 'owner_capital');
  const ownerDrawing = amount(input.ownerDrawing, 'owner_drawing');

  const grossProfit = revenue - cogs;
  const operatingProfit = grossProfit + otherIncome - operatingExpenses;
  // COGS is an accrual/profit recognition event, not proof that cash left on
  // the same day. Inventory may have been purchased days or weeks earlier.
  // Detailed cash balances come from the account ledger; this legacy helper
  // therefore only models direct same-day operating cash effects.
  const cashMovement = revenue + otherIncome + ownerCapital - operatingExpenses - ownerDrawing;

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    otherIncome,
    operatingProfit,
    ownerCapital,
    ownerDrawing,
    cashMovement,
  };
}

export function buildAllocationPlanSummary(input: AllocationPlanInput) {
  const distributableAmount = Math.round(amount(input.distributableAmount, 'distributable_amount'));
  const ownerTakePercent = percentage(input.ownerTakePercent, 'owner_take_percent');
  const payrollPercent = percentage(input.payrollPercent, 'payroll_percent');
  const reinvestPercent = percentage(input.reinvestPercent, 'reinvest_percent');
  const operatingPercent = percentage(input.operatingPercent, 'operating_percent');
  const reservePercent = percentage(input.reservePercent, 'reserve_percent');
  const allocatedPercent = ownerTakePercent + payrollPercent + reinvestPercent + operatingPercent + reservePercent;

  if (allocatedPercent > 100) throw new Error('allocation_exceeds_100_percent');

  const allocationAmount = (percent: number) => Math.round(distributableAmount * percent / 100);

  return {
    allocatedPercent,
    unallocatedPercent: 100 - allocatedPercent,
    ownerTakeAmount: allocationAmount(ownerTakePercent),
    payrollAmount: allocationAmount(payrollPercent),
    reinvestAmount: allocationAmount(reinvestPercent),
    operatingAmount: allocationAmount(operatingPercent),
    reserveAmount: allocationAmount(reservePercent),
  };
}

export function monthlyRecurringForecast(input: RecurringForecastInput) {
  const recurringAmount = amount(input.amount, 'recurring_amount');
  const interval = amount(input.cadenceInterval, 'cadence_interval');
  const days = amount(input.days ?? 30, 'forecast_days');
  if (interval <= 0) throw new Error('cadence_interval_must_be_positive');
  if (days <= 0) return 0;

  const periodDays = input.cadenceUnit === 'day'
    ? interval
    : input.cadenceUnit === 'week'
      ? interval * 7
      : interval * 30;

  return Math.round(recurringAmount * (days / periodDays));
}

export function calculateSafeToSpend(input: {
  liquidCash: number;
  dueSoonObligations: number;
  reserveFloor: number;
  protectedPayroll: number;
}) {
  const liquidCash = amount(input.liquidCash, 'liquid_cash');
  const dueSoonObligations = amount(input.dueSoonObligations, 'due_soon_obligations');
  const reserveFloor = amount(input.reserveFloor, 'reserve_floor');
  const protectedPayroll = amount(input.protectedPayroll, 'protected_payroll');

  return Math.max(0, Math.round(liquidCash - dueSoonObligations - reserveFloor - protectedPayroll));
}

export function buildPriceHealth(input: PriceHealthInput) {
  const sellingPrice = amount(input.sellingPrice, 'selling_price');
  const feeRateBps = basisPoints(input.feeRateBps, 'fee_rate_bps');
  const merchantPromoAmount = amount(input.merchantPromoAmount, 'merchant_promo_amount');
  const targetMarginBps = basisPoints(input.targetMarginBps ?? 2_000, 'target_margin_bps');

  if (input.unitCost === null || input.unitCost === undefined) {
    return {
      status: 'unknown' as const,
      confidence: 'low' as const,
      contributionAmount: null,
      contributionMarginBps: null,
      minimumNonLossPrice: null,
      healthyPrice: null,
    };
  }

  const unitCost = amount(input.unitCost, 'unit_cost');
  const feeAmount = Math.round(sellingPrice * feeRateBps / 10_000);
  const contributionAmount = sellingPrice - feeAmount - merchantPromoAmount - unitCost;
  const contributionMarginBps = sellingPrice > 0
    ? Math.round(contributionAmount * 10_000 / sellingPrice)
    : contributionAmount < 0
      ? -10_000
      : 0;

  const retainedRate = 1 - feeRateBps / 10_000;
  const healthyRetainedRate = retainedRate - targetMarginBps / 10_000;
  const requiredBase = unitCost + merchantPromoAmount;
  const minimumNonLossPrice = retainedRate > 0
    ? Math.ceil(requiredBase / retainedRate)
    : null;
  const healthyPrice = healthyRetainedRate > 0
    ? Math.ceil(requiredBase / healthyRetainedRate)
    : null;

  let status: PriceHealthStatus;
  if (contributionAmount < 0) status = 'loss';
  else if (contributionMarginBps < 1_000) status = 'thin';
  else if (contributionMarginBps < 2_500) status = 'safe';
  else status = 'good';

  return {
    status,
    confidence: (input.costEstimated ? 'medium' : 'high') as MetricConfidence,
    contributionAmount,
    contributionMarginBps,
    minimumNonLossPrice,
    healthyPrice,
  };
}

export function summarizeObservedYield(rows: ObservedYieldInput[]) {
  const validRows = rows.filter(row =>
    Number.isFinite(row.inputQuantity) &&
    Number.isFinite(row.outputUnits) &&
    row.inputQuantity > 0 &&
    row.outputUnits > 0,
  );

  if (!validRows.length) {
    return {
      outputPerInput: null,
      evidenceCount: 0,
      confidence: 'low' as const,
    };
  }

  const totalInput = validRows.reduce((sum, row) => sum + row.inputQuantity, 0);
  const totalOutput = validRows.reduce((sum, row) => sum + row.outputUnits, 0);
  const outputPerInput = Math.round((totalOutput / totalInput) * 100) / 100;
  const evidenceCount = validRows.length;
  const confidence: MetricConfidence = evidenceCount >= 5
    ? 'high'
    : evidenceCount >= 2
      ? 'medium'
      : 'low';

  return { outputPerInput, evidenceCount, confidence };
}

export function summarizeStockPurchase(input: {
  quantity: number;
  totalAmount: number;
}) {
  const quantity = Number.isFinite(input.quantity) ? Math.max(0, input.quantity) : 0;
  const totalAmount = Number.isFinite(input.totalAmount)
    ? Math.max(0, Math.round(input.totalAmount))
    : 0;

  return {
    quantity,
    totalAmount,
    amountPerUnit: quantity > 0 && totalAmount > 0
      ? Math.round(totalAmount / quantity)
      : null,
  };
}

export function previewObservedYield(input: ObservedYieldInput) {
  const valid =
    Number.isFinite(input.inputQuantity) &&
    Number.isFinite(input.outputUnits) &&
    input.inputQuantity > 0 &&
    input.outputUnits > 0;

  return {
    outputPerInput: valid
      ? Math.round((input.outputUnits / input.inputQuantity) * 100) / 100
      : null,
    valid,
  };
}