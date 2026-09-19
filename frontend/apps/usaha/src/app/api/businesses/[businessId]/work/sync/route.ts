import { NextResponse } from 'next/server';
import {
  BusinessWorkHttpError,
  syncBusinessWorkSuggestions,
} from '@/lib/business-work-server';

export async function POST(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const created = await syncBusinessWorkSuggestions(businessId);
    return NextResponse.json({ data: { created } });
  } catch (error) {
    if (error instanceof BusinessWorkHttpError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Gagal memperbarui rekomendasi pekerjaan.' }, { status: 500 });
  }
}
