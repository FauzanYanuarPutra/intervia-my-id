import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL_VERIFY_TOKEN = process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN;

function verificationRequest(token: string, host = 'localhost') {
  const url = new URL(`http://${host}/api/webhooks/whatsapp-meta`);
  url.searchParams.set('hub.mode', 'subscribe');
  url.searchParams.set('hub.verify_token', token);
  url.searchParams.set('hub.challenge', 'challenge-ok');
  return new NextRequest(url);
}

async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

afterEach(() => {
  if (ORIGINAL_VERIFY_TOKEN === undefined) {
    delete process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN;
  } else {
    process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN = ORIGINAL_VERIFY_TOKEN;
  }
  vi.resetModules();
});

describe('WhatsApp Meta webhook verification', () => {
  it('fails closed with service unavailable when no verification token is configured', async () => {
    delete process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN;
    const { GET } = await loadRoute();

    const response = await GET(verificationRequest('any-token'));

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('not configured');
  });

  it('accepts only the configured verification token', async () => {
    process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN = 'configured-test-token';
    const { GET } = await loadRoute();

    const accepted = await GET(
      verificationRequest('configured-test-token', 'lajukan.com'),
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).toBe('challenge-ok');

    const rejected = await GET(
      verificationRequest('lajukan-dev-whatsapp-meta-webhook', 'lajukan.com'),
    );
    expect(rejected.status).toBe(403);
  });
});
