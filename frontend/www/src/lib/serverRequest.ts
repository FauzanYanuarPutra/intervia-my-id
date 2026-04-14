import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';

const DEFAULT_MAX_JSON_BODY_BYTES = 1024 * 1024;

function safePreview(raw: string, maxLen = 200) {
  const trimmed = raw.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}...` : trimmed;
}

function getMaxJsonBodyBytes(): number {
  const envRaw = process.env.MAX_JSON_BODY_BYTES || '';
  const parsed = Number.parseInt(envRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_JSON_BODY_BYTES;
  }
  return Math.max(1024, parsed);
}

export async function parseJsonBody(req: NextRequest): Promise<
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse }
> {
  let raw = '';

  try {
    raw = await req.text();

    if (!raw) {
      return { ok: true, data: null };
    }

    if (raw.length > getMaxJsonBodyBytes()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 },
        ),
      };
    }

    let jsonText = raw.trim();

    if (jsonText.charCodeAt(0) === 0xfeff) {
      jsonText = jsonText.slice(1);
    }

    if (
      (jsonText.startsWith("'") && jsonText.endsWith("'")) ||
      (jsonText.startsWith('"') && jsonText.endsWith('"'))
    ) {
      jsonText = jsonText.slice(1, -1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
    } catch {
      if (jsonText.includes('\\"')) {
        const deEscaped = jsonText.replace(/\\"/g, '"');
        parsed = JSON.parse(deEscaped);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
      } else {
        throw new Error('Invalid JSON');
      }
    }

    return { ok: true, data: parsed };
  } catch (e) {
    console.error('Invalid JSON body', {
      error: e instanceof Error ? e.message : String(e),
      preview: safePreview(raw),
      length: raw.length,
    });

    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

export async function parseJsonBodyWithSchema<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }
> {
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed;

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
    };
  }

  return { ok: true, data: result.data };
}
