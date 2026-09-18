import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from 'jose';
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

  it('returns 503 when no JWT verification key is configured', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_PUBLIC_KEY_PEM;
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

  it('accepts RS256 tokens using the public verification key', async () => {
    process.env.ENV = 'development';
    process.env.JWT_ALLOW_LEGACY_HS256 = 'true';

    const { privateKey, publicKey } = await generateKeyPair('RS256', {
      extractable: true,
    });
    process.env.JWT_PUBLIC_KEY_PEM = await exportSPKI(publicKey);
    const privatePem = await exportPKCS8(privateKey);

    const { importPKCS8 } = await import('jose');
    const signingKey = await importPKCS8(privatePem, 'RS256');
    const jwt = await new SignJWT({ roles: ['Seller'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('user-rs256')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(signingKey);

    const res = await requireAuth(makeReq({ bearer: jwt }));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.ctx.userId).toBe('user-rs256');
    expect(res.ctx.roles).toEqual(['seller']);
  });

  it('rejects legacy HS256 tokens after the rollout flag is disabled', async () => {
    process.env.JWT_SECRET = 'test_secret_32_chars_minimum_123456';
    process.env.JWT_ALLOW_LEGACY_HS256 = 'false';
    process.env.ENV = 'development';

    const jwt = await new SignJWT({ roles: ['user'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('legacy-user')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const res = await requireAuth(makeReq({ bearer: jwt }));
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected unauthorized');
    expect(res.res.status).toBe(401);
  });

  it('returns 401 when jwt is invalid', async () => {
    process.env.JWT_SECRET = 'test_secret_32_chars_minimum_123456';
    const res = await requireAuth(makeReq({ cookie: 'invalid.token.here' }));
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected unauthorized');
    expect(res.res.status).toBe(401);
  });
});
