import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';

const AiGuardSchema = z.object({
  order_id: z.string().min(8).max(120),
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  risk_score: z.number().min(0).max(100).default(0),
  risk_flags: z.array(z.string().max(120)).default([]),
  tracking: z.object({
    eta_minutes: z.number().min(0).max(1000),
    distance_km: z.number().min(0).max(5000),
    pickup: z.object({ lat: z.number(), lng: z.number() }),
    partner: z.object({ lat: z.number(), lng: z.number() }),
    customer: z.object({ lat: z.number(), lng: z.number() }),
  }),
});

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return r * c;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-ai-guard',
      ipLimit: 360,
      deviceLimit: 240,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:ai-guard:${auth.ctx.userId}:${security.ip}`,
      limit: 200,
      windowSeconds: 3600,
      message: 'Too many AI guard checks. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, AiGuardSchema);
    if (!parsed.ok) return parsed.response;

    const { risk_score, risk_flags, tracking, service } = parsed.data;
    const partnerToPickup = haversineKm(tracking.partner, tracking.pickup);
    const pickupToCustomer = haversineKm(tracking.pickup, tracking.customer);

    const checks: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    checks.push(`Risk score baseline: ${risk_score}`);
    checks.push(`Partner -> pickup: ${partnerToPickup.toFixed(2)} km`);
    checks.push(`Pickup -> customer: ${pickupToCustomer.toFixed(2)} km`);
    checks.push(`ETA signal: ${tracking.eta_minutes} min`);

    if (risk_flags.length > 0) {
      checks.push(`Risk flags: ${risk_flags.join(', ')}`);
    }

    if (risk_score >= 60 || risk_flags.includes('off_platform_payment_signal')) {
      severity = 'high';
      recommendations.push('Hold dispatch and trigger manual review.');
      recommendations.push('Force in-app payment only and block direct transfer hints.');
      recommendations.push('Require secondary verification (OTP/PIN + identity check).');
    } else if (risk_score >= 35 || tracking.eta_minutes > 30 || partnerToPickup > 10) {
      severity = 'medium';
      recommendations.push('Enable extra monitoring and re-check pickup code.');
      recommendations.push('Ask both parties to confirm in-app milestones.');
      recommendations.push('Auto-alert support if route deviation exceeds threshold.');
    } else {
      recommendations.push('Proceed with standard dispatch controls.');
      recommendations.push('Keep masked contact and in-app communication.');
      recommendations.push('Record proof-of-pickup and proof-of-delivery events.');
    }

    if (service === 'food' || service === 'mart') {
      recommendations.push('Require merchant handoff proof and delivery photo.');
    }
    if (service === 'ride' || service === 'car' || service === 'send') {
      recommendations.push('Enforce pickup and dropoff PIN validation.');
    }

    const summary =
      severity === 'high'
        ? 'High-risk trip pattern detected. Dispatch should be gated by manual verification.'
        : severity === 'medium'
          ? 'Moderate risk detected. Continue with stricter runtime checks.'
          : 'Route pattern looks normal. Continue with standard secure flow.';

    return NextResponse.json(
      {
        data: {
          severity,
          summary,
          checks,
          recommendations,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_AI_GUARD_ERROR]', error);
    return NextResponse.json({ error: 'AI guard unavailable' }, { status: 500 });
  }
}
