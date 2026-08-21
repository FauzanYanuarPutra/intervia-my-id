import { NextResponse } from 'next/server';

export function errorResponse(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error, ...(extra || {}) }, { status });
}
