import { ApiHttpError } from '@/lib/http/errors';

export function onUnauthorized(error: ApiHttpError): void {
  if (typeof window === 'undefined') return;
  if (error.status !== 401 && error.status !== 403) return;
  window.dispatchEvent(new Event('auth:invalid-token'));
}
