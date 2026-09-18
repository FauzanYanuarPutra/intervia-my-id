import 'server-only';

const DEFAULT_UPSTREAM_TIMEOUT_MS = 8_000;
const MIN_UPSTREAM_TIMEOUT_MS = 1_000;
const MAX_UPSTREAM_TIMEOUT_MS = 30_000;

export function upstreamRequestTimeoutMs(
  raw = process.env.UPSTREAM_REQUEST_TIMEOUT_MS,
): number {
  const parsed = Number.parseInt((raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_UPSTREAM_TIMEOUT_MS;
  return Math.max(
    MIN_UPSTREAM_TIMEOUT_MS,
    Math.min(MAX_UPSTREAM_TIMEOUT_MS, parsed),
  );
}

export async function fetchInternal(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = upstreamRequestTimeoutMs(),
): Promise<Response> {
  if (init.signal) {
    return fetch(input, init);
  }

  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}
