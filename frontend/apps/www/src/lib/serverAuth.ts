import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

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
    (payload as any).user_id,
    (payload as any).userId,
    (payload as any).id,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }

  return undefined;
}

function getEmailFromPayload(payload: JWTPayload): string | undefined {
  const candidates: unknown[] = [
    (payload as any).email,
    (payload as any).user_email,
    (payload as any).preferred_username,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return undefined;
}

export async function requireAuth(req: NextRequest): Promise<AuthGuardResult> {
  const appEnv = getAppEnv();
  const isDev = appEnv !== 'production';

  const cookieToken = req.cookies.get('access_token')?.value;
  const bearerToken = getBearerToken(req);

  const allowBearerInProd = process.env.ALLOW_BEARER_AUTH === 'true';
  const token = isDev ? bearerToken || cookieToken : cookieToken || (allowBearerInProd ? bearerToken : undefined);

  if (!token) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Unauthorized', shouldClearLocalAuth: isDev },
        { status: 401 },
      ),
    };
  }

  const secretRaw = process.env.JWT_SECRET;
  if (!secretRaw) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Service unavailable' }, { status: 503 }),
    };
  }

  try {
    const secret = new TextEncoder().encode(secretRaw);
    const { payload } = await jwtVerify(token, secret);

    const userId = getUserIdFromPayload(payload);
    if (!userId) {
      return {
        ok: false,
        res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const roles = normalizeRoles((payload as any).roles);
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
  } catch (e) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Unauthorized', shouldClearLocalAuth: isDev },
        { status: 401 },
      ),
    };
  }
}
