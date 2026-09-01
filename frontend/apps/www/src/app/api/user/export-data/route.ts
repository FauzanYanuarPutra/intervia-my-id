import { NextRequest, NextResponse } from 'next/server';
import { getUserAuditLogs } from '@/lib/audit';
import { getUserSessions } from '@/lib/session';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth } from '@/lib/serverAuth';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

/**
 * GDPR: Export all user data
 * Right to Data Portability
 */
async function handleExportData(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { userId, token } = auth.ctx;

    // Collect all user data
    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
    };

    // 1. Get user profile from backend (identity: GET /auth/me)
    try {
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        exportData.profile = {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          phone: profile.phone,
          location: profile.location,
          avatarUrl: profile.avatar_url,
          emailVerified: profile.email_verified,
          phoneVerified: profile.phone_verified,
          roles: profile.roles,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
      }
    } catch (error) {
      console.error('Failed to fetch profile for export:', error);
    }

    // 2. Get sessions
    try {
      const sessions = await getUserSessions(userId);
      exportData.sessions = sessions.map(s => ({
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        location: s.location,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      }));
    } catch (e) {
      console.error('Failed to fetch sessions for export:', e);
      exportData.sessions = [];
    }

    // 3. Get audit logs (last 1000)
    try {
      const auditLogs = await getUserAuditLogs(userId, 1000);
      exportData.activityHistory = auditLogs.map(log => ({
        eventType: log.eventType,
        createdAt: log.createdAt,
        ipAddress: log.ipAddress,
      }));
    } catch (e) {
      console.error('Failed to fetch audit logs for export:', e);
      exportData.activityHistory = [];
    }

    // 4. Get user content from marketplace (owner filter if supported)
    const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || 'http://localhost:8081';
    try {
      const contentRes = await fetch(`${MARKETPLACE_URL}/v1/content?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (contentRes.ok) {
        const data = await contentRes.json();
        exportData.content = Array.isArray(data) ? data : data?.data ?? [];
      } else {
        exportData.content = [];
      }
    } catch {
      exportData.content = [];
    }

    // Log the export event
    await logAuditEvent(userId, 'user.data.exported', {
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="lajukan-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (e) {
    console.error('Export data error:', e);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleExportData(req);
}

export async function POST(req: NextRequest) {
  return handleExportData(req);
}

