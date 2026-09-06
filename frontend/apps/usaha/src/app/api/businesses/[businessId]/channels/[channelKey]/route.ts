import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  upsertControlChannel,
} from '@/lib/business-control-server';

export async function PUT(
  request: Request,
  context: { params: Promise<{ businessId: string; channelKey: string }> },
) {
  const { businessId, channelKey } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await upsertControlChannel(businessId, channelKey, body);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof BusinessControlHttpError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Gagal menyimpan kanal jual.' }, { status: 500 });
  }
}
