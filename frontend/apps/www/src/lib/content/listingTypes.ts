export const VALID_LISTING_CONTENT_TYPES = new Set([
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
  'company',
  'business_transfer',
]);

export function isListingContentType(value: unknown): boolean {
  return VALID_LISTING_CONTENT_TYPES.has(
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  );
}
