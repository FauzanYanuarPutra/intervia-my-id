export type AsyncListStatus =
  | 'idle'
  | 'initial-loading'
  | 'refreshing'
  | 'success'
  | 'empty'
  | 'error'
  | 'stale-error';

type AsyncListStatusInput = {
  itemCount: number;
  loading: boolean;
  settled: boolean;
  error: boolean;
  hasStaleData?: boolean;
};

export function deriveAsyncListStatus({
  itemCount,
  loading,
  settled,
  error,
  hasStaleData,
}: AsyncListStatusInput): AsyncListStatus {
  const hasItems = itemCount > 0 || Boolean(hasStaleData);

  if (loading && !settled && !hasItems) return 'initial-loading';
  if (loading && hasItems) return 'refreshing';
  if (error && hasItems) return 'stale-error';
  if (error) return 'error';
  if (!settled) return 'idle';
  if (itemCount === 0) return 'empty';

  return 'success';
}

export function formatKnownNumber(
  value: number | null | undefined,
  formatter: (value: number) => string,
  unknownLabel: string,
  unavailableLabel: string,
): string {
  if (value === undefined) return unknownLabel;
  if (value === null) return unavailableLabel;

  return formatter(value);
}
