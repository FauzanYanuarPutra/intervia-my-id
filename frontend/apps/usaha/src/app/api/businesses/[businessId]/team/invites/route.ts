import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBusinessForCurrentActor, updateBusiness } from '@/lib/business-server';
import type { BusinessInvite, PortalRole } from '@/lib/portal-types';

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const business = await getBusinessForCurrentActor(businessId);
    if (!business) return NextResponse.json({ error: 'Usaha tidak ditemukan.' }, { status: 404 });
    if (!business.permissions.includes('inviteMembers')) return NextResponse.json({ error: 'Kamu tidak punya izin mengundang anggota.' }, { status: 403 });
    const body = (await request.json()) as { name?: string; phone?: string; role?: PortalRole };
    const name = body.name?.trim() || '';
    const phone = body.phone?.trim() || '';
    if (name.length < 2 || phone.replace(/\s+/g, '').length < 9) return NextResponse.json({ error: 'Nama dan nomor anggota wajib diisi.' }, { status: 400 });
    const invite: BusinessInvite = { id: randomUUID(), name, phone, role: body.role ?? 'cashier', status: 'pending', sentAt: new Date().toISOString() };
    const updated = await updateBusiness(business.id, { metadataPatch: { invites: [...business.invites, invite] } });
    return NextResponse.json({ ok: true, business: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal kirim undangan.' }, { status: 400 });
  }
}
