export function createIdempotencyKey(scope = 'txn'): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${scope}-${randomPart}`.replace(/[^A-Za-z0-9._:-]/g, '');
}
