export const i18n = {
  defaultLocale: 'id',
  locales: ['en', 'id'],
  localeDetection: true,
} as const;

export type Locale = (typeof i18n)['locales'][number];
