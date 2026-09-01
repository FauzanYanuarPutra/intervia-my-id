import { NextResponse } from 'next/server';
import { updateBusiness } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : undefined;
    const metadataPatch: Record<string, unknown> = {};
    if (typeof body.isOpen === 'boolean') metadataPatch.isOpen = body.isOpen;
    if (Array.isArray(body.reservations)) metadataPatch.reservations = body.reservations;
    const business = await updateBusiness(businessId, { schedule, metadataPatch });
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
