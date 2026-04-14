import Redis from 'ioredis';
import crypto from 'crypto';

const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
const OTP_HASH_SECRET = (process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'dev-otp-secret').trim();

type RedisGlobal = typeof globalThis & {
  __lajukanRedis?: Redis;
};

const redisGlobal = globalThis as RedisGlobal;

function hashOtp(type: 'email' | 'phone', target: string, otp: string): string {
  return crypto
    .createHmac('sha256', OTP_HASH_SECRET)
    .update(`${type}:${normalizeTarget(type, target)}:${otp.trim()}`)
    .digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getRedis(): Redis {
  if (!redisGlobal.__lajukanRedis) {
    redisGlobal.__lajukanRedis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableAutoPipelining: true,
      keepAlive: 30000,
      connectionName: process.env.REDIS_CONNECTION_NAME || 'lajukan-www',
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });

    redisGlobal.__lajukanRedis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }
  return redisGlobal.__lajukanRedis;
}

// OTP Functions
const OTP_PREFIX = 'otp:';
const OTP_EXPIRY = 300; // 5 minutes
const OTP_VERIFY_PREFIX = 'otp:verify:';
const OTP_VERIFY_EXPIRY = 900; // 15 minutes
const REFRESH_REVOKED_PREFIX = 'auth:refresh:revoked:';
const REFRESH_SESSION_REVOKED_PREFIX = 'auth:refresh:session:revoked:';
const DEFAULT_REFRESH_REVOKE_TTL = 30 * 24 * 60 * 60;

type OTPPurpose = 'register' | 'login' | 'reset' | 'profile';

type OTPVerifyPayload = {
  type: 'email' | 'phone';
  target: string;
  purpose: OTPPurpose;
};

function normalizeTarget(type: 'email' | 'phone', target: string): string {
  if (type === 'email') {
    return target.trim().toLowerCase();
  }
  return target.replace(/\D/g, '');
}

export async function storeOTP(type: 'email' | 'phone', target: string, otp: string): Promise<void> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}${type}:${normalizeTarget(type, target)}`;
  await redis.setex(key, OTP_EXPIRY, hashOtp(type, target, otp));
}

export async function deleteOTP(type: 'email' | 'phone', target: string): Promise<void> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}${type}:${normalizeTarget(type, target)}`;
  await redis.del(key);
}

export async function verifyOTP(type: 'email' | 'phone', target: string, otp: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}${type}:${normalizeTarget(type, target)}`;
  const stored = await redis.get(key);

  if (stored && safeEqual(stored, hashOtp(type, target, otp))) {
    await redis.del(key); // Delete after successful verification
    return true;
  }
  return false;
}

export async function getOTPAttempts(type: 'email' | 'phone', target: string): Promise<number> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}attempts:${type}:${normalizeTarget(type, target)}`;
  const attempts = await redis.get(key);
  return parseInt(attempts || '0', 10);
}

