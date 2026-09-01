import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { requireAuth } from './serverAuth';

function makeReq(opts: { bearer?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.bearer) headers.set('authorization', `Bearer ${opts.bearer}`);

  if (opts.cookie) headers.set('cookie', `access_token=${opts.cookie}`);
  return new NextRequest('http://localhost/api/test', { headers });
}

const ENV_SNAPSHOT = { ...process.env };

beforeEach(() => {
  process.env = { ...ENV_SNAPSHOT };
});

afterEach(() => {
  process.env = { ...ENV_SNAPSHOT };
});

describe('requireAuth', () => {
  it('returns 401 when missing token', async () => {
    process.env.JWT_SECRET = 'test_secret_32_chars_minimum_123456';
    const res = await requireAuth(makeReq());
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected unauthorized');
    expect(res.res.status).toBe(401);
  });

  it('returns 503 when missing JWT_SECRET', async () => {
    delete process.env.JWT_SECRET;
    const res = await requireAuth(makeReq({ cookie: 'x.y.z' }));
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected unavailable');
    expect(res.res.status).toBe(503);
  });

  it('accepts valid jwt and extracts userId from sub and normalizes roles', async () => {
    process.env.JWT_SECRET = 'test_secret_32_chars_minimum_123456';
    process.env.ENV = 'development';

    const jwt = await new SignJWT({ roles: ['Admin', 'USER'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const res = await requireAuth(makeReq({ bearer: jwt }));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.ctx.userId).toBe('user-123');
    expect(res.ctx.roles).toEqual(['admin', 'user']);
  });

  it('returns 401 when jwt is invalid', async () => {
    process.env.JWT_SECRET = 'test_secret_32_chars_minimum_123456';
    const res = await requireAuth(makeReq({ cookie: 'invalid.token.here' }));
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected unauthorized');
    expect(res.res.status).toBe(401);
  });
});
