import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaptchaToken } from '@/lib/captcha';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { requireAuth } from '@/lib/serverAuth';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

const SupportTicketCreateSchema = z.object({
  requester_email: z.preprocess(
    (value) => String(value ?? '').trim().toLowerCase(),
    z.string().email(),
  ),
  requester_name: z.preprocess(
    (value) => {
      if (value == null) return undefined;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().min(1).max(120).optional(),
  ),
  category: z.string().min(2).max(40),
  subject: z.string().min(5).max(180),
  message: z.string().min(5).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  source: z.string().min(2).max(60).optional(),
  captcha_token: z.string().min(8).optional(),
  captchaToken: z.string().min(8).optional(),
}).passthrough();

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }
  return req.cookies.get('access_token')?.value || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const qs = req.nextUrl.searchParams.toString();
    const url = qs
      ? `${MARKETPLACE_URL}/v1/support/tickets?${qs}`
      : `${MARKETPLACE_URL}/v1/support/tickets`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[SUPPORT_TICKETS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBodyWithSchema(req, SupportTicketCreateSchema);
    if (!parsed.ok) return parsed.response;

    const body = parsed.data;
    const ip = getClientIp(req);

    const rlIp = await enforceRateLimit({
      key: `support:create:ip:${ip}`,
      limit: 40,
      windowSeconds: 3600,
    });
    if (!rlIp.ok) return rlIp.response;

    const rlEmail = await enforceRateLimit({
      key: `support:create:email:${body.requester_email}`,
      limit: 20,
      windowSeconds: 3600,
    });
    if (!rlEmail.ok) return rlEmail.response;

    const safety = evaluateTrustSafety(`${body.subject}\n${body.message}`, {
      maxLength: 5400,
      allowExternalLinks: false,
      enforceOffPlatformPayment: true,
    });
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: 'Ticket blocked by trust safety policy',
          violations: safety.violations.map((item) => item.code),
        },
        { status: 422 },
      );
    }

    const auth = await requireAuth(req);
    const isAuthenticated = auth.ok;

    if (!isAuthenticated) {
      const captcha = await verifyCaptchaToken({
        token: body.captcha_token || body.captchaToken,
        ip,
        action: 'support',
      });
      if (!captcha.ok) {
        return NextResponse.json({ error: captcha.error }, { status: 400 });
      }
    }

    const token = isAuthenticated ? auth.ctx.token : getBearerToken(req);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const { captcha_token, captchaToken, ...forwardPayload } = body;

    const res = await fetch(`${MARKETPLACE_URL}/v1/support/tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(forwardPayload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[SUPPORT_TICKETS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