export async function incrementOTPAttempts(type: 'email' | 'phone', target: string): Promise<void> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}attempts:${type}:${normalizeTarget(type, target)}`;
  await redis.incr(key);
  await redis.expire(key, 3600); // 1 hour lockout window
}

export async function clearOTPAttempts(type: 'email' | 'phone', target: string): Promise<void> {
  const redis = getRedis();
  const key = `${OTP_PREFIX}attempts:${type}:${normalizeTarget(type, target)}`;
  await redis.del(key);
}

export async function issueOTPVerificationToken(
  type: 'email' | 'phone',
  target: string,
  purpose: OTPPurpose = 'register',
): Promise<string> {
  const redis = getRedis();
  const token = crypto.randomBytes(32).toString('hex');
  const payload: OTPVerifyPayload = {
    type,
    target: normalizeTarget(type, target),
    purpose,
  };
  await redis.setex(
    `${OTP_VERIFY_PREFIX}${token}`,
    OTP_VERIFY_EXPIRY,
    JSON.stringify(payload),
  );
  return token;
}

async function readOTPVerificationPayload(
  token: string,
): Promise<OTPVerifyPayload | null> {
  const redis = getRedis();
  const payloadRaw = await redis.get(`${OTP_VERIFY_PREFIX}${token}`);
  if (!payloadRaw) return null;

  try {
    return JSON.parse(payloadRaw) as OTPVerifyPayload;
  } catch {
    return null;
  }
}

function matchesOTPVerificationPayload(
  payload: OTPVerifyPayload | null,
  expected: Omit<OTPVerifyPayload, 'purpose'>,
  allowedPurposes: OTPPurpose[],
): boolean {
  const expectedTarget = normalizeTarget(expected.type, expected.target);
  return (
    !!payload &&
    payload.type === expected.type &&
    payload.target === expectedTarget &&
    allowedPurposes.includes(payload.purpose)
  );
}

export async function hasOTPVerificationTokenForPurposes(
  token: string,
  expected: Omit<OTPVerifyPayload, 'purpose'>,
  allowedPurposes: OTPPurpose[],
): Promise<boolean> {
  const payload = await readOTPVerificationPayload(token);
  return matchesOTPVerificationPayload(payload, expected, allowedPurposes);
}

export async function consumeOTPVerificationTokenForPurposes(
  token: string,
  expected: Omit<OTPVerifyPayload, 'purpose'>,
  allowedPurposes: OTPPurpose[],
): Promise<boolean> {
  const redis = getRedis();
  const key = `${OTP_VERIFY_PREFIX}${token}`;
  const payload = await readOTPVerificationPayload(token);
  const valid = matchesOTPVerificationPayload(
    payload,
    expected,
    allowedPurposes,
  );

  if (valid) {
    await redis.del(key);
  }

  return valid;
}

export async function consumeOTPVerificationToken(
  token: string,
  expected: OTPVerifyPayload,
): Promise<boolean> {
  return consumeOTPVerificationTokenForPurposes(
    token,
    {
      type: expected.type,
      target: expected.target,
    },
    [expected.purpose],
  );
}

// Session/Token storage
export async function storeVerificationToken(userId: string, token: string): Promise<void> {
  const redis = getRedis();
  await redis.setex(`verify:${token}`, 86400, userId); // 24 hours
}

export async function getVerificationToken(token: string): Promise<string | null> {
  const redis = getRedis();
  return redis.get(`verify:${token}`);
}

function hashRefreshToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token.trim())
    .digest('hex');
}

export async function revokeRefreshToken(
  token: string,
  ttlSeconds: number = DEFAULT_REFRESH_REVOKE_TTL,
): Promise<void> {
  const clean = token.trim();
  if (!clean) return;

  const redis = getRedis();
  await redis.setex(
    `${REFRESH_REVOKED_PREFIX}${hashRefreshToken(clean)}`,
    Math.max(60, ttlSeconds),
    '1',
  );
}

export async function isRefreshTokenRevoked(token: string): Promise<boolean> {
  const clean = token.trim();
  if (!clean) return false;

  const redis = getRedis();
  const exists = await redis.exists(
    `${REFRESH_REVOKED_PREFIX}${hashRefreshToken(clean)}`,
  );
  return exists === 1;
}

export async function revokeRefreshSession(
  sessionId: string,
  ttlSeconds: number = DEFAULT_REFRESH_REVOKE_TTL,
): Promise<void> {
  const clean = sessionId.trim();
  if (!clean) return;

  const redis = getRedis();
  await redis.setex(
    `${REFRESH_SESSION_REVOKED_PREFIX}${clean}`,
    Math.max(60, ttlSeconds),
    '1',
  );
}

export async function isRefreshSessionRevoked(sessionId: string): Promise<boolean> {
  const clean = sessionId.trim();
  if (!clean) return false;

  const redis = getRedis();
  const exists = await redis.exists(`${REFRESH_SESSION_REVOKED_PREFIX}${clean}`);
  return exists === 1;
}
