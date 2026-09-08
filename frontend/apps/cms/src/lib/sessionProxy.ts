const AUTH_SECRET_FIELDS = new Set(['access_token', 'refresh_token', 'session_id']);

export function accessTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === 'access_token') {
      const value = rawValue.join('=').trim();
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export function sanitizeAuthPayload(payload: string): string {
  if (!payload.trim()) return payload;

  try {
    const value = JSON.parse(payload) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return payload;

    const record = { ...(value as Record<string, unknown>) };
    for (const field of AUTH_SECRET_FIELDS) delete record[field];
    return JSON.stringify(record);
  } catch {
    return payload;
  }
}

export function safeInternalRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return fallback;
  }
  return candidate;
}

export function forwardedSetCookies(headers: Headers): string[] {
  const enhancedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const values = enhancedHeaders.getSetCookie?.() ?? [];
  if (values.length > 0) return values;

  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}
