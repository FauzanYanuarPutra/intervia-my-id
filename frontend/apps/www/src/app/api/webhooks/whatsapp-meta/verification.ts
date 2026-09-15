export type WhatsAppMetaVerificationEnv = {
  ENV?: string;
  APP_ENV?: string;
  NODE_ENV?: string;
  WHATSAPP_META_WEBHOOK_VERIFY_TOKEN?: string;
  WHATSAPP_META_WEBHOOK_VERIFY_TOKEN_REQUIRED?: string;
};

export function getWhatsAppMetaVerificationConfig(
  env: WhatsAppMetaVerificationEnv = process.env,
  _requireForRequest = true,
) {
  const token = env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN?.trim() || null;

  // Meta's webhook handshake is authenticated by the verify token. Require it
  // in every environment: development endpoints are often exposed through
  // public tunnels, so a local/dev runtime must not silently become unauthenticated.
  return { token, required: true };
}
