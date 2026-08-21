export type TrustSafetyCode =
  | 'fraud_or_scam'
  | 'violence_or_threat'
  | 'weapon_instruction'
  | 'extortion'
  | 'off_platform_payment'
  | 'suspicious_link'
  | 'oversized_content';

export type TrustSafetyViolation = {
  code: TrustSafetyCode;
  message: string;
};

export type TrustSafetyResult =
  | { ok: true; sanitizedText: string }
  | { ok: false; sanitizedText: string; violations: TrustSafetyViolation[] };

export type TrustSafetyOptions = {
  maxLength?: number;
  allowExternalLinks?: boolean;
  enforceOffPlatformPayment?: boolean;
};

const FRAUD_KEYWORDS = [
  /\botp\b/i,
  /\bkode verifikasi\b/i,
  /\bverification code\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /\bbiaya admin\b/i,
  /\badmin fee\b/i,
  /\bdeposit\b/i,
  /\btransfer\b/i,
  /\bcrypto\b/i,
  /\busdt\b/i,
  /\bbitcoin\b/i,
  /\bgift card\b/i,
  /\bescrow di luar\b/i,
  /\boutside platform\b/i,
];

const URGENCY_KEYWORDS = [
  /\burgent\b/i,
  /\bimmediately\b/i,
  /\bnow\b/i,
  /\bsegera\b/i,
  /\bsekarang\b/i,
  /\bcepat\b/i,
];

const VIOLENCE_KEYWORDS = [
  /\bkill\b/i,
  /\bmurder\b/i,
  /\bassassin\b/i,
  /\bbunuh\b/i,
  /\btembak\b/i,
  /\btikam\b/i,
  /\bledak\b/i,
  /\bbomb\b/i,
  /\bracun\b/i,
];

const EXTORTION_KEYWORDS = [
  /\bextort\b/i,
  /\bblackmail\b/i,
  /\bransom\b/i,
  /\btebusan\b/i,
  /\bperas\b/i,
  /\bancam\b/i,
];

const WEAPON_INSTRUCTION_PATTERNS = [
  /\b(cara|how to|tutorial|langkah|build|buat|merakit)\b[\s\S]{0,40}\b(bom|senjata|weapon|pistol|explosive)\b/i,
  /\b(bom|senjata|weapon|explosive)\b[\s\S]{0,40}\b(cara|how to|tutorial|langkah|build|buat|merakit)\b/i,
];

const SHORTENER_LINK_PATTERNS = [
  /\bbit\.ly\b/i,
  /\btinyurl\.com\b/i,
  /\bcutt\.ly\b/i,
  /\brb\.gy\b/i,
  /\bt\.co\b/i,
];

const URL_PATTERN = /https?:\/\/[^\s/$.?#].[^\s]*/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s\-()]{7,}\d)/i;
const PAYMENT_KEYWORDS = [
  /\btransfer\b/i,
  /\bbank\b/i,
  /\brekening\b/i,
  /\bwallet\b/i,
  /\bcrypto\b/i,
  /\busdt\b/i,
  /\bbitcoin\b/i,
  /\bdeposit\b/i,
  /\bdp\b/i,
  /\bdown payment\b/i,
];
const OTP_SHARE_PATTERN =
  /\b(send|share|kirim|bagikan)\b[\s\S]{0,24}\b(otp|kode verifikasi|password|pin)\b|\b(otp|kode verifikasi|password|pin)\b[\s\S]{0,24}\b(send|share|kirim|bagikan)\b/i;

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  const normalized = input
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  return normalized.slice(0, Math.max(1, maxLength));
}

function hasContactInfo(text: string): boolean {
  return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text) || /\b(wa\.me|t\.me|telegram|whatsapp)\b/i.test(text);
}

function hasPaymentSignal(text: string): boolean {
  return matchAny(text, PAYMENT_KEYWORDS);
}

export function evaluateTrustSafety(
  input: unknown,
  options?: TrustSafetyOptions,
): TrustSafetyResult {
  const maxLength = Math.max(100, options?.maxLength ?? 6000);
  const allowExternalLinks = options?.allowExternalLinks === true;
  const enforceOffPlatformPayment = options?.enforceOffPlatformPayment !== false;
  const sanitizedText = sanitizeText(input, maxLength);

  if (!sanitizedText) {
    return { ok: true, sanitizedText };
  }

  const violations: TrustSafetyViolation[] = [];
  const hasContact = hasContactInfo(sanitizedText);
  const hasPayment = hasPaymentSignal(sanitizedText);
  const hasUrgency = matchAny(sanitizedText, URGENCY_KEYWORDS);
  const hasFraudKeyword = matchAny(sanitizedText, FRAUD_KEYWORDS);
  const hasViolence = matchAny(sanitizedText, VIOLENCE_KEYWORDS);
  const hasExtortion = matchAny(sanitizedText, EXTORTION_KEYWORDS);
  const hasWeaponInstruction = matchAny(sanitizedText, WEAPON_INSTRUCTION_PATTERNS);

  if (typeof input === 'string' && input.length > maxLength) {
    violations.push({
      code: 'oversized_content',
      message: 'Content exceeds safety size limit.',
    });
  }

  if (hasViolence) {
    violations.push({
      code: 'violence_or_threat',
      message: 'Detected violent or threatening language.',
    });
  }

  if (hasExtortion) {
    violations.push({
      code: 'extortion',
      message: 'Detected extortion or coercion patterns.',
    });
  }

  if (hasWeaponInstruction) {
    violations.push({
      code: 'weapon_instruction',
      message: 'Detected possible weapon instruction pattern.',
    });
  }

  const scamDetected =
    OTP_SHARE_PATTERN.test(sanitizedText) ||
    (hasFraudKeyword && (hasContact || hasPayment || hasUrgency)) ||
    (hasContact && hasPayment && hasUrgency);

  if (scamDetected) {
    violations.push({
      code: 'fraud_or_scam',
      message: 'Detected scam or fraud social-engineering pattern.',
    });
  }

  if (enforceOffPlatformPayment && hasContact && hasPayment) {
    violations.push({
      code: 'off_platform_payment',
      message: 'Detected off-platform payment coordination pattern.',
    });
  }

  if (!allowExternalLinks && URL_PATTERN.test(sanitizedText) && matchAny(sanitizedText, SHORTENER_LINK_PATTERNS)) {
    violations.push({
      code: 'suspicious_link',
      message: 'Detected suspicious shortened link.',
    });
  }

  const uniqueViolations = Array.from(
    new Map(violations.map((item) => [item.code, item])).values(),
  );

  if (uniqueViolations.length > 0) {
    return { ok: false, sanitizedText, violations: uniqueViolations };
  }

  return { ok: true, sanitizedText };
}
