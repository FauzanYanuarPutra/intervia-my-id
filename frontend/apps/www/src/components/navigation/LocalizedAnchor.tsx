'use client';

import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { usePathname } from 'next/navigation';
import {
  resolveLocaleFromPathname,
  type SupportedLocale,
} from '@/lib/locale';

type LocalizedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  locale?: SupportedLocale;
};

export function localizeHref(href: string, locale: SupportedLocale): string {
  if (!href.startsWith('/')) return href;
  if (href === '/') return `/${locale}`;
  if (href === `/${locale}` || href.startsWith(`/${locale}/`)) {
    return href;
  }
  return `/${locale}${href}`;
}

export const LocalizedAnchor = forwardRef<
  HTMLAnchorElement,
  LocalizedAnchorProps
>(function LocalizedAnchor({ href, locale, ...props }, ref) {
  const pathname = usePathname();
  const activeLocale = locale ?? resolveLocaleFromPathname(pathname);

  return <a ref={ref} href={localizeHref(href, activeLocale)} {...props} />;
});
