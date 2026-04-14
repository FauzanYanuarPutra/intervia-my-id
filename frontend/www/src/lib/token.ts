// src/lib/token.ts
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expSec = payload.exp ? Number(payload.exp) : 0;
    const expMs = expSec * 1000;
    // consider clock skew of 30s
    return Date.now() >= expMs - 30_000;
  } catch {
    return true;
  }
}
