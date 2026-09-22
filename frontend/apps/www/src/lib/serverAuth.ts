import { NextRequest, NextResponse } from 'next/server';
import {
  decodeProtectedHeader,
  importSPKI,
  jwtVerify,
  type JWTPayload,
} from 'jose';

export type AuthContext = {
  token: string;
  userId: string;
  roles: string[];
  email?: string;
  payload: JWTPayload;
};

export type AuthGuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; res: NextResponse };

let cachedPublicKeySource = '';
let cachedPublicKey: ReturnType<typeof importSPKI> | null = null;

function getAppEnv(): string {
  return process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV || 'development';
}

function getBearerToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.slice('Bearer '.length).trim();
}

function normalizeRoles(rolesRaw: unknown): string[] {
  if (Array.isArray(rolesRaw)) return rolesRaw.map(r => String(r).toLowerCase());
  if (typeof rolesRaw === 'string' && rolesRaw) return [rolesRaw.toLowerCase()];
  return [];
}

function getUserIdFromPayload(payload: JWTPayload): string | undefined {
  const candidates: unknown[] = [
    payload.sub,
    payload.user_id,
    payload.userId,
    payload.id,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }

  return undefined;
}

function getEmailFromPayload(payload: JWTPayload): string | undefined {
  const candidates: unknown[] = [
    payload.email,
    payload.user_email,
    payload.preferred_username,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return undefined;
}

function allowLegacyHs256(): boolean {
  const raw = (process.env.JWT_ALLOW_LEGACY_HS256 || 'true').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function publicKeyPem(): string | undefined {
  const value = process.env.JWT_PUBLIC_KEY_PEM?.replaceAll('\\n', '\n').trim();
  return value || undefined;
}

function getPublicKey(pem: string): ReturnType<typeof importSPKI> {
  if (!cachedPublicKey || cachedPublicKeySource !== pem) {
    cachedPublicKeySource = pem;
    cachedPublicKey = importSPKI(pem, 'RS256');
  }
  return cachedPublicKey;
}

async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const protectedHeader = decodeProtectedHeader(token);

  if (protectedHeader.alg === 'RS256') {
    const pem = publicKeyPem();
    if (!pem) throw new Error('JWT public key is not configured');
    const { payload } = await jwtVerify(token, await getPublicKey(pem), {
      algorithms: ['RS256'],
    });
    return payload;
  }

  if (protectedHeader.alg === 'HS256' && allowLegacyHs256()) {
    const secretRaw = process.env.JWT_SECRET;
    if (!secretRaw) throw new Error('JWT legacy secret is not configured');
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secretRaw),
      { algorithms: ['HS256'] },
    );
    return payload;
  }

  throw new Error('Unsupported JWT algorithm');
}

export async function requireAuth(req: NextRequest): Promise<AuthGuardResult> {
  const appEnv = getAppEnv();
  const isDev = appEnv !== 'production';

  const cookieToken = req.cookies.get('access_token')?.value;
  const bearerToken = getBearerToken(req);

  const allowBearerInProd = process.env.ALLOW_BEARER_AUTH === 'true';
  const token = isDev
    ? bearerToken || cookieToken
    : cookieToken || (allowBearerInProd ? bearerToken : undefined);

  if (!token) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Unauthorized', shouldClearLocalAuth: isDev },
        { status: 401 },
      ),
    };
  }

  if (!process.env.JWT_SECRET && !publicKeyPem()) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Service unavailable' }, { status: 503 }),
    };
  }

  try {
    const payload = await verifyAccessToken(token);

    const userId = getUserIdFromPayload(payload);
    if (!userId) {
      return {
        ok: false,
        res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const roles = normalizeRoles(payload.roles);
    const email = getEmailFromPayload(payload);

    return {
      ok: true,
      ctx: {
        token,
        userId,
        roles,
        email,
        payload,
      },
    };
  } catch {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Unauthorized', shouldClearLocalAuth: isDev },
        { status: 401 },
      ),
    };
  }
}
