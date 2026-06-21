import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  authSecurityHeaders,
  enforceAuthRouteSecurity,
} from '@/lib/authSecurity';
import { requireAuth } from '@/lib/serverAuth';
import {
  type IdentityVerificationRecord,
  maxKycStatus,
  normalizeKycStatus,
  readBoolean,
  readIdentityVerification,
  readNumber,
  readString,
  readStringArray,
} from '@/lib/identityVerification';
import { fetchWithTimeout } from '@/lib/server/fetchWithTimeout';
import { validateUploadCandidate } from '@/lib/server/uploadFiles';
import { IMAGE_UPLOAD_RAW_MAX_BYTES } from '@/lib/media/uploadStandard';

const AI_URL = process.env.INTERNAL_AI_URL || 'http://ai_service:8080';
const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function maskNik(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return '*'.repeat(digits.length || 4);
  return `${digits.slice(0, 4)}********${digits.slice(-4)}`;
}

function hashNik(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  return crypto.createHash('sha256').update(digits).digest('hex');
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function isApproved(
  record: Pick<IdentityVerificationRecord, 'status' | 'kyc_status'> | null,
) {
  if (!record) return false;
  return (
    record.status === 'approved' ||
    record.kyc_status === 'full' ||
    record.kyc_status === 'enhanced'
  );
}

function buildStoredVerificationRecord(
  payload: Record<string, unknown>,
): IdentityVerificationRecord {
  const document = (payload.document || payload.ocr_data || {}) as Record<
    string,
    unknown
  >;
  const verification = (payload.verification || {}) as Record<string, unknown>;
  const checks = (payload.checks || {}) as Record<string, unknown>;
  const liveness = (payload.liveness || {}) as Record<string, unknown>;

  const nik =
    readString(document.nik) ||
    readString(document.NIK) ||
    readString(document.nik_number);
  const documentName =
    readString(document.nama) ||
    readString(document.name) ||
    readString(document.full_name);
  const fieldsPresent = dedupeStrings([
    readBoolean(checks.nik_detected) ? 'nik' : '',
    readBoolean(checks.name_detected) ? 'nama' : '',
    readBoolean(checks.address_detected) ? 'alamat' : '',
    readBoolean(checks.birth_details_detected) ? 'ttl' : '',
  ]);

  const verifiedAt = new Date().toISOString();
  const status = readString(verification.status) || 'manual_review';
  const kycStatus = normalizeKycStatus(verification.kyc_status);

  return {
    status,
    email_verified: false,
    phone_verified: false,
    document_type: readString(verification.document_type) || 'ktp',
    document_country: readString(verification.document_country) || 'ID',
    document_verified: readBoolean(verification.document_verified),
    liveness_verified: readBoolean(verification.liveness_verified),
    identity_verified: readBoolean(verification.identity_verified),
    transaction_eligible:
      readBoolean(verification.transaction_eligible) ||
      readBoolean(verification.identity_verified),
    kyc_status: kycStatus,
    capture_quality: readString(verification.capture_quality),
    trust_score: readNumber(verification.trust_score),
    review_recommendation:
      readString(verification.review_recommendation) || 'manual_review',
    verified_at: verifiedAt,
    last_attempt_at: verifiedAt,
    last_attempt_status: status,
    document_name: documentName,
    nik_masked: maskNik(nik),
    nik_last4: nik ? nik.replace(/\D/g, '').slice(-4) : undefined,
    nik_hash: hashNik(nik),
    liveness_score: readNumber(liveness.liveness_score),
    face_coverage: readNumber(
      (liveness.metadata as Record<string, unknown> | undefined)?.face_coverage,
    ),
    fields_present: fieldsPresent,
    risk_flags: readStringArray(verification.risk_flags),
    use_cases: readStringArray(verification.use_cases),
    benefits: readStringArray(verification.benefits),
  };
}

function mergeVerificationRecord(
  existing: IdentityVerificationRecord | null,
  next: IdentityVerificationRecord,
): IdentityVerificationRecord {
  if (!existing) return next;

  const existingApproved = isApproved(existing);
  const nextApproved = isApproved(next);
  const mergedKyc = maxKycStatus(existing.kyc_status, next.kyc_status);
  const fieldsPresent = dedupeStrings([
    ...existing.fields_present,
    ...next.fields_present,
  ]);
  const useCases = dedupeStrings([...existing.use_cases, ...next.use_cases]);
  const benefits = dedupeStrings([...existing.benefits, ...next.benefits]);
  const riskFlags = dedupeStrings(
    next.risk_flags.length > 0 ? next.risk_flags : existing.risk_flags,
  );

  if (existingApproved && !nextApproved) {
    return {
      ...existing,
      email_verified: existing.email_verified || next.email_verified,
      phone_verified: existing.phone_verified || next.phone_verified,
      document_verified: existing.document_verified || next.document_verified,
      liveness_verified: existing.liveness_verified || next.liveness_verified,
      identity_verified: existing.identity_verified || next.identity_verified,
      transaction_eligible:
        existing.transaction_eligible || next.transaction_eligible,
      kyc_status: mergedKyc,
      last_attempt_at: next.last_attempt_at || next.verified_at,
      last_attempt_status: next.status,
      review_recommendation:
        next.review_recommendation || existing.review_recommendation,
      risk_flags: riskFlags,
      fields_present: fieldsPresent,
      use_cases: useCases,
      benefits,
    };
  }

  return {
    ...existing,
    ...next,
    status: nextApproved ? 'approved' : next.status,
    email_verified: existing.email_verified || next.email_verified,
    phone_verified: existing.phone_verified || next.phone_verified,
    document_verified: existing.document_verified || next.document_verified,
    liveness_verified: existing.liveness_verified || next.liveness_verified,
    identity_verified: existing.identity_verified || next.identity_verified,
    transaction_eligible:
      existing.transaction_eligible || next.transaction_eligible,
    kyc_status: mergedKyc,
    trust_score:
      Math.max(existing.trust_score || 0, next.trust_score || 0) || undefined,
    verified_at: nextApproved
      ? next.verified_at
      : existing.verified_at || next.verified_at,
    last_attempt_at: next.last_attempt_at || next.verified_at,
    last_attempt_status: next.status,
    fields_present: fieldsPresent,
    risk_flags: riskFlags,
    use_cases: useCases,
    benefits,
  };
}

function buildDocumentPreview(payload: Record<string, unknown>) {
  const document = (payload.document || payload.ocr_data || {}) as Record<
    string,
    unknown
  >;
  const nik =
    readString(document.nik) ||
    readString(document.NIK) ||
    readString(document.nik_number);

  return {
    document_type: readString(document.document_type) || 'ktp',
    document_country: readString(document.document_country) || 'ID',
    document_name:
      readString(document.nama) ||
      readString(document.name) ||
      readString(document.full_name),
    nik_masked: maskNik(nik),
    ttl:
      readString(document.ttl) ||
      readString(document.tempat_tanggal_lahir) ||
      readString(document.date_of_birth),
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'identity-verification',
      ipLimit: 40,
      deviceLimit: 24,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Multipart form-data with ktp and selfie files is required' },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const ktp = formData.get('ktp');
    const selfie = formData.get('selfie');

    if (!(ktp instanceof File) || !(selfie instanceof File)) {
      return NextResponse.json(
        { error: 'Both ktp and selfie files are required' },
        { status: 400 },
      );
    }

    const ktpError = validateUploadCandidate(ktp, {
      accept: 'image',
      maxBytes: IMAGE_UPLOAD_RAW_MAX_BYTES,
    });
    const selfieError = validateUploadCandidate(selfie, {
      accept: 'image',
      maxBytes: IMAGE_UPLOAD_RAW_MAX_BYTES,
    });
    if (ktpError || selfieError) {
      return NextResponse.json(
        {
          error: ktpError
            ? `KTP ${ktpError}`
            : `Selfie ${selfieError || 'file is invalid'}`,
        },
        {
          status:
            ktpError?.includes('too large') ||
            selfieError?.includes('too large')
              ? 413
              : 400,
        },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.set('ktp', ktp);
    upstreamForm.set('selfie', selfie);

    const aiRes = await fetchWithTimeout(
      `${AI_URL}/v1/verify`,
      {
        method: 'POST',
        body: upstreamForm,
        cache: 'no-store',
      },
      25000,
    );
    const aiPayload = (await aiRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!aiRes.ok) {
      return NextResponse.json(
        {
          error:
            readString(aiPayload.message) || 'Identity verification failed',
        },
        { status: aiRes.status },
      );
    }

    const currentProfileRes = await fetchWithTimeout(
      `${API_URL}/users/me`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          ...authSecurityHeaders(security),
        },
        cache: 'no-store',
      },
      10000,
    );
    const currentProfile = (await currentProfileRes
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const currentVerification = readIdentityVerification(
      currentProfile.verification || currentProfile.metadata,
    );

    const nextVerification = buildStoredVerificationRecord(aiPayload);
    const mergedVerification = mergeVerificationRecord(
      currentVerification,
      nextVerification,
    );

    const persistRes = await fetchWithTimeout(
      `${API_URL}/users/me`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
          ...authSecurityHeaders(security),
        },
        body: JSON.stringify({
          verification: mergedVerification,
        }),
        cache: 'no-store',
      },
      10000,
    );
    const persistedProfile = (await persistRes
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    if (!persistRes.ok) {
      return NextResponse.json(
        {
          error:
            readString(persistedProfile.error) ||
            'Failed to persist identity verification',
        },
        { status: persistRes.status },
      );
    }

    return NextResponse.json(
      {
        message:
          readString(aiPayload.message) ||
          'Identity verification summary saved',
        verification: mergedVerification,
        ai: {
          checks: aiPayload.checks || {},
          verification: aiPayload.verification || {},
          liveness: aiPayload.liveness || {},
          document_preview: buildDocumentPreview(aiPayload),
        },
        profile: persistedProfile,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[IDENTITY_VERIFICATION_ERROR]', error);
    return NextResponse.json(
      { error: 'Identity verification service unavailable' },
      { status: 503 },
    );
  }
}
