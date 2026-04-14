type JwtPayloadLike = Record<string, unknown>;

function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4;
  if (padLength === 0) return normalized;
  return normalized + '='.repeat(4 - padLength);
}

export function decodeJwtPayload(token: string): JwtPayloadLike | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const json = Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as JwtPayloadLike) : null;
  } catch {
    return null;
  }
}

export function getJwtSubject(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (typeof sub === 'string' && sub.trim().length > 0) {
    return sub.trim();
  }
  return null;
}
