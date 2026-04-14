import { stripLocaleFromPath } from '@/config/pageMeta';
import type { RouteConfig } from './routes';

/**
 *
 * Optimasi: Cache Regex agar tidak dibuat ulang berkali-kali dalam loop rekursif
 */
const regexCache = new Map<string, RegExp>();

function getRegex(pattern: string): RegExp {
  if (regexCache.has(pattern)) return regexCache.get(pattern)!;

  const regexPattern = pattern
    .replace(/:[a-zA-Z0-9]+/g, '[^/]+')
    .replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexPattern}$`);
  regexCache.set(pattern, regex);
  return regex;
}

/**
 * Cari route config secara dinamis & recursive (Skala Besar)
 * Fungsi ini akan menelusuri sampai kedalaman tak terbatas (n-level)
 */
export function findRouteConfig(
  path: string,
  routesArray: RouteConfig[],
): RouteConfig | undefined {
  // Gunakan loop untuk mengecek level saat ini
  for (const route of routesArray) {
    // 1. Cek apakah level ini cocok
    if (getRegex(route.path).test(path)) {
      return route;
    }

    // 2. Jika tidak cocok, cek apakah path saat ini diawali dengan path rute ini
    // Ini adalah optimasi: Jangan masuk ke children jika prefix path saja tidak cocok
    const isParentOfPath = path.startsWith(route.path.split('/:')[0]);

    if (route.children && isParentOfPath) {
      const found = findRouteConfig(path, route.children);
      if (found) return found;
    }
  }

  return undefined;
}

export function isActivePath(currentPath: string, routePath: string): boolean {
  const normalizedPath = stripLocaleFromPath(currentPath);
  return normalizedPath === routePath;
}
