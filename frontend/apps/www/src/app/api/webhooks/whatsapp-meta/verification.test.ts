import { describe, expect, it } from 'vitest';

import { getWhatsAppMetaVerificationConfig } from './verification';

describe('WhatsApp Meta webhook verification config', () => {
  it('requires a token in production and never invents a fallback', () => {
    expect(
      getWhatsAppMetaVerificationConfig({
        NODE_ENV: 'production',
      }),
    ).toEqual({ token: null, required: true });
  });

  it('uses only the configured token', () => {
    expect(
      getWhatsAppMetaVerificationConfig({
        NODE_ENV: 'production',
        WHATSAPP_META_WEBHOOK_VERIFY_TOKEN: 'configured-token',
      }),
    ).toEqual({ token: 'configured-token', required: true });
  });

  it('requires a token in local development so public dev tunnels cannot bypass verification', () => {
    expect(
      getWhatsAppMetaVerificationConfig({
        NODE_ENV: 'development',
      }),
    ).toEqual({ token: null, required: true });
  });

  it('keeps verification required when a public request forces it', () => {
    expect(
      getWhatsAppMetaVerificationConfig(
        {
          NODE_ENV: 'development',
        },
        true,
      ),
    ).toEqual({ token: null, required: true });
  });

  it('does not allow an environment setting to disable the webhook verify token', () => {
    expect(
      getWhatsAppMetaVerificationConfig({
        NODE_ENV: 'development',
        WHATSAPP_META_WEBHOOK_VERIFY_TOKEN_REQUIRED: 'false',
      }),
    ).toEqual({ token: null, required: true });
  });

  it('treats a blank configured token as missing', () => {
    expect(
      getWhatsAppMetaVerificationConfig({
        NODE_ENV: 'production',
        WHATSAPP_META_WEBHOOK_VERIFY_TOKEN: '   ',
      }),
    ).toEqual({ token: null, required: true });
  });
});
