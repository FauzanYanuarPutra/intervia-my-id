import { NextResponse } from 'next/server';
import {
  BusinessControlHttpError,
  listControlChannels,
} from '@/lib/business-control-server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const items = await listControlChannels(businessId);
    return NextResponse.json({ data: { items, count: items.length } });
  } catch (error) {
    if (error instanceof BusinessControlHttpError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Gagal memuat kanal jual.' }, { status: 500 });
  }
}
