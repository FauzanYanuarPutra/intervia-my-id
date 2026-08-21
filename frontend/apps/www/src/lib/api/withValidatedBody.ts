import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { errorResponse } from '@/lib/api/errorResponse';

export async function withValidatedBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const parsed = await parseJsonBodyWithSchema(req, schema);
  if (!parsed.ok) {
    return {
      ok: false,
      response: errorResponse(400, 'Invalid request body'),
    };
  }
  return { ok: true, data: parsed.data };
}
