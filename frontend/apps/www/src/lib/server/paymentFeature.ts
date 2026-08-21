function envFlag(key: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env[key] || '').trim().toLowerCase(),
  );
}

export function paymentsEnabled(): boolean {
  // Financial surfaces are fail-closed. Enabling a live wallet provider alone
  // must never make payment UI/routes public without the explicit product flag.
  return envFlag('PAYMENTS_ENABLED');
}
