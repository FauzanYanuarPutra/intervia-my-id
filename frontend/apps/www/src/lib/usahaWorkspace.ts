const DEFAULT_USAHA_ORIGIN = 'http://localhost:3003';

export function getUsahaWorkspaceUrl(path = '/', query?: Record<string, string | number | null | undefined>) {
  const origin = (process.env.NEXT_PUBLIC_USAHA_URL || DEFAULT_USAHA_ORIGIN).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${origin}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && String(value).trim()) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
