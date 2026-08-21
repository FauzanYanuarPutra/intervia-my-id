import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import {
  listOrderTemplates,
  saveOrderTemplate,
  type SuperAppOrderTemplate,
} from '@/lib/super-app/templates';

const TemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    return NextResponse.json({
      data: await listOrderTemplates(auth.ctx.userId),
    });
  } catch (error) {
    console.error('[SUPER_APP_TEMPLATES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-templates',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:templates:${auth.ctx.userId}:${security.ip}`,
      limit: 120,
      windowSeconds: 3600,
      message: 'Too many template updates. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, TemplateSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const input: Partial<SuperAppOrderTemplate> = {
      id: payload.id,
      name: payload.name,
      service: payload.service,
      payload: payload.payload || {},
    };

    const items = await saveOrderTemplate(auth.ctx.userId, input);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('[SUPER_APP_TEMPLATES_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
