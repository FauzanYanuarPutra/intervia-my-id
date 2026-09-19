import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  listControlAuditEvents,
} from '@/lib/business-control-server';
import { getAuthenticatedActor } from '@/lib/business-server';

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const url = new URL(request.url);
  try {
    const items = await listControlAuditEvents(businessId, {
      subjectType: url.searchParams.get('subject_type') ?? undefined,
      subjectId: url.searchParams.get('subject_id') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 100),
    });
    const actor = await getAuthenticatedActor();
    return NextResponse.json({
      items: items.map(item => ({
        ...item,
        actor_is_current_user: Boolean(actor?.id && item.actor_user_id === actor.id),
      })),
      count: items.length,
    });
  } catch (error) {
    if (error instanceof BusinessControlHttpError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: 'business_audit_history_unavailable' },
      { status: 503 },
    );
  }
}
