import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';

const AI_URL = process.env.INTERNAL_AI_URL || 'http://ai_service:8080';

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'face-recognition',
      ipLimit: 120,
      deviceLimit: 80,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Multipart form-data with ktp and selfie files is required' },
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form-data payload' }, { status: 400 });
    }

    const ktp = formData.get('ktp');
    const selfie = formData.get('selfie');
    if (!(ktp instanceof File) || !(selfie instanceof File)) {
      return NextResponse.json(
        { error: 'Both ktp and selfie files are required' },
        { status: 400 },
      );
    }

    const res = await fetch(`${AI_URL}/v1/verify`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}

