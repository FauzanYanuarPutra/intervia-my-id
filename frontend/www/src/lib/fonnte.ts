import {
  allowSensitiveDevelopmentLogs,
  maskPhone,
  safeErrorCode,
} from '@/lib/server/safeLog';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_DEV = APP_ENV === 'development';
const FONNTE_TOKEN = (process.env.FONNTE_TOKEN || '').trim();
const FONNTE_API_URL = (
  process.env.FONNTE_API_URL || 'https://api.fonnte.com/send'
).trim();
const FONNTE_COUNTRY_CODE = (process.env.FONNTE_COUNTRY_CODE || '62').trim();
const FONNTE_DEFAULT_SENDER = (
  process.env.FONNTE_DEFAULT_SENDER || 'Lajukan'
).trim();

function normalizePhoneTarget(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function buildOtpMessage(otp: string): string {
  return [
    `Kode verifikasi Lajukan: ${otp}`,
    '',
    'Kode ini berlaku 5 menit.',
    'Jangan bagikan ke siapa pun, termasuk tim Lajukan.',
  ].join('\n');
}

function buildWebhookMeta(target: string) {
  return {
    target: maskPhone(target),
    source: 'fonnte',
    app: 'lajukan-www',
  };
}

export function getFonnteConfigured(): boolean {
  return FONNTE_TOKEN.length > 0;
}

export async function sendOtpViaFonnteWhatsApp(
  phone: string,
  otp: string,
): Promise<boolean> {
  const target = normalizePhoneTarget(phone);
  if (!target) return false;

  if (!getFonnteConfigured()) {
    if (allowSensitiveDevelopmentLogs()) {
      console.log('[Fonnte] token not configured, skipping WhatsApp delivery', {
        ...buildWebhookMeta(target),
        otp,
      });
      return true;
    }
    return false;
  }

  try {
    const formData = new FormData();
    formData.set('target', target);
    formData.set('message', buildOtpMessage(otp));
    formData.set('delay', '0');
    formData.set('countryCode', FONNTE_COUNTRY_CODE);
    formData.set('typing', 'false');
    formData.set('preview', 'false');
    formData.set('sequence', 'true');
    formData.set('sender', FONNTE_DEFAULT_SENDER);

    const response = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: FONNTE_TOKEN,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('Fonnte OTP delivery failed', {
        ...buildWebhookMeta(target),
        status: response.status,
      });
      return false;
    }

    const result = (await response.json().catch(() => null)) as
      | { status?: boolean; detail?: string; reason?: string }
      | null;

    if (result?.status === false) {
      console.error('Fonnte OTP delivery rejected', {
        ...buildWebhookMeta(target),
        reason: result.reason || result.detail || 'provider_rejected',
      });
      return false;
    }

    if (IS_DEV) {
      console.log('[Fonnte] OTP sent', {
        ...buildWebhookMeta(target),
        accepted: true,
      });
    }

    return true;
  } catch (error) {
    console.error('Fonnte OTP delivery error', {
      ...buildWebhookMeta(target),
      error: safeErrorCode(error),
    });
    return false;
  }
}

export type FonnteWebhookEvent = {
  device?: string;
  sender?: string;
  message?: string;
  text?: string;
  member?: string;
  name?: string;
  location?: string;
  url?: string;
  filename?: string;
  extension?: string;
  status?: string;
  timestamp?: string | number;
  reason?: string;
  inboxid?: string | number;
  [key: string]: unknown;
};
