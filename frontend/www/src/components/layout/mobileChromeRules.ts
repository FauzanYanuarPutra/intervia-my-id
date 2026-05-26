export type MobileChromeLocale = 'id' | 'en';

const LOCALE_PREFIX_RE = /^\/(id|en)(?=\/|$)/;

export function normalizeMobilePathname(pathname: string | null): string {
  const cleanPath = (pathname || '/').replace(LOCALE_PREFIX_RE, '');
  return cleanPath || '/';
}

export function isMobileDetailRoute(pathname: string): boolean {
  return (
    /^\/content\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/listing\/[^/]+\/?$/.test(pathname) ||
    /^\/jobs\/(?!create(?:\/|$))[^/]+\/?$/.test(pathname) ||
    /^\/property\/(?!create(?:\/|$))[^/]+\/?$/.test(pathname) ||
    /^\/freelancers\/[^/]+\/?$/.test(pathname) ||
    /^\/profile\/(?!edit(?:\/|$)|freelancer(?:\/|$))[^/]+\/?$/.test(pathname) ||
    /^\/transactions\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/toko\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/umkm\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/super-app\/tracker\/[^/]+(?:\/.*)?$/.test(pathname) ||
    /^\/super-app\/umkm\/(?!scan(?:\/|$)|manage(?:\/|$))[^/]+(?:\/.*)?$/.test(pathname)
  );
}

export function isMobileImmersiveRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/reels') ||
    pathname.startsWith('/toko/scan') ||
    pathname.startsWith('/super-app/umkm/scan')
  );
}

export function hasLocalMobileTopBar(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/home') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/kategori') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/create') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/my-listings') ||
    pathname.startsWith('/my-applications') ||
    pathname.startsWith('/my-projects') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/settings') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/edit') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/property') ||
    pathname.startsWith('/freelancers') ||
    pathname.startsWith('/umkm') ||
    pathname.startsWith('/toko') ||
    pathname.startsWith('/usaha') ||
    pathname.startsWith('/super-app')
  );
}

export function shouldShowMobileBottomNav(pathname: string | null): boolean {
  const cleanPath = normalizeMobilePathname(pathname);
  return !isMobileDetailRoute(cleanPath) && !isMobileImmersiveRoute(cleanPath);
}

export function shouldShowMobileRouteTopBar(pathname: string | null): boolean {
  const cleanPath = normalizeMobilePathname(pathname);
  return shouldShowMobileBottomNav(cleanPath) && !hasLocalMobileTopBar(cleanPath);
}
