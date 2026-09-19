import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFromCookieHeader } from '@/lib/sessionProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getWwwTargets(): string[] {
  const values = [
    process.env.INTERNAL_WWW_URL,
    process.env.WWW_URL,
    process.env.NEXT_PUBLIC_WWW_URL,
    'http://www:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.trim().replace(/\/+$/, ''));
  return Array.from(new Set(values));
}

export async function POST(req: NextRequest) {
  const cookieToken = accessTokenFromCookieHeader(req.headers.get('cookie'));
  const authorization = req.headers.get('authorization');
  const token = cookieToken || (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form' }, { status: 400 });
  }

  const headers = new Headers();
  headers.set('Authorization', 'Bearer ' + token);
  for (const key of ['user-agent', 'x-forwarded-for', 'x-real-ip', 'x-device-id']) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  const errors: string[] = [];
  for (const base of getWwwTargets()) {
    try {
      const upstream = await fetch(base + '/api/content/upload-images', {
        method: 'POST',
        headers,
        body: form,
        cache: 'no-store',
      });
      const payload = await upstream.text();
      return new NextResponse(payload, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.error('[CMS_CONTENT_UPLOAD_PROXY_ERROR]', { errors });
  return NextResponse.json({ error: 'Upload service unavailable' }, { status: 503 });
}
