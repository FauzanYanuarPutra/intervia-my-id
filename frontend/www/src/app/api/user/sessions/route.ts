import { NextRequest, NextResponse } from 'next/server';
import { getUserSessions, revokeAllUserSessions } from '@/lib/session';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth } from '@/lib/serverAuth';

// Get all active sessions for current user
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { userId } = auth.ctx;
    const currentSessionId = req.cookies.get('session_id')?.value || null;

    const sessions = await getUserSessions(userId);

    // Hide sensitive data
    const sanitizedSessions = sessions.map(s => ({
      id: s.id,
      deviceName: s.deviceName,
      deviceType: s.deviceType,
      location: s.location || 'Unknown',
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentSessionId != null && s.id === currentSessionId,
    }));

    return NextResponse.json({ sessions: sanitizedSessions });
  } catch (e) {
    console.error('Get sessions error:', e);
    return NextResponse.json({ error: 'Failed to get sessions' }, { status: 500 });
  }
}

// Logout from all devices
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { userId } = auth.ctx;
    const currentSessionId = req.cookies.get('session_id')?.value;

    const revokedCount = await revokeAllUserSessions(userId, currentSessionId);

    // Log audit event
    await logAuditEvent(userId, 'user.logout.all', {
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      eventData: { revokedCount },
    });

    return NextResponse.json({
      success: true,
      message: `Logged out from ${revokedCount} device(s)`,
      revokedCount,
    });
  } catch (e) {
    console.error('Logout all error:', e);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
