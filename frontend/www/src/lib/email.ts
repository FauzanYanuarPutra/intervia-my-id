import nodemailer from 'nodemailer';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_DEV = APP_ENV === 'development';
const DEV_EMAIL_FALLBACK_TO_CONSOLE =
  process.env.DEV_EMAIL_FALLBACK_TO_CONSOLE !== 'false';

function createTransport() {
  const forced = process.env.EMAIL_TRANSPORT;
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

  const isMailHog = smtpHost === 'mailhog' || smtpPort === 1025;

  if (forced === 'console') {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  if (!smtpHost) {
    console.warn('No SMTP_HOST configured, using console-only email');
    return nodemailer.createTransport({ jsonTransport: true });
  }

  if (isMailHog || (smtpUser === '' && smtpPass === '')) {
    console.log(`Using SMTP: ${smtpHost}:${smtpPort} (no auth)`);
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      ignoreTLS: true,
    });
  }

  console.log(`Using SMTP: ${smtpHost}:${smtpPort} (with auth)`);
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function createConsoleTransport() {
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransport();

async function sendMailWithDevFallback(
  options: Parameters<typeof transporter.sendMail>[0],
): Promise<boolean> {
  try {
    await transporter.sendMail(options);
    return true;
  } catch (error) {
    if (!IS_DEV || !DEV_EMAIL_FALLBACK_TO_CONSOLE) {
      console.error('Failed to send email:', error);
      return false;
    }

    console.warn(
      'Primary email transport failed in development, falling back to console transport.',
      error,
    );

    try {
      await createConsoleTransport().sendMail(options);
      return true;
    } catch (fallbackError) {
      console.error('Failed to send email with console fallback:', fallbackError);
      return false;
    }
  }
}

function getFromAddress(): string {
  return (
    process.env.SMTP_FROM ||
    (process.env.FROM_EMAIL
      ? `"${process.env.FROM_NAME || 'Lajukan'}" <${process.env.FROM_EMAIL}>`
      : '"Lajukan" <noreply@lajukan.com>')
  );
}

export async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  const sent = await sendMailWithDevFallback({
    from: getFromAddress(),
    to: email,
    subject: `Your verification code: ${otp}`,
    text: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981; margin-bottom: 20px;">Verification Code</h2>
        <p style="color: #666; margin-bottom: 20px;">Your verification code is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">${otp}</span>
        </div>
        <p style="color: #999; font-size: 12px;">This code expires in 5 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });

  if (!sent) {
    return false;
  }

  if (IS_DEV) {
    console.log('\n========== EMAIL OTP ==========');
    console.log(`To: ${email}`);
    console.log(`OTP Code: ${otp}`);
    console.log('==================================\n');
  }

  return true;
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
  const sent = await sendMailWithDevFallback({
    from: getFromAddress(),
    to: email,
    subject: 'Reset your password',
    text: `Click here to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981; margin-bottom: 20px;">Reset Password</h2>
        <p style="color: #666; margin-bottom: 20px;">Click the button below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  if (!sent) {
    return false;
  }

  if (IS_DEV) {
    console.log('\n========== PASSWORD RESET EMAIL ==========');
    console.log(`To: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('=============================================\n');
  }

  return true;
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const sent = await sendMailWithDevFallback({
    from: getFromAddress(),
    to: email,
    subject: 'Welcome to Lajukan!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981; margin-bottom: 20px;">Welcome, ${name}!</h2>
        <p style="color: #666;">Your account has been created successfully. Start exploring now!</p>
      </div>
    `,
  });

  if (!sent) {
    return false;
  }

  if (IS_DEV) {
    console.log(`\nWelcome email sent to ${email}\n`);
  }

  return true;
}
