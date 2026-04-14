import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, getSession } from '@/lib/session';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth } from '@/lib/serverAuth';

// Revoke a specific session
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const sessionId = id;
    const { userId } = auth.ctx;

    // Verify session belongs to user
    const session = await getSession(sessionId);
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const revoked = await revokeSession(sessionId);

    if (revoked) {
      // Log audit event
      await logAuditEvent(userId, 'user.session.revoked', {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        eventData: {
          revokedSessionId: sessionId,
          revokedDevice: session.deviceName,
        },
      });
    }

    return NextResponse.json({
      success: revoked,
      message: revoked ? 'Session revoked' : 'Session not found',
    });
  } catch (e) {
    console.error('Revoke session error:', e);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
