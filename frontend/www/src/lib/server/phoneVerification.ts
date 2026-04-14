import { NextResponse } from 'next/server';
import {
  PHONE_VERIFICATION_SETTINGS_PATH,
  readPhoneVerifiedStatus,
} from '@/lib/identityVerification';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';

type PhoneVerificationGuardResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.trim() || 'Invalid JSON response' };
  }
}

export async function requirePhoneVerifiedForListing(
  token: string,
): Promise<PhoneVerificationGuardResult> {
  try {
    const upstream = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    const payload = await readJson(upstream);

    if (!upstream.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Unable to verify account phone status',
            code: 'verification_service_unavailable',
          },
          { status: 503 },
        ),
      };
    }

    if (!readPhoneVerifiedStatus(payload)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              'Phone verification required before creating or publishing a listing',
            code: 'phone_verification_required',
            next_step: PHONE_VERIFICATION_SETTINGS_PATH,
          },
          { status: 403 },
        ),
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Unable to verify account phone status',
          code: 'verification_service_unavailable',
        },
        { status: 503 },
      ),
    };
  }
}
