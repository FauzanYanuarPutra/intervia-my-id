// export type MobileChromeLocale = 'id' | 'en';

// const LOCALE_PREFIX_RE = /^\/(id|en)(?=\/|$)/;

// export function normalizeMobilePathname(pathname: string | null): string {
//   const cleanPath = (pathname || '/').replace(LOCALE_PREFIX_RE, '');
//   return cleanPath || '/';
// }

// export function isMobileDetailRoute(pathname: string): boolean {
//   return (
//     /^\/content\/[^/]+(?:\/.*)?$/.test(pathname) ||
//     /^\/jobs\/(?!create(?:\/|$))[^/]+\/?$/.test(pathname) ||
//     /^\/property\/(?!create(?:\/|$))[^/]+\/?$/.test(pathname) ||
//     /^\/transactions\/[^/]+(?:\/.*)?$/.test(pathname) ||
//     /^\/toko\/[^/]+(?:\/.*)?$/.test(pathname)
//   );
// }

// export function isMobileImmersiveRoute(pathname: string): boolean {
//   return (
//     pathname.startsWith('/login') ||
//     pathname.startsWith('/register') ||
//     pathname.startsWith('/forgot-password') ||
//     pathname.startsWith('/reset-password') ||
//     pathname.startsWith('/onboarding') ||
//     pathname.startsWith('/reels') ||
//     pathname.startsWith('/toko/scan')
//   );
// }

// export function hasLocalMobileTopBar(pathname: string): boolean {
//   return (
//     pathname === '/' ||
//     pathname.startsWith('/home') ||
//     pathname.startsWith('/explore') ||
//     pathname.startsWith('/kategori') ||
//     pathname.startsWith('/create') ||
//     pathname.startsWith('/my-listings') ||
//     pathname.startsWith('/my-projects') ||
//     pathname.startsWith('/jobs') ||
//     pathname.startsWith('/property') ||
//     pathname.startsWith('/profile') ||
//     pathname.startsWith('/umkm') ||
//     pathname.startsWith('/toko') ||
//     pathname.startsWith('/usaha')
//   );
// }

// export function shouldShowMobileBottomNav(pathname: string | null): boolean {
//   const cleanPath = normalizeMobilePathname(pathname);
//   return !isMobileDetailRoute(cleanPath) && !isMobileImmersiveRoute(cleanPath);
// }

// export function shouldShowMobileRouteTopBar(pathname: string | null): boolean {
//   const cleanPath = normalizeMobilePathname(pathname);
//   return (
//     shouldShowMobileBottomNav(cleanPath) && !hasLocalMobileTopBar(cleanPath)
//   );
// }
