export type WhatsAppMetaVerificationEnv = {
  ENV?: string;
  APP_ENV?: string;
  NODE_ENV?: string;
  WHATSAPP_META_WEBHOOK_VERIFY_TOKEN?: string;
  WHATSAPP_META_WEBHOOK_VERIFY_TOKEN_REQUIRED?: string;
};

function isTrue(value: string | undefined): boolean {
  return /^true$/i.test((value ?? '').trim());
}

export function getWhatsAppMetaVerificationConfig(
  env: WhatsAppMetaVerificationEnv = process.env,
  requireForRequest = false,
) {
  const appEnv = env.ENV || env.APP_ENV || env.NODE_ENV;
  const token = env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN?.trim() || null;
  const required =
    requireForRequest ||
    appEnv === 'production' ||
    isTrue(env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN_REQUIRED);

  return { token, required };
}
