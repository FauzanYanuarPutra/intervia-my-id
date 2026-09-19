import { NextResponse } from 'next/server';
import {
  BusinessWorkHttpError,
  updateBusinessWork,
} from '@/lib/business-work-server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; workId: string }> },
) {
  const { businessId, workId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const work = await updateBusinessWork(businessId, workId, body);
    return NextResponse.json({ data: { work } });
  } catch (error) {
    if (error instanceof BusinessWorkHttpError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Gagal memperbarui pekerjaan.' }, { status: 500 });
  }
}
