import { NextResponse } from 'next/server';
import {
  BusinessWorkHttpError,
  createBusinessWork,
  listBusinessWork,
} from '@/lib/business-work-server';

function errorResponse(error: unknown) {
  if (error instanceof BusinessWorkHttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'Gagal memuat pekerjaan usaha.' }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const url = new URL(request.url);
  try {
    const items = await listBusinessWork(businessId, {
      status: url.searchParams.get('status') || undefined,
      assigneeUserId: url.searchParams.get('assignee_user_id') || undefined,
    });
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const work = await createBusinessWork(businessId, body);
    return NextResponse.json({ data: { work } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
