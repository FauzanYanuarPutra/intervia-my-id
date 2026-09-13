import { isProtectedRoutePath } from '@/lib/authRoutes';

/**
 * Auth bootstrap must only block protected surfaces.
 *
 * Public routes such as Home, Explore, and Community can render their real
 * shell immediately while an existing session is restored in the background.
 * This avoids replacing an otherwise usable public page with a full-page
 * skeleton for authentication state that only affects a subset of the UI.
 */
export function shouldBlockForAuthLoading(
  pathname: string | null | undefined,
  authLoading: boolean,
): boolean {
  return authLoading && isProtectedRoutePath(pathname);
}
