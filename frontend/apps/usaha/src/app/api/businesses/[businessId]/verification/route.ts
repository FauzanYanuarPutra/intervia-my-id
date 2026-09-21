import { NextResponse } from 'next/server';
import {
  getBusinessVerificationStatus,
  requestBusinessVerification,
} from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const verification = await getBusinessVerificationStatus(businessId);
    return NextResponse.json({ ok: true, verification });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Status verifikasi belum bisa dibaca.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const verification = await requestBusinessVerification(businessId);
    return NextResponse.json({ ok: true, ...verification });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Pengajuan verifikasi gagal.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
