export type ClientIdempotencyAttempt = {
  fingerprint: string;
  key: string;
};

type KeyFactory = () => string;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function idempotencyFingerprint(payload: unknown) {
  return JSON.stringify(canonicalize(payload));
}

export function resolveIdempotencyAttempt(
  current: ClientIdempotencyAttempt | null,
  payload: unknown,
  createKey: KeyFactory = () => crypto.randomUUID(),
): ClientIdempotencyAttempt {
  const fingerprint = idempotencyFingerprint(payload);
  if (current?.fingerprint === fingerprint) return current;
  return { fingerprint, key: createKey() };
}
