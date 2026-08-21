function keepEdges(value: string, left: number, right: number): string {
  if (value.length <= left + right) return '*'.repeat(Math.max(3, value.length));
  const tail = right > 0 ? value.slice(-right) : '';
  return `${value.slice(0, left)}${'*'.repeat(Math.min(8, value.length - left - right))}${tail}`;
}

export function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.trim().split('@');
  if (!domain) return keepEdges(value.trim(), 1, 1);
  return `${keepEdges(local, 1, 0)}@${domain}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? keepEdges(digits, 2, 3) : '***';
}

export function safeErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN_ERROR';
  const candidate = error as { code?: unknown; name?: unknown };
  if (typeof candidate.code === 'string' && candidate.code.trim()) {
    return candidate.code.trim().slice(0, 64);
  }
  if (typeof candidate.name === 'string' && candidate.name.trim()) {
    return candidate.name.trim().slice(0, 64);
  }
  return 'UNKNOWN_ERROR';
}

export function allowSensitiveDevelopmentLogs(): boolean {
  const appEnv = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
  return (
    appEnv === 'development' &&
    process.env.DEV_AUTH_SECRETS_TO_CONSOLE === 'true'
  );
}
