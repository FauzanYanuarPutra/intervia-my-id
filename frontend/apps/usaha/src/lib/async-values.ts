const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatKnownCurrency(
  value: number | null | undefined,
  unknownLabel = '...',
  unavailableLabel = 'Tidak tersedia',
): string {
  if (value === undefined) return unknownLabel;
  if (value === null) return unavailableLabel;

  return IDR_FORMATTER.format(value).replace(/\s+/g, '');
}

export function isInitialTableLoading({
  rowCount,
  loading,
  settled,
}: {
  rowCount: number;
  loading: boolean;
  settled: boolean;
}): boolean {
  return loading && !settled && rowCount === 0;
}
