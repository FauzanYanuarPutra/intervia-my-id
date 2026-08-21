import { ApiHttpError, toApiHttpError } from '@/lib/http/errors';
import { onUnauthorized } from '@/lib/http/auth';

export type ApiResult<T> =
  | { ok: true; data: T; response: Response }
  | { ok: false; error: ApiHttpError; response?: Response };

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json');
}

async function parseBody<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  if (isJsonResponse(res)) return (await res.json()) as T;
  return (await res.text()) as T;
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(input, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    const payload = await parseBody<T>(response);

    if (!response.ok) {
      const error = toApiHttpError(response.status, payload);
      onUnauthorized(error);
      return { ok: false, error, response };
    }

    return { ok: true, data: (payload ?? ({} as T)) as T, response };
  } catch (err) {
    const error =
      err instanceof ApiHttpError
        ? err
        : new ApiHttpError(
            err instanceof Error ? err.message : 'Network request failed',
            0,
          );
    return { ok: false, error };
  }
}
