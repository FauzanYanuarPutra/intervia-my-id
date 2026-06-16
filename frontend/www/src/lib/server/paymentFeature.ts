import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

function envFlag(key: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env[key] || '').trim().toLowerCase(),
  );
}

export function paymentsEnabled(): boolean {
  return (
    !PROMO_ONLY_MODE ||
    envFlag('PAYMENTS_ENABLED') ||
    envFlag('WALLET_LIVE_ENABLED')
  );
}
