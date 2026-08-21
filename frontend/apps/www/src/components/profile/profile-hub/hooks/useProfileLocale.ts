import { useMemo } from 'react';
import { resolveLocaleFromPathname } from '@/lib/locale';

export function useProfileLocale(pathname: string) {
  const locale = useMemo(() => resolveLocaleFromPathname(pathname), [pathname]);
  return { locale, isId: locale === 'id' };
}

