const CANONICAL_USAHA_ORIGIN = 'https://usaha.lajukan.com';

type UsahaOriginOptions = {
  configuredOrigin?: string;
  requestOrigin?: string;
};

type GoogleCallbackOptions = {
  publicOrigin: string;
  configuredRedirectUri?: string;
};

function normalizeOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function isTrustedUsahaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      /^usaha(?:\.[a-z0-9-]+)*\.lajukan\.com$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function resolveUsahaPublicOrigin({
  configuredOrigin,
  requestOrigin,
}: UsahaOriginOptions): string {
  const configured = normalizeOrigin(configuredOrigin);
  const request = normalizeOrigin(requestOrigin);

  if (
    request &&
    isTrustedUsahaOrigin(request) &&
    (!configured || isLocalOrigin(configured))
  ) {
    return request;
  }

  if (configured && (isTrustedUsahaOrigin(configured) || isLocalOrigin(configured))) {
    return configured;
  }

  if (request && (isTrustedUsahaOrigin(request) || isLocalOrigin(request))) {
    return request;
  }

  return CANONICAL_USAHA_ORIGIN;
}

export function resolveUsahaGoogleCallbackUri({
  publicOrigin,
  configuredRedirectUri,
}: GoogleCallbackOptions): string {
  const fallback = `${publicOrigin}/api/auth/google/callback`;
  if (!configuredRedirectUri?.trim()) return fallback;

  try {
    const callback = new URL(configuredRedirectUri.trim());
    if (
      callback.origin === publicOrigin &&
      callback.pathname === '/api/auth/google/callback' &&
      !callback.search &&
      !callback.hash
    ) {
      return callback.toString();
    }
  } catch {}

  return fallback;
}
