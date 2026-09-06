import { summarizeFinanceEntries, type FinanceEntryLike } from './ledger';

export type IngredientInsightInput = {
  name: string;
  stock_quantity: string | number;
  minimum_stock: string | number;
};

export type FinanceInsightInput = FinanceEntryLike & {
  occurred_on: string;
};

export type ChannelInsightInput = {
  enabled: boolean;
};

function number(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeControlCenter(input: {
  ingredients: IngredientInsightInput[];
  financeEntries: FinanceInsightInput[];
  channels: ChannelInsightInput[];
  today: string;
}) {
  const lowIngredients = input.ingredients.filter(item => {
    const minimum = number(item.minimum_stock);
    return minimum > 0 && number(item.stock_quantity) <= minimum;
  });
  const todayEntries = input.financeEntries.filter(item => item.occurred_on === input.today);
  const financeToday = summarizeFinanceEntries(todayEntries);
  const enabledChannels = input.channels.filter(item => item.enabled).length;

  return {
    lowIngredients,
    lowIngredientCount: lowIngredients.length,
    todayEntryCount: todayEntries.length,
    financeToday,
    configuredChannelCount: input.channels.length,
    enabledChannelCount: enabledChannels,
  };
}

export function jakartaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
