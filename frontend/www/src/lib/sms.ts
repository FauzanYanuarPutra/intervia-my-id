import {
  getFonnteConfigured,
  sendOtpViaFonnteWhatsApp,
} from '@/lib/fonnte';
import {
  getWhatsAppMetaConfigured,
  sendOtpViaWhatsAppMeta,
} from '@/lib/whatsappMeta';
import {
  allowSensitiveDevelopmentLogs,
  maskPhone,
  safeErrorCode,
} from '@/lib/server/safeLog';

export type PhoneOtpDeliveryResult = {
  ok: boolean;
  delivery:
    | 'whatsapp_meta'
    | 'whatsapp_fonnte'
    | 'sms_twilio'
    | 'console'
    | 'unconfigured';
};

async function sendOtpViaTwilio(
  phone: string,
  otp: string,
): Promise<boolean> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioPhone) return false;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        To: phone.startsWith('+') ? phone : `+${phone}`,
        From: twilioPhone,
        Body: `Kode verifikasi Lajukan: ${otp}. Berlaku 5 menit.`,
      }),
    },
  );

  if (!response.ok) {
    console.error('Twilio OTP delivery failed', { status: response.status });
    return false;
  }

  return true;
}

export async function sendPhoneOTP(
  phone: string,
  otp: string,
): Promise<PhoneOtpDeliveryResult> {
  try {
    if (getWhatsAppMetaConfigured()) {
      const sent = await sendOtpViaWhatsAppMeta(phone, otp);
      if (sent) return { ok: true, delivery: 'whatsapp_meta' };
    }

    if (getFonnteConfigured()) {
      const sent = await sendOtpViaFonnteWhatsApp(phone, otp);
      if (sent) return { ok: true, delivery: 'whatsapp_fonnte' };
    }

    if (allowSensitiveDevelopmentLogs()) {
      console.log('\n========== PHONE OTP ==========');
      console.log(`To: ${maskPhone(phone)}`);
      console.log(`OTP Code: ${otp}`);
      console.log('================================\n');
      return { ok: true, delivery: 'console' };
    }

    const sentViaTwilio = await sendOtpViaTwilio(phone, otp);
    if (sentViaTwilio) {
      return { ok: true, delivery: 'sms_twilio' };
    }

    console.error('No phone OTP provider configured');
    return { ok: false, delivery: 'unconfigured' };
  } catch (error) {
    console.error('Failed to send phone OTP', {
      error: safeErrorCode(error),
    });
    return { ok: false, delivery: 'unconfigured' };
  }
}

export async function sendOTPSMS(phone: string, otp: string): Promise<boolean> {
  const result = await sendPhoneOTP(phone, otp);
  return result.ok;
}
