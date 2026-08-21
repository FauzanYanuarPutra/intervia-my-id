import { URLSearchParams } from 'url';

type CaptchaProvider = 'turnstile' | 'hcaptcha';

export async function verifyCaptchaToken(opts: {
  token?: string | null;
  ip?: string;
  action: 'register' | 'support' | 'other';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider =
    (process.env.CAPTCHA_PROVIDER?.toLowerCase() as CaptchaProvider | undefined) ||
    'turnstile';

  const token = opts.token?.trim();
  const secret =
    provider === 'hcaptcha'
      ? process.env.HCAPTCHA_SECRET_KEY
      : process.env.TURNSTILE_SECRET_KEY;

  const runtimeEnv = (
    process.env.ENV ||
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NODE_ENV ||
    'development'
  ).toLowerCase();
  const isProd = runtimeEnv === 'production';

  // Dev-friendly: bypass when secret is not configured.
  if (!secret) {
    if (isProd) {
      return { ok: false, error: 'Captcha secret is not configured in production.' };
    }
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: 'Captcha token is required.' };
  }

  const endpoint =
    provider === 'hcaptcha'
      ? 'https://hcaptcha.com/siteverify'
      : 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (opts.ip) {
    form.set('remoteip', opts.ip);
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      'error-codes'?: string[];
      action?: string;
    };

    if (!res.ok || !data.success) {
      const reason = Array.isArray(data['error-codes'])
        ? data['error-codes'].join(', ')
        : 'verification_failed';
      return { ok: false, error: `Captcha verification failed: ${reason}` };
    }

    if (provider === 'turnstile' && data.action && data.action !== opts.action) {
      return { ok: false, error: 'Captcha action mismatch.' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Captcha service unavailable: ${(error as Error)?.message || 'unknown_error'}`,
    };
  }
}
