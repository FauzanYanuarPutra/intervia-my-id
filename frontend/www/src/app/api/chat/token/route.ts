import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    // Chat service already validates the same JWT secret, so reuse current access token.
    return NextResponse.json(
      {
        token: auth.ctx.token,
        token_type: 'Bearer',
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to issue chat token' }, { status: 503 });
  }
}
