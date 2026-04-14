import type { NextRequest, NextResponse } from 'next/server';

type SameSite = 'lax' | 'strict' | 'none';

type ParsedCookie = {
  name: string;
  value: string;
  path?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: SameSite;
  maxAge?: number;
  expires?: Date;
};

function normalizeSameSite(value: string | undefined): SameSite | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return undefined;
}

function parseSetCookieHeader(rawHeader: string): ParsedCookie | null {
  const parts = rawHeader.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const [nameValue, ...attrs] = parts;
  const firstEq = nameValue.indexOf('=');
  if (firstEq <= 0) return null;

  const name = nameValue.slice(0, firstEq).trim();
  const value = nameValue.slice(firstEq + 1).trim();
  if (!name) return null;

  const parsed: ParsedCookie = {
    name,
    value,
    httpOnly: false,
    secure: false,
  };

  for (const attr of attrs) {
    const [rawKey, ...rest] = attr.split('=');
    const key = rawKey.trim().toLowerCase();
    const attrValue = rest.join('=').trim();

    if (key === 'path') parsed.path = attrValue || '/';
    else if (key === 'httponly') parsed.httpOnly = true;
    else if (key === 'secure') parsed.secure = true;
    else if (key === 'samesite') parsed.sameSite = normalizeSameSite(attrValue);
    else if (key === 'max-age') {
      const n = Number.parseInt(attrValue, 10);
      if (Number.isFinite(n)) parsed.maxAge = n;
    } else if (key === 'expires') {
      const d = new Date(attrValue);
      if (!Number.isNaN(d.getTime())) parsed.expires = d;
    }
  }

  return parsed;
}

export function readSetCookiesFromFetchResponse(res: Response): string[] {
  const headersWithSetCookie = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    return headersWithSetCookie.getSetCookie();
  }

  const fallback = res.headers.get('set-cookie');
  if (!fallback) return [];
  return splitCombinedSetCookieHeader(fallback);
}

function splitCombinedSetCookieHeader(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let inQuotes = false;
  let inExpires = false;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (inQuotes) continue;

    const rest = value.slice(i).toLowerCase();
    if (!inExpires && rest.startsWith('expires=')) {
      inExpires = true;
      i += 'expires='.length - 1;
      continue;
    }

    if (inExpires && ch === ';') {
      inExpires = false;
      continue;
    }

    if (!inExpires && ch === ',') {
      const cookie = value.slice(start, i).trim();
      if (cookie) result.push(cookie);
      start = i + 1;
    }
  }

  const lastCookie = value.slice(start).trim();
  if (lastCookie) result.push(lastCookie);
  return result;
}

export function forwardSetCookieHeaders(
  response: NextResponse,
  setCookieHeaders: string[],
  options: {
    secure: boolean;
    defaultPath?: string;
    defaultSameSite?: SameSite;
  },
): void {
  const defaultPath = options.defaultPath ?? '/';
  const defaultSameSite = options.defaultSameSite ?? 'lax';

  for (const rawHeader of setCookieHeaders) {
    const parsed = parseSetCookieHeader(rawHeader);
    if (!parsed) continue;

    // On non-HTTPS local development, force secure=false so browser accepts cookies.
    const secure = options.secure;
    const sameSite = parsed.sameSite === 'none' && !secure ? 'lax' : parsed.sameSite ?? defaultSameSite;

    response.cookies.set({
      name: parsed.name,
      value: parsed.value,
      path: parsed.path || defaultPath,
      httpOnly: true,
      secure,
      sameSite,
      ...(typeof parsed.maxAge === 'number' ? { maxAge: parsed.maxAge } : {}),
      ...(parsed.expires ? { expires: parsed.expires } : {}),
    });
  }
}

export function shouldUseSecureCookies(req: NextRequest): boolean {
  const host = req.nextUrl.hostname.toLowerCase();
  const isLocalhost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost');
  if (isLocalhost) return false;

  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '').toLowerCase();
  return protocol === 'https';
}

export function clearAuthCookies(response: NextResponse, secure: boolean): void {
  const names = ['access_token', 'refresh_token', 'session_id'];
  for (const name of names) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure,
      sameSite: 'lax',
    });
  }
  response.cookies.set({
    name: 'auth_present',
    value: '',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    secure,
    sameSite: 'lax',
  });
}
