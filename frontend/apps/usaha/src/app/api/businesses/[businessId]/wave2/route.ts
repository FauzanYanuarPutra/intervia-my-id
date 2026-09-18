import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  BusinessWave2HttpError,
  closeWave2CashShift,
  createWave2Obligation,
  createWave2Purchase,
  createWave2YieldObservation,
  getCurrentWave2CashShift,
  getWave2FinancePlan,
  listWave2Obligations,
  listWave2YieldObservations,
  openWave2CashShift,
  payWave2Obligation,
  putWave2FinancePlan,
  setWave2PrimaryMaterial,
} from '@/lib/business-wave2-server';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BusinessWave2HttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  const kind = new URL(request.url).searchParams.get('kind');
  try {
    if (kind === 'finance') {
      const [plan, obligations] = await Promise.all([
        getWave2FinancePlan(businessId),
        listWave2Obligations(businessId),
      ]);
      return NextResponse.json({ data: { plan, obligations } });
    }
    if (kind === 'shift') {
      const shift = await getCurrentWave2CashShift(businessId);
      return NextResponse.json({ data: { shift } });
    }
    if (kind === 'yield') {
      const items = await listWave2YieldObservations(businessId);
      return NextResponse.json({ data: { items, count: items.length } });
    }
    return NextResponse.json({ error: 'invalid_wave2_kind' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat kontrol usaha.');
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const { action: _action, ...input } = body;

    if (action === 'save_finance_plan') {
      const plan = await putWave2FinancePlan(businessId, input);
      return NextResponse.json({ data: { plan } });
    }
    if (action === 'create_obligation') {
      const idempotencyKey = request.headers.get('idempotency-key')?.trim() || randomUUID();
      const obligation = await createWave2Obligation(businessId, idempotencyKey, input);
      return NextResponse.json({ data: { obligation } }, { status: 201 });
    }
    if (action === 'pay_obligation') {
      const obligationId = String(body.obligation_id || '');
      const paidOn = String(body.paid_on || '');
      if (!obligationId || !paidOn) {
        return NextResponse.json({ error: 'invalid_obligation_payment' }, { status: 400 });
      }
      const result = await payWave2Obligation(
        businessId,
        obligationId,
        request.headers.get('idempotency-key')?.trim() || randomUUID(),
        paidOn,
      );
      return NextResponse.json(result);
    }
    if (action === 'purchase') {
      const result = await createWave2Purchase(
        businessId,
        request.headers.get('idempotency-key')?.trim() || randomUUID(),
        input,
      );
      return NextResponse.json(result, { status: 201 });
    }
    if (action === 'open_cash_shift') {
      const idempotencyKey = request.headers.get('idempotency-key')?.trim();
      if (!idempotencyKey) {
        return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
      }
      const result = await openWave2CashShift(businessId, idempotencyKey, input);
      return NextResponse.json(
        { data: { shift: result.shift, replayed: result.replayed } },
        { status: result.replayed ? 200 : 201 },
      );
    }
    if (action === 'close_cash_shift') {
      const shiftId = String(body.shift_id || '');
      if (!shiftId) {
        return NextResponse.json({ error: 'invalid_cash_shift' }, { status: 400 });
      }
      const idempotencyKey = request.headers.get('idempotency-key')?.trim();
      if (!idempotencyKey) {
        return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
      }
      const result = await closeWave2CashShift(businessId, shiftId, idempotencyKey, input);
      return NextResponse.json({ data: { shift: result.shift, replayed: result.replayed } });
    }
    if (action === 'set_primary_material') {
      const productId = String(body.product_id || '');
      if (!productId) {
        return NextResponse.json({ error: 'invalid_product_id' }, { status: 400 });
      }
      const result = await setWave2PrimaryMaterial(businessId, productId, input);
      return NextResponse.json(result);
    }
    if (action === 'create_yield_observation') {
      const idempotencyKey = request.headers.get('idempotency-key')?.trim() || randomUUID();
      const observation = await createWave2YieldObservation(businessId, idempotencyKey, input);
      return NextResponse.json({ data: { observation } }, { status: 201 });
    }

    return NextResponse.json({ error: 'invalid_wave2_action' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan kontrol usaha.');
  }
}
