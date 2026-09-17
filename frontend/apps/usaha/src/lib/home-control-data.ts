type HomeControlSources<TIngredient, TFinanceEntry, TChannel> = {
  ingredients: Promise<TIngredient[]>;
  financeEntries: Promise<TFinanceEntry[]>;
  channels: Promise<TChannel[]>;
};

function rejectedValue<T>(
  source: string,
  result: PromiseSettledResult<T[]>,
): T[] {
  if (result.status === 'fulfilled') return result.value;

  console.error(`[usaha-home] optional ${source} data unavailable`, result.reason);
  return [];
}

export async function settleHomeControlData<
  TIngredient,
  TFinanceEntry,
  TChannel,
>({
  ingredients,
  financeEntries,
  channels,
}: HomeControlSources<TIngredient, TFinanceEntry, TChannel>) {
  const [ingredientsResult, financeEntriesResult, channelsResult] =
    await Promise.allSettled([ingredients, financeEntries, channels] as const);

  return {
    ingredients: rejectedValue('ingredients', ingredientsResult),
    financeEntries: rejectedValue('financeEntries', financeEntriesResult),
    channels: rejectedValue('channels', channelsResult),
  };
}
