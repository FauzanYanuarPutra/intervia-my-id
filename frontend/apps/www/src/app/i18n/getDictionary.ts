import 'server-only';
import { cookies } from 'next/headers';
import { i18n, Locale } from './config';

function isLocale(value: string): value is Locale {
  return i18n.locales.includes(value as Locale);
}

export const getDictionary = async (): Promise<Record<string, unknown>> => {
  const cookieStore = await cookies();
  const localeCookie =
    cookieStore.get('NEXT_LOCALE') ??
    cookieStore.get('locale');
  const locale =
    localeCookie && isLocale(localeCookie.value)
      ? localeCookie.value
      : i18n.defaultLocale;

  const dict = await import(`./${locale}.json`);
  return dict.default;
};
