import { NextResponse } from 'next/server';
import { updateBusiness } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function readOptionalVersion(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Alasan perubahan operasional wajib diisi.', code: 'operation_change_reason_required' }, { status: 400 });
    }
    const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : undefined;
    const expectedVersion = readOptionalVersion(body.expectedVersion);
    if (!schedule || schedule.length < 5 || schedule.length > 300) {
      return NextResponse.json({ error: 'Jam operasional harus 5–300 karakter.', code: 'invalid_business_schedule' }, { status: 400 });
    }
    const metadataPatch: Record<string, unknown> = {};
    if (typeof body.isOpen === 'boolean') metadataPatch.isOpen = body.isOpen;
    if (Array.isArray(body.reservations)) metadataPatch.reservations = body.reservations;
    const business = await updateBusiness(businessId, { schedule, metadataPatch, reason, expectedVersion });
    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal memperbarui operasional.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}

export const POST = PATCH;
