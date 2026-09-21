import { NextResponse } from 'next/server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import { requestBusinessVerification } from '@/lib/business-server';

export async function POST(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const result = await requestBusinessVerification(businessId);
    return NextResponse.json({ ok: true, ...(result && typeof result === 'object' ? result : {}) });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal mengajukan verifikasi usaha.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
