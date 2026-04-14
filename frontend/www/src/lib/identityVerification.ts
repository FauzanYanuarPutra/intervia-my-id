export type UserKycStatus = 'none' | 'basic' | 'full' | 'enhanced';

export const PHONE_VERIFICATION_SETTINGS_PATH =
  '/profile/edit#profile-edit-identity';

export type IdentityVerificationRecord = {
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  document_type?: string;
  document_country?: string;
  document_verified: boolean;
  liveness_verified: boolean;
  identity_verified: boolean;
  transaction_eligible: boolean;
  kyc_status: UserKycStatus;
  capture_quality?: string;
  trust_score?: number;
  review_recommendation?: string;
  verified_at?: string;
  last_attempt_at?: string;
  last_attempt_status?: string;
  document_name?: string;
  nik_masked?: string;
  nik_last4?: string;
  nik_hash?: string;
  liveness_score?: number;
  face_coverage?: number;
  fields_present: string[];
  risk_flags: string[];
  use_cases: string[];
  benefits: string[];
};

export type TransactionVerificationState = {
  emailReady: boolean;
  phoneReady: boolean;
  identityReady: boolean;
  transactionEligible: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => readString(item))
    .filter((item): item is string => Boolean(item));
}

export function readPhoneVerifiedStatus(source: unknown): boolean {
  const root = asRecord(source);
  if (!root) return false;

  const verification = asRecord(root.verification);
  const metadata = asRecord(root.metadata);
  const metadataVerification = asRecord(metadata?.verification);
  const profile = asRecord(root.profile);
  const profileVerification = asRecord(profile?.verification);
  const extended = asRecord(root.extended);
  const extendedVerification = asRecord(extended?.verification);

  return (
    readBoolean(root.phoneVerified) ||
    readBoolean(root.phone_verified) ||
    readBoolean(verification?.phoneVerified) ||
    readBoolean(verification?.phone_verified) ||
    readBoolean(metadata?.phoneVerified) ||
    readBoolean(metadata?.phone_verified) ||
    readBoolean(metadataVerification?.phoneVerified) ||
    readBoolean(metadataVerification?.phone_verified) ||
    readBoolean(profileVerification?.phoneVerified) ||
    readBoolean(profileVerification?.phone_verified) ||
    readBoolean(extendedVerification?.phoneVerified) ||
    readBoolean(extendedVerification?.phone_verified)
  );
}

function hasValidPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8;
}

export function readTransactionVerification(
  candidate: unknown,
): TransactionVerificationState {
  if (!candidate || typeof candidate !== 'object') {
    return {
      emailReady: false,
      phoneReady: false,
      identityReady: false,
      transactionEligible: false,
      hasEmail: false,
      hasPhone: false,
      emailVerified: false,
      phoneVerified: false,
    };
  }

  const payload = candidate as Record<string, unknown>;
  const verificationRaw = payload.verification;
  const verification =
    verificationRaw && typeof verificationRaw === 'object'
      ? (verificationRaw as Record<string, unknown>)
      : {};

  const explicitEligible =
    verification.transaction_eligible ?? payload.transaction_eligible;
  const emailVerified = readBoolean(
    verification.email_verified ??
      payload.email_verified ??
      payload.emailVerified,
  );
  const phoneVerified = readBoolean(
    verification.phone_verified ??
      payload.phone_verified ??
      payload.phoneVerified,
  );
  const hasEmail =
    typeof payload.email === 'string' && payload.email.trim().length > 0;
  const hasPhone = hasValidPhone(payload.phone);
  const documentVerified = readBoolean(
    verification.document_verified ??
      payload.document_verified ??
      payload.documentVerified,
  );
  const livenessVerified = readBoolean(
    verification.liveness_verified ??
      payload.liveness_verified ??
      payload.livenessVerified,
  );
  const explicitIdentityVerified = readBoolean(
    verification.identity_verified ??
      payload.identity_verified ??
      payload.is_verified ??
      payload.verified,
  );
  const effectiveEmailReady = !hasEmail || emailVerified;
  const effectivePhoneReady = hasPhone && phoneVerified;
  const effectiveIdentityReady =
    explicitIdentityVerified ||
    effectivePhoneReady ||
    (documentVerified && livenessVerified);

  if (typeof explicitEligible === 'boolean') {
    return {
      emailReady: effectiveEmailReady,
      phoneReady: effectivePhoneReady,
      identityReady: effectiveIdentityReady,
      transactionEligible: explicitEligible,
      hasEmail,
      hasPhone,
      emailVerified,
      phoneVerified,
    };
  }

  return {
    emailReady: effectiveEmailReady,
    phoneReady: effectivePhoneReady,
    identityReady: effectiveIdentityReady,
    transactionEligible: effectiveIdentityReady,
    hasEmail,
    hasPhone,
    emailVerified,
    phoneVerified,
  };
}

export function normalizeKycStatus(value: unknown): UserKycStatus {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (
    normalized === 'basic' ||
    normalized === 'full' ||
    normalized === 'enhanced'
  ) {
    return normalized;
  }
  return 'none';
}

export function kycRank(status: UserKycStatus): number {
  if (status === 'enhanced') return 4;
  if (status === 'full') return 3;
  if (status === 'basic') return 2;
  return 1;
}

export function maxKycStatus(
  left: UserKycStatus,
  right: UserKycStatus,
): UserKycStatus {
  return kycRank(left) >= kycRank(right) ? left : right;
}

export function readIdentityVerification(
  metadata: unknown,
): IdentityVerificationRecord | null {
  const root = asRecord(metadata);
  const verification =
    asRecord(root?.verification) ||
    (root && (root.status || root.kyc_status || root.identity_verified)
      ? root
      : null);
  if (!verification) return null;

  return {
    status: readString(verification.status) || 'not_started',
    email_verified: readBoolean(verification.email_verified),
    phone_verified: readBoolean(verification.phone_verified),
    document_type: readString(verification.document_type),
    document_country: readString(verification.document_country),
    document_verified: readBoolean(verification.document_verified),
    liveness_verified: readBoolean(verification.liveness_verified),
    identity_verified: readBoolean(verification.identity_verified),
    transaction_eligible: readBoolean(verification.transaction_eligible),
    kyc_status: normalizeKycStatus(verification.kyc_status),
    capture_quality: readString(verification.capture_quality),
    trust_score: readNumber(verification.trust_score),
    review_recommendation: readString(verification.review_recommendation),
    verified_at: readString(verification.verified_at),
    last_attempt_at: readString(verification.last_attempt_at),
    last_attempt_status: readString(verification.last_attempt_status),
    document_name: readString(verification.document_name),
    nik_masked: readString(verification.nik_masked),
    nik_last4: readString(verification.nik_last4),
    nik_hash: readString(verification.nik_hash),
    liveness_score: readNumber(verification.liveness_score),
    face_coverage: readNumber(verification.face_coverage),
    fields_present: readStringArray(verification.fields_present),
    risk_flags: readStringArray(verification.risk_flags),
    use_cases: readStringArray(verification.use_cases),
    benefits: readStringArray(verification.benefits),
  };
}
