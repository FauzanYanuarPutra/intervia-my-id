import { getRedis } from './redis';
import crypto from 'crypto';

export interface Session {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  ipAddress: string;
  location?: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
}

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user:sessions:';
const SESSION_EXPIRY = 30 * 24 * 60 * 60; // 30 days

/**
 * Parse user agent to get device info
 */
export function parseUserAgent(userAgent: string): { name: string; type: 'web' | 'mobile' | 'desktop' } {
  const ua = userAgent.toLowerCase();
  
  // Mobile detection
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    if (ua.includes('chrome')) return { name: 'Chrome Mobile', type: 'mobile' };
    if (ua.includes('safari')) return { name: 'Safari Mobile', type: 'mobile' };
    if (ua.includes('firefox')) return { name: 'Firefox Mobile', type: 'mobile' };
    return { name: 'Mobile Browser', type: 'mobile' };
  }
  
  // Desktop browsers
  if (ua.includes('chrome')) return { name: 'Chrome', type: 'web' };
  if (ua.includes('firefox')) return { name: 'Firefox', type: 'web' };
  if (ua.includes('safari')) return { name: 'Safari', type: 'web' };
  if (ua.includes('edge')) return { name: 'Edge', type: 'web' };
  
  return { name: 'Unknown Browser', type: 'web' };
}

/**
 * Generate device fingerprint from request info
 */
export function generateDeviceFingerprint(userAgent: string, ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${userAgent}:${ip}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  options: {
    userAgent: string;
    ipAddress: string;
    location?: string;
    sessionId?: string;
  }
): Promise<Session> {
  const redis = getRedis();
  const device = parseUserAgent(options.userAgent);
  const fingerprint = generateDeviceFingerprint(options.userAgent, options.ipAddress);
  
  const session: Session = {
    id: options.sessionId?.trim() || crypto.randomUUID(),
    userId,
    deviceFingerprint: fingerprint,
    deviceName: device.name,
    deviceType: device.type,
    ipAddress: options.ipAddress,
    location: options.location,
    userAgent: options.userAgent,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRY * 1000).toISOString(),
  };

  // Store session
  await redis.setex(
    `${SESSION_PREFIX}${session.id}`,
    SESSION_EXPIRY,
    JSON.stringify(session)
  );

  // Add to user's session list
  await redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, session.id);

  return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const redis = getRedis();
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  return data ? JSON.parse(data) : null;
}

/**
 * Update session last active time
 */
export async function touchSession(sessionId: string): Promise<void> {
  const redis = getRedis();
  const session = await getSession(sessionId);
  
  if (session) {
    session.lastActiveAt = new Date().toISOString();
    await redis.setex(
      `${SESSION_PREFIX}${sessionId}`,
      SESSION_EXPIRY,
      JSON.stringify(session)
    );
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const redis = getRedis();
  const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
  
  const sessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await getSession(id);
    if (session) {
      sessions.push(session);
    } else {
      // Clean up expired session reference
      await redis.srem(`${USER_SESSIONS_PREFIX}${userId}`, id);
    }
  }

  // Sort by last active (most recent first)
  return sessions.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  const session = await getSession(sessionId);
  
  if (!session) return false;

  await redis.del(`${SESSION_PREFIX}${sessionId}`);
  await redis.srem(`${USER_SESSIONS_PREFIX}${session.userId}`, sessionId);
  
  return true;
}

/**
 * Revoke all sessions for a user (except current)
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  const redis = getRedis();
  const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
  
  let revokedCount = 0;
  for (const id of sessionIds) {
    if (id !== exceptSessionId) {
      await redis.del(`${SESSION_PREFIX}${id}`);
      await redis.srem(`${USER_SESSIONS_PREFIX}${userId}`, id);
      revokedCount++;
    }
  }

  return revokedCount;
}

/**
 * Check if session is valid and not expired
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;
  
  const expiresAt = new Date(session.expiresAt).getTime();
  return Date.now() < expiresAt;
}
