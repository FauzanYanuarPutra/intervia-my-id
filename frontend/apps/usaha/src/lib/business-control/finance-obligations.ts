import { monthlyRecurringForecast } from './finance';

export type RecurringObligationInput = {
  amount: number;
  intervalDays: number;
  nextDueOn: string;
  active?: boolean;
};

function isoDayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function obligationUrgency(
  nextDueOn: string,
  today: string,
): 'overdue' | 'today' | 'soon' | 'later' {
  const dueDay = isoDayNumber(nextDueOn);
  const todayDay = isoDayNumber(today);
  if (!Number.isFinite(dueDay) || !Number.isFinite(todayDay)) return 'later';
  const distance = dueDay - todayDay;
  if (distance < 0) return 'overdue';
  if (distance === 0) return 'today';
  if (distance <= 14) return 'soon';
  return 'later';
}

export function summarizeRecurringObligations(
  rows: RecurringObligationInput[],
  today: string,
) {
  const activeRows = rows.filter(
    row => row.active !== false && Number.isFinite(row.amount) && row.amount > 0 && Number.isFinite(row.intervalDays) && row.intervalDays > 0,
  );
  const nearRows = activeRows.filter(row => {
    const urgency = obligationUrgency(row.nextDueOn, today);
    return urgency === 'overdue' || urgency === 'today' || urgency === 'soon';
  });
  const datedRows = activeRows
    .filter(row => Number.isFinite(isoDayNumber(row.nextDueOn)))
    .sort((a, b) => isoDayNumber(a.nextDueOn) - isoDayNumber(b.nextDueOn));

  return {
    monthlyForecast: activeRows.reduce(
      (sum, row) => sum + monthlyRecurringForecast({
        amount: row.amount,
        cadenceUnit: 'day',
        cadenceInterval: row.intervalDays,
        days: 30,
      }),
      0,
    ),
    overdueCount: activeRows.filter(row => obligationUrgency(row.nextDueOn, today) === 'overdue').length,
    dueSoonCount: nearRows.length,
    dueSoonAmount: nearRows.reduce((sum, row) => sum + row.amount, 0),
    nextDueOn: datedRows[0]?.nextDueOn ?? null,
  };
}
