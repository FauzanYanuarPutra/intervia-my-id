import { NextRequest, NextResponse } from 'next/server';
import { getUserAuditLogs, getAuditEventDescription } from '@/lib/audit';
import { requireAuth } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { userId } = auth.ctx;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const logs = await getUserAuditLogs(userId, limit, offset);

    // Add human-readable descriptions
    const enrichedLogs = logs.map(log => ({
      ...log,
      description: getAuditEventDescription(log),
    }));

    return NextResponse.json({ logs: enrichedLogs });
  } catch (e) {
    console.error('Get audit logs error:', e);
    return NextResponse.json({ error: 'Failed to get audit logs' }, { status: 500 });
  }
}
