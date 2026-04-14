import { headers } from 'next/headers';

export async function getBaseUrl(): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  try {
    const hdrs = await headers();
    const proto = hdrs.get('x-forwarded-proto') ?? 'http';
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // Fall back to env/default when headers are unavailable.
  }

  return envBase ? envBase.replace(/\/$/, '') : 'http://localhost:3000';
}
