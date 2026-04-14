const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_DEV = APP_ENV === 'development';

// For production, you can use:
// - Twilio (has free trial)
// - Vonage/Nexmo
// - AWS SNS
// - MessageBird

export async function sendOTPSMS(phone: string, otp: string): Promise<boolean> {
  try {
    if (IS_DEV) {
      // In development, just log to console
      console.log('\n📱 ========== SMS OTP ==========');
      console.log(`To: ${phone}`);
      console.log(`OTP Code: ${otp}`);
      console.log('================================\n');
      return true;
    }

    // Production: Use Twilio or other SMS provider
    const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            To: phone.startsWith('+') ? phone : `+${phone}`,
            From: TWILIO_PHONE,
            Body: `Your Lajukan verification code is: ${otp}. Valid for 5 minutes.`,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Twilio error:', error);
        return false;
      }

      return true;
    }

    // Fallback: log to console if no SMS provider configured
    console.log(`[SMS] Would send OTP ${otp} to ${phone}`);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}
