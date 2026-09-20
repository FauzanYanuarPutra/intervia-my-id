// Production defaults to the real product flow. Temporary promo-only mode must be
// enabled explicitly through the environment instead of being hard-coded into the app.
export const PROMO_ONLY_MODE =
  process.env.PROMO_ONLY_MODE?.trim().toLowerCase() === 'true';
export const AI_CHAT_ENABLED =
  process.env.AI_CHAT_ENABLED?.trim().toLowerCase() === 'true';
