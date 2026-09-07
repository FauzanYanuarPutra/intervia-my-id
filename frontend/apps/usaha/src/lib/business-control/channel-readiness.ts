export function parseRecordedProductPrice(priceLabel?: string | null): number | null {
  if (!priceLabel) return null;
  const digits = priceLabel.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}
