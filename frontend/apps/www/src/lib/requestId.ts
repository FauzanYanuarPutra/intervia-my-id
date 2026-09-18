const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function normalizeRequestId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() || '';
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : null;
}

export function resolveRequestId(
  value: string | null | undefined,
): string {
  return normalizeRequestId(value) ?? crypto.randomUUID();
}
