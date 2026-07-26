import 'server-only';

import type { NextRequest } from 'next/server';

export function getInternalWwwOrigin(req: NextRequest): string {
  const configured = process.env.INTERNAL_WWW_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const port = process.env.PORT?.trim();
  if (process.env.NODE_ENV === 'production' && port) {
    return `http://127.0.0.1:${port}`;
  }

  return req.nextUrl.origin;
}
