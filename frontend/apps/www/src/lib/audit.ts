import { getRedis } from './redis';

// Audit event types
export type AuditEventType =
  // Authentication
  | 'user.login.success'
  | 'user.login.failed'
  | 'user.logout'
  | 'user.logout.all'
  | 'user.mfa.enabled'
  | 'user.mfa.disabled'
  | 'user.mfa.verified'
  | 'user.password.changed'
  | 'user.password.reset'
  | 'user.session.revoked'
  // Account
  | 'user.created'
  | 'user.profile.updated'
  | 'user.email.changed'
  | 'user.phone.changed'
  | 'user.role.changed'
  | 'user.suspended'
  | 'user.deleted'
  | 'user.data.exported'
  // Security
  | 'security.brute_force'
  | 'security.suspicious_ip'
  | 'security.device_new'
  | 'admin.impersonation.start'
  | 'admin.impersonation.end';

export interface AuditLogEntry {
  id: string;
  userId: string;
  actorId?: string; // For impersonation
  eventType: AuditEventType;
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const AUDIT_PREFIX = 'audit:';
const AUDIT_LIST_PREFIX = 'audit:user:';
const MAX_AUDIT_LOGS_PER_USER = 1000;

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userId: string,
  eventType: AuditEventType,
  options?: {
    actorId?: string;
    eventData?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    const redis = getRedis();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: AuditLogEntry = {
      id,
      userId,
      actorId: options?.actorId,
      eventType,
      eventData: options?.eventData,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      createdAt: new Date().toISOString(),
    };

    // Store individual log entry (expires in 90 days)
    await redis.setex(
      `${AUDIT_PREFIX}${id}`,
      90 * 24 * 60 * 60,
      JSON.stringify(entry)
    );

    // Add to user's audit log list
    await redis.lpush(`${AUDIT_LIST_PREFIX}${userId}`, id);
    await redis.ltrim(`${AUDIT_LIST_PREFIX}${userId}`, 0, MAX_AUDIT_LOGS_PER_USER - 1);

    // Also publish for real-time monitoring (optional)
    await redis.publish('audit:events', JSON.stringify(entry));

    console.log(`[AUDIT] ${eventType} - User: ${userId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLogEntry[]> {
  try {
    const redis = getRedis();
    const ids = await redis.lrange(
      `${AUDIT_LIST_PREFIX}${userId}`,
      offset,
      offset + limit - 1
    );

    if (ids.length === 0) return [];

    const logs: AuditLogEntry[] = [];
    for (const id of ids) {
      const data = await redis.get(`${AUDIT_PREFIX}${id}`);
      if (data) {
        logs.push(JSON.parse(data));
      }
    }

    return logs;
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

/**
 * Get human-readable description for audit event
 */
export function getAuditEventDescription(entry: AuditLogEntry): string {
  const descriptions: Record<AuditEventType, string> = {
    'user.login.success': 'Logged in successfully',
    'user.login.failed': 'Failed login attempt',
    'user.logout': 'Logged out',
    'user.logout.all': 'Logged out from all devices',
    'user.mfa.enabled': 'Two-factor authentication enabled',
    'user.mfa.disabled': 'Two-factor authentication disabled',
    'user.mfa.verified': 'Two-factor authentication verified',
    'user.password.changed': 'Password changed',
    'user.password.reset': 'Password reset via email',
    'user.session.revoked': 'Session revoked',
    'user.created': 'Account created',
    'user.profile.updated': 'Profile updated',
    'user.email.changed': 'Email address changed',
    'user.phone.changed': 'Phone number changed',
    'user.role.changed': 'Role changed',
    'user.suspended': 'Account suspended',
    'user.deleted': 'Account deleted',
    'user.data.exported': 'Personal data exported',
    'security.brute_force': 'Brute force attack detected',
    'security.suspicious_ip': 'Login from suspicious IP',
    'security.device_new': 'New device detected',
    'admin.impersonation.start': 'Admin started impersonation',
    'admin.impersonation.end': 'Admin ended impersonation',
  };

  return descriptions[entry.eventType] || entry.eventType;
}
