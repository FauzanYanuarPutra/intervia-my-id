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

export function summarizeBusinessDay(input: BusinessDayInput) {
  const revenue = amount(input.revenue, 'revenue');
  const cogs = amount(input.cogs, 'cogs');
  const operatingExpenses = amount(input.operatingExpenses, 'operating_expenses');
  const otherIncome = amount(input.otherIncome, 'other_income');
  const ownerCapital = amount(input.ownerCapital, 'owner_capital');
  const ownerDrawing = amount(input.ownerDrawing, 'owner_drawing');

  const grossProfit = revenue - cogs;
  const operatingProfit = grossProfit + otherIncome - operatingExpenses;
  const cashMovement = revenue + otherIncome + ownerCapital - cogs - operatingExpenses - ownerDrawing;

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
