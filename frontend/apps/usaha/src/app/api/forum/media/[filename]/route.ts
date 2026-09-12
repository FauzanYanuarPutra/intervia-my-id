import { NextResponse } from 'next/server';

const COMMUNITY_URL =
  process.env.COMMUNITY_SERVICE_URL ||
  process.env.INTERNAL_COMMUNITY_URL ||
  'http://community_service:8082';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(filename)) {
    return NextResponse.json({ error: 'Media tidak valid.' }, { status: 400 });
  }

  try {
    const headers = new Headers({ Accept: 'image/avif,image/webp,image/png,image/jpeg' });
    const range = request.headers.get('range');
    if (range) headers.set('Range', range);
    const response = await fetch(
      `${COMMUNITY_URL}/v1/forum/media/${encodeURIComponent(filename)}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) },
    );
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set(
      'Cache-Control',
      response.ok ? 'public, max-age=31536000, immutable' : 'no-store',
    );
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: 'Media tidak tersedia.' }, { status: 503 });
  }
}
